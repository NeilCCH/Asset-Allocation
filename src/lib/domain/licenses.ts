// 顧問專業證照 — 顧問後台註冊時登錄,佐證「產出建議者具專業資格」(合規稽核)。
// requiresNumber:是否需填合格證號。外幣/投資型保險依附壽險資格,勾選即可、免證號。

export type LicenseType =
  // 保險
  | "壽險業務員"
  | "外幣收付非投資型保險"
  | "投資型保險業務員"
  | "產險業務員"
  // 理財規劃認證
  | "RFA"
  | "RFC"
  | "CFP"
  | "AFP"
  | "理財規劃人員"
  // 信託 / 投信投顧
  | "信託業務人員"
  | "投信投顧業務員";

export type LicenseCategory = "保險" | "理財規劃認證" | "信託・投信投顧";

export const LICENSE_OPTIONS: {
  value: LicenseType;
  label: string;
  note?: string;
  requiresNumber: boolean;
  category: LicenseCategory;
}[] = [
  // ── 保險 ──
  { value: "壽險業務員", label: "壽險業務員", requiresNumber: true, category: "保險" },
  { value: "外幣收付非投資型保險", label: "外幣收付非投資型保險", note: "依附壽險資格,勾選即可", requiresNumber: false, category: "保險" },
  { value: "投資型保險業務員", label: "投資型保險業務員", note: "依附壽險資格,勾選即可", requiresNumber: false, category: "保險" },
  { value: "產險業務員", label: "產險業務員", requiresNumber: true, category: "保險" },
  // ── 理財規劃認證 ──
  { value: "RFA", label: "RFA", requiresNumber: true, category: "理財規劃認證" },
  { value: "RFC", label: "RFC 國際認證財務顧問師", requiresNumber: true, category: "理財規劃認證" },
  { value: "CFP", label: "CFP 認證理財規劃顧問", requiresNumber: true, category: "理財規劃認證" },
  { value: "AFP", label: "AFP 理財規劃顧問", requiresNumber: true, category: "理財規劃認證" },
  { value: "理財規劃人員", label: "理財規劃人員", requiresNumber: true, category: "理財規劃認證" },
  // ── 信託 / 投信投顧 ──
  { value: "信託業務人員", label: "信託業務人員", requiresNumber: true, category: "信託・投信投顧" },
  { value: "投信投顧業務員", label: "投信投顧業務員", note: "個人業務員資格;對外提供投顧服務仍須於持牌事業體下執業", requiresNumber: true, category: "信託・投信投顧" },
];

/** 證照 → 分類 */
export const LICENSE_CATEGORY: Record<string, LicenseCategory> = Object.fromEntries(
  LICENSE_OPTIONS.map((o) => [o.value, o.category]),
);

const CATEGORY_ORDER: LicenseCategory[] = ["保險", "理財規劃認證", "信託・投信投顧"];

/** 把顧問持有的證照依分類分組(供後台/報告分類呈現) */
export function groupLicensesByCategory(
  licenses: AdvisorLicense[],
): { category: LicenseCategory; items: AdvisorLicense[] }[] {
  const map = new Map<LicenseCategory, AdvisorLicense[]>();
  for (const l of licenses) {
    const cat = LICENSE_CATEGORY[l.type] ?? "保險";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(l);
  }
  return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }));
}

/** 快速查表:某證照是否需填證號 */
export const LICENSE_REQUIRES_NUMBER: Record<string, boolean> = Object.fromEntries(
  LICENSE_OPTIONS.map((o) => [o.value, o.requiresNumber]),
);

export interface AdvisorLicense {
  type: LicenseType;
  number?: string;
  verified?: boolean;
}
