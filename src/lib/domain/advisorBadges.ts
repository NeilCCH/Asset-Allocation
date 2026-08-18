// 顧問徽章 — 依「專業能力(證照)」與「檔案完成度」分類。純函式,供顧問儀表板與客戶推薦卡共用。
// ⚠️ 本輪不做「積極度」徽章(需行為數據,另議)。
import { groupLicensesByCategory, type AdvisorLicense } from "./licenses";

export type BadgeTone = "gold" | "emerald" | "sky" | "violet" | "amber" | "neutral";
export interface Badge {
  label: string;
  tone: BadgeTone;
}

// 高階理財認證(國際/專業級)
const TOP_CERTS = new Set(["CFP", "RFC", "RFA"]);

/** 專業徽章:依證照分類覆蓋度產生。全數三類 → 授予「全方位顧問」金徽章。 */
export function professionalBadges(licenses: AdvisorLicense[]): Badge[] {
  const cats = new Set(groupLicensesByCategory(licenses).map((g) => g.category));
  const badges: Badge[] = [];
  if (cats.has("保險")) badges.push({ label: "保險規劃", tone: "violet" });
  if (cats.has("理財規劃認證")) {
    const hasTop = licenses.some((l) => TOP_CERTS.has(l.type));
    badges.push({ label: hasTop ? "高階理財認證" : "理財規劃認證", tone: "emerald" });
  }
  if (cats.has("信託・投信投顧")) badges.push({ label: "信託・投顧", tone: "sky" });
  if (cats.size >= 3) badges.unshift({ label: "全方位顧問", tone: "gold" });
  return badges;
}

// ── 檔案完成度 ──────────────────────────────────────────
export interface CompletenessItem {
  label: string;
  ok: boolean;
}
export interface Completeness {
  pct: number;
  tier: "基礎" | "進階" | "完整";
  filled: number;
  total: number;
  items: CompletenessItem[];
  missing: string[];
}

/** 顧問檔案需要的欄位子集(避免耦合整個 AdvisorProfile 型別) */
export interface CompletenessInput {
  full_name?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  mobile?: string | null;
  website?: string | null;
  facebook_url?: string | null;
  card_front_path?: string | null;
  card_back_path?: string | null;
  licenses?: AdvisorLicense[];
}

/** 檔案完成度:以專業能力(證照)為主、輔以基本資料與名片。 */
export function profileCompleteness(a: CompletenessInput): Completeness {
  const licenses = a.licenses ?? [];
  const items: CompletenessItem[] = [
    { label: "姓名", ok: !!a.full_name },
    { label: "公司", ok: !!a.company_name },
    { label: "職稱", ok: !!a.job_title },
    { label: "手機", ok: !!a.mobile },
    { label: "個人網頁 / FB", ok: !!(a.website || a.facebook_url) },
    { label: "名片(雙面)", ok: !!(a.card_front_path && a.card_back_path) },
    { label: "專業證照", ok: licenses.length > 0 },
    { label: "多元證照(≥2 類)", ok: groupLicensesByCategory(licenses).length >= 2 },
  ];
  const filled = items.filter((i) => i.ok).length;
  const total = items.length;
  const pct = Math.round((filled / total) * 100);
  const tier = pct >= 85 ? "完整" : pct >= 55 ? "進階" : "基礎";
  return { pct, tier, filled, total, items, missing: items.filter((i) => !i.ok).map((i) => i.label) };
}
