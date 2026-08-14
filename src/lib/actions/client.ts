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
}): Promise<{ ok: true; clientId: string } | { ok: false; error: string }> {
  const svc = createServiceSupabase();
  const { data } = input;

  // 依推薦碼解析綁定顧問
  const { data: advisor } = await svc
    .from("advisors")
    .select("id")
    .eq("referral_code", input.referralCode.trim().toUpperCase())
    .maybeSingle();
  if (!advisor) return { ok: false, error: "推薦碼無效或顧問不存在" };

  // 建立客戶(含 PDPA 同意紀錄)
  const { data: client, error: cErr } = await svc
    .from("clients")
    .insert({
      advisor_id: advisor.id,
      surname: data.basic.surname,
      honorific: data.basic.honorific,
      line_id: data.basic.line_id ?? null,
      mobile: data.basic.mobile ?? null,
      email: data.basic.email ?? null,
      pdpa_consent: true,
      pdpa_consent_at: new Date().toISOString(),
      pdpa_version: PDPA_VERSION,
    })
    .select("id")
    .single();
  if (cErr || !client) return { ok: false, error: cErr?.message ?? "建立客戶失敗" };
  const clientId = client.id as string;

  // 問卷作答
  await svc.from("questionnaire_responses").insert({
    client_id: clientId,
    basic: data.basic,
    core: data.core,
    deep: data.deep ?? null,
    kyc: data.kyc ?? null,
  });

  // 事實層彙整(客戶可見)
  await svc.from("client_summaries").insert({
    client_id: clientId,
    asset_breakdown: assetBreakdown(data.core.assets),
    protection_vs_invest: protectionVsInvestment(data.core.assets),
    gaps: computeGaps(data, clientDefaultParams(data.basic.honorific)),
  });

  // 顧問專屬:leads 評分(客戶端讀不到此表)
  await svc.from("advisor_private").insert({
    client_id: clientId,
    lead_score: scoreLead(data),
  });

  return { ok: true, clientId };
}
