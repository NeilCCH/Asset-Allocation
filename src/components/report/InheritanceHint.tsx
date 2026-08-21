// 民法繼承順位提示 — 置於家族關係圖右側。依實際家庭成員標出實際繼承順位與應繼分。
// 樣式沿用 HealthCheckReport 的 hcr 類別（見該檔 css 區塊）。
import type { InheritanceResult } from "@/lib/domain/inheritance";

export function InheritanceHint({ result }: { result: InheritanceResult }) {
  return (
    <div className="hcr-inh">
      <div className="hcr-inh-title">民法法定繼承順位</div>
      <ol className="hcr-inh-orders">
        {result.orders.map((o) => (
          <li key={o.order} className={`hcr-inh-order ${o.active ? "active" : o.present ? "present" : "none"}`}>
            <span className="hcr-inh-rank">{o.rank}</span>
            <span className="hcr-inh-role">{o.title}</span>
            <span className="hcr-inh-note">{o.active ? `✓ ${o.note}` : o.note}</span>
          </li>
        ))}
      </ol>

      <div className="hcr-inh-share">
        <div className="hcr-inh-headline">
          {result.hasSpouse ? "配偶為當然繼承人；" : ""}
          {result.headline}
        </div>
        {result.shares.length > 0 && (
          <table className="hcr-inh-tbl">
            <tbody>
              {result.shares.map((s, i) => (
                <tr key={i}>
                  <td>
                    {s.role}
                    {s.count ? `（${s.count} 位）` : ""}
                  </td>
                  <td>每人 {s.each}</td>
                  <td>合計 {s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {result.caveat && <p className="hcr-inh-caveat">{result.caveat}</p>}
      </div>

      <p className="hcr-inh-cite">
        依民法 §1138（順位）、§1140（代位繼承）、§1144（配偶應繼分）。應繼分為法定分配比例，實際仍以個案事實與法律專業意見為準。
      </p>
    </div>
  );
}
