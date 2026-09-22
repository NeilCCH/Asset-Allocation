"use server";

import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import type { QuestionnaireData } from "@/lib/domain/types";
import { assetBreakdown, computeGaps, protectionVsInvestment } from "@/lib/domain/calc";
import { clientDefaultParams } from "@/lib/domain/params";
import { scoreLead } from "@/lib/domain/leads";
import { PDPA_VERSION } from "@/lib/domain/pdpa";
import { ASSET_FIELDS } from "@/lib/domain/options";
import { z } from "zod";

const tokenSchema = z.uuidv4();
const assetSchema = z.object({ has: z.boolean(), amount: z.number().finite().nonnegative().max(1e12) });
const questionnaireSchema = z.object({
  basic: z.object({
    surname: z.string().trim().min(1).max(30),
    honorific: z.enum(["先生", "女士"]),
    line_id: z.string().max(100).optional(),
    mobile: z.string().max(40).optional(),
    email: z.email().max(254).optional(),
  }),
  core: z.object({
    age: z.number().int().min(18).max(120),
    retire_age: z.number().int().min(18).max(120),
    planning_scope: z.enum(["個人", "含配偶"]),
    dependents: z.object({
      children: z.array(z.unknown()).max(30),
      parents: z.array(z.unknown()).max(2),
      siblings: z.array(z.unknown()).max(30),
      grandchildren: z.object({ count: z.number().int().min(0).max(100) }),
      grandparents: z.array(z.unknown()).max(4),
    }),
    income_type: z.enum(["固定薪", "業務浮動", "自營"]),
    income_band: z.enum(["<80", "80-150", "150-300", "300-500", "500-1000", ">1000"]),
    surplus_band: z.enum(["<1", "1-3", "3-6", "6-10", ">10", "赤字"]),
    horizon: z.enum(["<1年", "1-3年", "3-5年", "5-10年", ">10年"]),
    urgency: z.enum(["3個月內", "半年內", "一年內", "先看看"]),
    assets: z.record(z.string(), assetSchema).refine(
      (assets) => ASSET_FIELDS.every(({ key }) => key in assets),
    ),
  }),
});

export async function submitClientQuestionnaire(input: {
  referralCode: string;
  data: QuestionnaireData;
  submissionToken?: string;
  pdpaConsent: boolean;
}): Promise<{ ok: true; clientId: string } | { ok: false; error: string }> {
  if (input.pdpaConsent !== true) return { ok: false, error: "請先同意個資告知事項" };
  const token = tokenSchema.safeParse(input.submissionToken);
  const parsed = questionnaireSchema.safeParse(input.data);
  if (!token.success || !parsed.success) return { ok: false, error: "問卷資料或提交憑證無效" };
  if (!input.referralCode || input.referralCode.length > 30) return { ok: false, error: "推薦碼無效" };
  if (JSON.stringify(input.data).length > 100_000) return { ok: false, error: "問卷資料過大" };

  const session = await createServerSupabase();
  const { data: auth } = await session.auth.getUser();
  const data = input.data;
  const svc = createServiceSupabase();
  const { data: clientId, error } = await svc.rpc("save_client_questionnaire", {
    p_referral_code: input.referralCode,
    p_submission_token: token.data,
    p_auth_user_id: auth.user?.id ?? null,
    p_data: data,
    p_asset_breakdown: assetBreakdown(data.core.assets),
    p_protection_vs_invest: protectionVsInvestment(data.core.assets),
    p_gaps: computeGaps(data, clientDefaultParams(data.basic.honorific)),
    p_lead_score: scoreLead(data),
    p_pdpa_version: PDPA_VERSION,
  });
  if (error || !clientId) {
    if (error?.message.includes("INVALID_REFERRAL")) return { ok: false, error: "推薦碼無效或顧問不存在" };
    if (error?.message.includes("CLIENT_ALREADY_LINKED")) return { ok: false, error: "此記錄已綁定其他帳號" };
    return { ok: false, error: "儲存問卷失敗，請稍後重試" };
  }
  return { ok: true, clientId: clientId as string };
}
