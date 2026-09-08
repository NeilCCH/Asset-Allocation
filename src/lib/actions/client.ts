"use server";

// 客戶問卷存檔 — 以 service_role 於伺服器端寫入(客戶端無需登入即可經邀請連結提交)。
// 依綁定顧問的推薦碼寫入 clients.advisor_id,並產出事實層彙整與(顧問專屬)leads 評分。
import { createServiceSupabase } from "@/lib/supabase/server";
import type { QuestionnaireData } from "@/lib/domain/types";
import { assetBreakdown, computeGaps, protectionVsInvestment } from "@/lib/domain/calc";
import { clientDefaultParams } from "@/lib/domain/params";
import { scoreLead } from "@/lib/domain/leads";
import { PDPA_VERSION } from "@/lib/domain/pdpa";

export async function submitClientQuestionnaire(input: {
  referralCode: string;
  data: QuestionnaireData;
  /** 送出去重用的隨機識別碼(非個資);同顧問同 token 之重複送出視為「同一人」→ 更新而非新增 */
  submissionToken?: string;
}): Promise<{ ok: true; clientId: string } | { ok: false; error: string }> {
  const svc = createServiceSupabase();
  const { data } = input;
  const token = input.submissionToken?.trim() || null;

  // 依推薦碼解析綁定顧問
  const { data: advisor } = await svc
    .from("advisors")
    .select("id")
    .eq("referral_code", input.referralCode.trim().toUpperCase())
    .maybeSingle();
  if (!advisor) return { ok: false, error: "推薦碼無效或顧問不存在" };

  const clientFields = {
    advisor_id: advisor.id,
    surname: data.basic.surname,
    honorific: data.basic.honorific,
    line_id: data.basic.line_id ?? null,
    mobile: data.basic.mobile ?? null,
    email: data.basic.email ?? null,
    pdpa_consent: true,
    pdpa_consent_at: new Date().toISOString(),
    pdpa_version: PDPA_VERSION,
    submission_token: token,
  };

  // 去重:同顧問 + 同送出識別碼 → 視為同一人重填,更新既有客戶(不新增)。
  let clientId: string | null = null;
  if (token) {
    const { data: existing } = await svc
      .from("clients")
      .select("id")
      .eq("advisor_id", advisor.id)
      .eq("submission_token", token)
      .maybeSingle();
    if (existing) {
      clientId = existing.id as string;
      // 保留原始 PDPA 同意時間,只更新可變欄位
      const { advisor_id: _a, pdpa_consent_at: _c, ...mutable } = clientFields;
      void _a; void _c;
      await svc.from("clients").update(mutable).eq("id", clientId);
    }
  }

  if (!clientId) {
    const { data: client, error: cErr } = await svc.from("clients").insert(clientFields).select("id").single();
    if (cErr || !client) return { ok: false, error: cErr?.message ?? "建立客戶失敗" };
    clientId = client.id as string;
  }

  // 下游三表皆為一客戶一筆(client_id 唯一)→ upsert 覆蓋為最新一次填寫。
  await svc.from("questionnaire_responses").upsert(
    { client_id: clientId, basic: data.basic, core: data.core, deep: data.deep ?? null, kyc: data.kyc ?? null },
    { onConflict: "client_id" },
  );

  // 事實層彙整(客戶可見)
  await svc.from("client_summaries").upsert(
    {
      client_id: clientId,
      asset_breakdown: assetBreakdown(data.core.assets),
      protection_vs_invest: protectionVsInvestment(data.core.assets),
      gaps: computeGaps(data, clientDefaultParams(data.basic.honorific)),
    },
    { onConflict: "client_id" },
  );

  // 顧問專屬:leads 評分(客戶端讀不到此表)
  await svc.from("advisor_private").upsert(
    { client_id: clientId, lead_score: scoreLead(data) },
    { onConflict: "client_id" },
  );

  return { ok: true, clientId };
}
