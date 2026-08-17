// 顧問 CRM — 客戶跟進狀態(僅顧問後台可見)。
export const LEAD_STATUSES = ["待聯繫", "洽談中", "已成交", "擱置"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const DEFAULT_LEAD_STATUS: LeadStatus = "待聯繫";

// 徽章配色(Tailwind class)
export const LEAD_STATUS_STYLE: Record<string, string> = {
  待聯繫: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  洽談中: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  已成交: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  擱置: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

export function leadStatusStyle(status: string | null | undefined): string {
  return LEAD_STATUS_STYLE[status ?? ""] ?? LEAD_STATUS_STYLE[DEFAULT_LEAD_STATUS];
}
