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

export const LICENSE_OPTIONS: {
  value: LicenseType;
  label: string;
  note?: string;
  requiresNumber: boolean;
}[] = [
  // ── 保險 ──
  { value: "壽險業務員", label: "壽險業務員", requiresNumber: true },
  { value: "外幣收付非投資型保險", label: "外幣收付非投資型保險", note: "依附壽險資格,勾選即可", requiresNumber: false },
  { value: "投資型保險業務員", label: "投資型保險業務員", note: "依附壽險資格,勾選即可", requiresNumber: false },
  { value: "產險業務員", label: "產險業務員", requiresNumber: true },
  // ── 理財規劃認證 ──
  { value: "RFA", label: "RFA", requiresNumber: true },
  { value: "RFC", label: "RFC 國際認證財務顧問師", requiresNumber: true },
  { value: "CFP", label: "CFP 認證理財規劃顧問", requiresNumber: true },
  { value: "AFP", label: "AFP 理財規劃顧問", requiresNumber: true },
  { value: "理財規劃人員", label: "理財規劃人員", requiresNumber: true },
  // ── 信託 / 投信投顧 ──
  { value: "信託業務人員", label: "信託業務人員", requiresNumber: true },
  { value: "投信投顧業務員", label: "投信投顧業務員", note: "個人業務員資格;對外提供投顧服務仍須於持牌事業體下執業", requiresNumber: true },
];

/** 快速查表:某證照是否需填證號 */
export const LICENSE_REQUIRES_NUMBER: Record<string, boolean> = Object.fromEntries(
  LICENSE_OPTIONS.map((o) => [o.value, o.requiresNumber]),
);

export interface AdvisorLicense {
  type: LicenseType;
  number?: string;
  verified?: boolean;
}
