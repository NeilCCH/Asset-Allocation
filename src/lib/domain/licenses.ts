// 顧問專業證照 — 顧問後台註冊時登錄,佐證「產出建議者具專業資格」(合規稽核)。
// 台灣常見金融相關證照清單。

export type LicenseType =
  | "產險業務員"
  | "壽險業務員"
  | "外幣收付非投資型保險"
  | "投資型保險業務員"
  | "信託業務人員"
  | "投信投顧業務員"; // 證券投資信託及顧問業務員

export const LICENSE_OPTIONS: { value: LicenseType; label: string; note?: string }[] = [
  { value: "產險業務員", label: "產險業務員" },
  { value: "壽險業務員", label: "壽險業務員" },
  { value: "外幣收付非投資型保險", label: "外幣收付非投資型保險" },
  { value: "投資型保險業務員", label: "投資型保險業務員" },
  { value: "信託業務人員", label: "信託業務人員" },
  {
    value: "投信投顧業務員",
    label: "投信投顧業務員",
    note: "個人業務員資格;對外提供投顧服務仍須於持牌事業體下執業",
  },
];

export interface AdvisorLicense {
  type: LicenseType;
  number?: string;
  verified?: boolean;
}
