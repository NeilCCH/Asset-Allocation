"use client";

export function PrintButton({ label = "列印 / 儲存為 PDF" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
    >
      {label}
    </button>
  );
}
