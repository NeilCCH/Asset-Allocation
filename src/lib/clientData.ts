// 載入客戶問卷資料(伺服器端):先範例、再真實(RLS 限本顧問名下)。
import { getMockClient } from "@/lib/mock/clients";
import { createServerSupabase } from "@/lib/supabase/server";
import type { QuestionnaireData } from "@/lib/domain/types";
import { normalizeData } from "@/lib/domain/normalize";

export const isRealClientId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function loadClientData(id: string): Promise<QuestionnaireData | null> {
  const mock = getMockClient(id);
  if (mock) return normalizeData(mock.data);
  if (!isRealClientId(id)) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("clients")
    .select("questionnaire_responses(basic, core, deep, kyc)")
    .eq("id", id)
    .maybeSingle();
  type QRRow = { basic: unknown; core: unknown; deep: unknown; kyc: unknown };
  // client_id 有 unique 約束 → 巢狀回傳「物件」而非陣列;兩種形狀都相容
  const q = (data as { questionnaire_responses?: QRRow | QRRow[] } | null)?.questionnaire_responses;
  const qr = Array.isArray(q) ? q[0] : q;
  if (!qr?.core) return null;
  return normalizeData({ basic: qr.basic, core: qr.core, deep: qr.deep ?? undefined, kyc: qr.kyc ?? undefined } as QuestionnaireData);
}
