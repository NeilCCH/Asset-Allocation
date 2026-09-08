// 共用右箭頭圖示 — 取代純文字「→」。放在文字後面,父層加 `group` 時 hover 會右移。
// 與 ForwardLink / BackLink 同款線條,維持全站一致。
export function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`inline-block h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.5 5 12.5 10l-5 5" />
    </svg>
  );
}
