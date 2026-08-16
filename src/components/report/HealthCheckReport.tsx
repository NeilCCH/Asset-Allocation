// 健檢報告 — §8 單一來源 HTML。自帶 <style>,不依賴 Tailwind,
// 同一份可用於:App 內閱讀(RWD)、瀏覽器列印、後端無頭瀏覽器印 PDF。
import type { ReportModel } from "@/lib/domain/report";
import { fmtWan } from "@/lib/domain/report";
import { FamilyTree } from "./FamilyTree";

const GAP_FORMULA: Record<string, string> = {
  退休金缺口: "退休後總支出需求 − (現有資產成長估計 + 未來持續投入估計)",
  保障缺口: "(未償負債 + 扶養支出 + 子女教育金) − (現有壽險保額 + 流動資產)",
  教育金缺口: "Σ 每位子女(每年教育+生活預算 × 就讀年數),依就學時程折現",
};

const CAT_COLOR: Record<string, string> = {
  流動: "#10b981",
  投資: "#0ea5e9",
  保障: "#8b5cf6",
  不動產: "#f59e0b",
  其他: "#94a3b8",
};

function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="資產類別分布">
      <g transform="rotate(-90 80 80)">
        {segments.map((s) => {
          const len = (s.value / total) * C;
          const dash = `${len} ${C - len}`;
          const el = (
            <circle
              key={s.label}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="26"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </g>
    </svg>
  );
}

export function HealthCheckReport({ model, variant = "full" }: { model: ReportModel; variant?: "simple" | "full" }) {
  const full = variant === "full";
  const family = model.family;
  const catTotals = new Map<string, number>();
  model.assets.forEach((a) => catTotals.set(a.category, (catTotals.get(a.category) ?? 0) + a.amount));
  const segments = [...catTotals.entries()].map(([label, value]) => ({
    label,
    value,
    color: CAT_COLOR[label] ?? "#94a3b8",
  }));

  return (
    <div className="hcr">
      <style>{css}</style>

      <header className="hcr-head">
        <div>
          <div className="hcr-kicker">資產配置健檢報告</div>
          <h1 className="hcr-title">{model.clientName}</h1>
          <div className="hcr-sub">
            {model.profile.age} 歲 · 預計 {model.profile.retireAge} 歲退休 · {model.profile.incomeType} ·
            子女 {model.profile.childrenCount} 位
          </div>
        </div>
        <div className="hcr-date">產出日期<br />{model.generatedAt}</div>
      </header>

      {/* 關鍵數字 */}
      <section className="hcr-stats">
        <Stat label="資產總額" value={fmtWan(model.summary.total)} />
        <Stat label="流動資產" value={`${model.summary.liquidPct}%`} sub={fmtWan(model.summary.liquid)} />
        <Stat label="保障型占比" value={`${model.summary.protectionPct}%`} sub="保障 vs 投資" />
      </section>

      {/* 資產分布 */}
      <section className="hcr-card">
        <h2>資產類別分布</h2>
        <div className="hcr-dist">
          <Donut segments={segments} />
          <ul className="hcr-legend">
            {model.assets.map((a) => (
              <li key={a.label}>
                <span className="hcr-dot" style={{ background: CAT_COLOR[a.category] ?? "#94a3b8" }} />
                <span className="hcr-legend-label">{a.label}</span>
                <span className="hcr-legend-val">{fmtWan(a.amount)}<em>{a.pct}%</em></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 保障 vs 投資 */}
      <section className="hcr-card">
        <h2>保障 vs 投資 比重</h2>
        <div className="hcr-bar">
          <div style={{ width: pct(model.summary.protection, model.summary.investment), background: "#8b5cf6" }} />
          <div style={{ flex: 1, background: "#0ea5e9" }} />
        </div>
        <div className="hcr-bar-legend">
          <span>● 保障型 {fmtWan(model.summary.protection)}</span>
          <span>投資型 {fmtWan(model.summary.investment)} ●</span>
        </div>
      </section>

      {/* 缺口概況 */}
      <section className="hcr-card">
        <h2>缺口概況(客觀試算)</h2>
        {model.gaps.map((g) => (
          <div key={g.name} className={`hcr-gap ${gapClass(g.result)}`}>
            <span className="hcr-gap-name">{g.name}</span>
            <span className="hcr-gap-val">{gapText(g.result)}</span>
          </div>
        ))}
        <p className="hcr-note">
          試算採透明公式與假設(報酬 {pctNum(model.params.returnRate)} / 通膨 {pctNum(model.params.inflationRate)} /
          預估餘命 {model.params.lifeExpectancy} 歲),屬客觀試算,不構成投資建議。
        </p>
      </section>

      {/* 簡易版:提示完整報告洽顧問 */}
      {!full && (
        <section className="hcr-card hcr-advisor">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8 }}>
            本頁為<strong>簡易資產健檢摘要</strong>。完整報告(含現有保障總覽、遺產稅預估、各項計算明細與規劃建議),
            請洽您的<strong>財富管理顧問</strong>。
          </p>
        </section>
      )}

      {/* 家戶保障總覽(保單健檢:本人 + 配偶 + 子女) */}
      {full && model.householdInsurance.some((m) => m.rows.length > 0) && (
        <section className="hcr-card">
          <h2>家戶保障總覽</h2>
          {model.householdInsurance
            .filter((m) => m.rows.length > 0)
            .map((m) => (
              <div key={m.member} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "4px 0" }}>{m.member}</div>
                <div className="hcr-ins">
                  {m.rows.map((r) => (
                    <div key={r.label} className={`hcr-ins-row ${r.has ? "on" : "off"}`}>
                      <span>{r.has ? "✓ " : "— "}{r.label}</span>
                      <span>{r.has ? r.text : "尚無"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          <p className="hcr-note">各險種單位不同:壽險/意外/重疾為保額(萬)、醫療為日額+實支實付、失能/長照為每月給付。含配偶與子女以利家戶保障檢視。</p>
        </section>
      )}

      {/* 家系關係圖(完整版) */}
      {full && (
        <section className="hcr-card">
          <h2>家族關係圖</h2>
          <FamilyTree family={model.family} selfIsFemale={model.family.selfIsFemale} />
          <p className="hcr-note">
            本人 {family.self.age} 歲
            {family.spouseAge != null ? `、配偶 ${family.spouseAge} 歲` : ""}
            {family.parents.count > 0 ? `、父母 ${family.parents.count} 位` : ""}
            {family.siblings.length > 0 ? `、兄弟姊妹 ${family.siblings.length} 位` : ""}
            {family.children.length > 0 ? `、子女 ${family.children.length} 位` : ""}
            {family.grandchildren > 0 ? `、孫子女 ${family.grandchildren} 位` : ""}
            。供遺產繼承順位與傳承規劃參考。
          </p>
        </section>
      )}

      {/* 遺產稅預估(達課稅標準才有,完整版) */}
      {full && model.estateTax && (
        <section className="hcr-card">
          <h2>遺產稅預估</h2>
          <div className="hcr-stats">
            <Stat label="遺產總額" value={fmtWan(model.estateTax.grossEstate)} />
            <Stat label="課稅遺產淨額" value={fmtWan(model.estateTax.netTaxable)} sub={`扣除額 ${fmtWan(model.estateTax.totalDeductions)}`} />
            <Stat label="預估遺產稅" value={fmtWan(model.estateTax.tax)} sub={`稅率 ${Math.round(model.estateTax.rate * 100)}%`} />
          </div>
          <p className="hcr-note">
            依台灣現行遺產稅概數試算(免稅額 1,333 萬、配偶 493 萬、每位子女 56 萬、每位父母 138 萬、喪葬 138 萬等),
            未計入保單指定受益人等規劃;實際以國稅局核定為準。
          </p>
        </section>
      )}

      {/* 試算計算明細(供驗證,完整版) */}
      {full && (
      <section className="hcr-card">
        <h2>試算計算明細(供驗證)</h2>
        <p className="hcr-note">
          試算參數:年報酬 {pctNum(model.params.returnRate)} · 通膨 {pctNum(model.params.inflationRate)} ·
          預估餘命 {model.params.lifeExpectancy} 歲 · 所得替代率 {model.params.defaultRetireLifestylePct}% ·
          子女獨立年齡 {model.params.childIndependentAge} 歲
        </p>
        {model.gaps
          .filter((g) => g.result.status === "computed")
          .map((g) => (
            <div key={g.name} className="hcr-calc">
              <div className="hcr-calc-title">{g.name}</div>
              <div className="hcr-calc-formula">{GAP_FORMULA[g.name] ?? ""}</div>
              <ul className="hcr-calc-list">
                {g.result.breakdown.map((b) => (
                  <li key={b.label}>
                    <span>{b.label}</span>
                    <span>{fmtWan(b.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="hcr-calc-result">= {gapText(g.result)}</div>
            </div>
          ))}
        {model.estateTax && (
          <div className="hcr-calc">
            <div className="hcr-calc-title">遺產稅</div>
            <div className="hcr-calc-formula">(遺產總額 − 扣除額) × 稅率 − 累進差額</div>
            <ul className="hcr-calc-list">
              <li><span>遺產總額</span><span>{fmtWan(model.estateTax.grossEstate)}</span></li>
              {model.estateTax.deductions.map((d) => (
                <li key={d.label}><span>− {d.label}</span><span>{fmtWan(d.amount)}</span></li>
              ))}
              <li><span>課稅遺產淨額</span><span>{fmtWan(model.estateTax.netTaxable)}</span></li>
              <li><span>× 稅率</span><span>{Math.round(model.estateTax.rate * 100)}%</span></li>
            </ul>
            <div className="hcr-calc-result">= 預估遺產稅 {fmtWan(model.estateTax.tax)}</div>
          </div>
        )}
      </section>
      )}

      {/* 顧問建議(顧問版才有) */}
      {(model.advisorRecommendation || model.selectedDimensions?.length) && (
        <section className="hcr-card hcr-advisor">
          <h2>顧問規劃建議</h2>
          {model.selectedDimensions && model.selectedDimensions.length > 0 && (
            <div className="hcr-dims">
              {model.selectedDimensions.map((d) => (
                <div key={d.title} className="hcr-dim">
                  <strong>{d.title}</strong>
                  <span>{d.desc}</span>
                </div>
              ))}
            </div>
          )}
          {model.advisorRecommendation && <p className="hcr-reco">{model.advisorRecommendation}</p>}
          {model.advisorSignature && (
            <div className="hcr-sign">
              規劃顧問:{model.advisorSignature.name}
              {model.advisorSignature.licenses.length > 0 && (
                <span className="hcr-lic">({model.advisorSignature.licenses.join("、")})</span>
              )}
            </div>
          )}
        </section>
      )}

      <footer className="hcr-foot">
        本報告為資產配置檢視與缺口試算,採透明公式與假設參數,<strong>僅供參考,以實際狀況及主管機關/國稅局核定為準</strong>;
        系統不推介任何金融商品,對客戶之規劃建議由具專業資格之顧問提供。
      </footer>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="hcr-stat">
      <div className="hcr-stat-val">{value}</div>
      <div className="hcr-stat-label">{label}</div>
      {sub && <div className="hcr-stat-sub">{sub}</div>}
    </div>
  );
}

function pct(a: number, b: number): string {
  const t = a + b;
  return t > 0 ? `${(a / t) * 100}%` : "50%";
}
function pctNum(r: number): string {
  return `${(r * 100).toFixed(1)}%`;
}
function gapClass(g: ReportModel["gaps"][number]["result"]): string {
  if (g.status === "needs_deep_data") return "pending";
  return g.gap > 0 ? "short" : "ok";
}
function gapText(g: ReportModel["gaps"][number]["result"]): string {
  if (g.status === "needs_deep_data") return "補充深化問卷後可試算";
  return g.gap > 0 ? `不足 ${fmtWan(g.gap)}` : "已足夠";
}

const css = `
.hcr { max-width: 720px; margin: 0 auto; padding: 32px 28px; color: #171717;
  font-family: -apple-system, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif; background:#fff; }
.hcr h2 { font-size: 15px; font-weight: 700; margin: 0 0 12px; }
.hcr-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px;
  padding-bottom:16px; border-bottom:2px solid #10b981; margin-bottom:20px; }
.hcr-kicker { font-size:12px; letter-spacing:2px; color:#059669; font-weight:600; }
.hcr-title { font-size:26px; font-weight:800; margin:4px 0 6px; }
.hcr-sub { font-size:13px; color:#666; }
.hcr-date { font-size:12px; color:#888; text-align:right; line-height:1.6; }
.hcr-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:16px; }
.hcr-stat { border:1px solid #eee; border-radius:12px; padding:14px; text-align:center; }
.hcr-stat-val { font-size:22px; font-weight:800; }
.hcr-stat-label { font-size:12px; color:#666; margin-top:2px; }
.hcr-stat-sub { font-size:11px; color:#aaa; }
.hcr-card { border:1px solid #eee; border-radius:14px; padding:18px; margin-bottom:16px; break-inside:avoid; }
.hcr-dist { display:flex; align-items:center; gap:24px; flex-wrap:wrap; }
.hcr-legend { list-style:none; margin:0; padding:0; flex:1; min-width:220px; }
.hcr-legend li { display:flex; align-items:center; gap:8px; font-size:13px; padding:3px 0; }
.hcr-dot { width:10px; height:10px; border-radius:50%; flex:none; }
.hcr-legend-label { flex:1; color:#444; }
.hcr-legend-val { font-weight:600; } .hcr-legend-val em { color:#999; font-style:normal; margin-left:6px; font-size:11px; }
.hcr-bar { display:flex; height:22px; border-radius:11px; overflow:hidden; background:#f1f5f9; }
.hcr-bar-legend { display:flex; justify-content:space-between; font-size:12px; color:#555; margin-top:8px; }
.hcr-gap { display:flex; justify-content:space-between; align-items:center; padding:10px 14px;
  border-radius:10px; margin-bottom:8px; font-size:14px; }
.hcr-gap.short { background:#fffbeb; border:1px solid #fde68a; }
.hcr-gap.ok { background:#ecfdf5; border:1px solid #a7f3d0; }
.hcr-gap.pending { background:#fafafa; border:1px dashed #ddd; }
.hcr-gap-name { font-weight:600; }
.hcr-gap.short .hcr-gap-val { color:#b45309; font-weight:700; }
.hcr-gap.ok .hcr-gap-val { color:#059669; font-weight:700; }
.hcr-gap.pending .hcr-gap-val { color:#999; font-size:12px; }
.hcr-note { font-size:11px; color:#888; line-height:1.6; margin:10px 0 0; background:#fafafa; padding:10px; border-radius:8px; }
.hcr-ins { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.hcr-ins-row { display:flex; justify-content:space-between; font-size:13px; padding:8px 12px; border-radius:8px; border:1px solid #eee; }
.hcr-ins-row.on { background:#ecfdf5; border-color:#a7f3d0; }
.hcr-ins-row.on span:last-child { color:#059669; font-weight:600; }
.hcr-ins-row.off span:last-child { color:#bbb; }
.hcr-calc { border:1px solid #eee; border-radius:10px; padding:12px; margin-bottom:10px; break-inside:avoid; }
.hcr-calc-title { font-size:13px; font-weight:700; }
.hcr-calc-formula { font-size:11px; color:#0369a1; background:#f0f9ff; padding:6px 8px; border-radius:6px; margin:6px 0; }
.hcr-calc-list { list-style:none; margin:0; padding:0; }
.hcr-calc-list li { display:flex; justify-content:space-between; font-size:12px; padding:2px 0; color:#555; border-bottom:1px dashed #f0f0f0; }
.hcr-calc-result { text-align:right; font-size:13px; font-weight:700; margin-top:6px; }
.hcr-advisor { background:#f0f9ff; border-color:#bae6fd; }
.hcr-dims { display:grid; gap:8px; margin-bottom:12px; }
.hcr-dim { font-size:13px; padding:8px 12px; background:#fff; border:1px solid #e0f2fe; border-radius:8px; }
.hcr-dim strong { margin-right:8px; }
.hcr-dim span { color:#666; }
.hcr-reco { font-size:14px; line-height:1.8; white-space:pre-wrap; margin:0; }
.hcr-sign { margin-top:14px; padding-top:12px; border-top:1px solid #bae6fd; font-size:13px; color:#333; }
.hcr-lic { color:#0369a1; margin-left:6px; font-size:12px; }
.hcr-foot { font-size:11px; color:#999; text-align:center; margin-top:20px; line-height:1.7; }
@media print {
  .hcr { max-width:none; padding:0; }
  /* 自然分頁:每個卡片/區塊盡量不跨頁截斷,內容合理流到下一頁 */
  .hcr-card, .hcr-stats, .hcr-head, .hcr-calc, .hcr-ins-row { break-inside:avoid; page-break-inside:avoid; }
  .hcr h2 { break-after:avoid; page-break-after:avoid; }
  .hcr svg { break-inside:avoid; page-break-inside:avoid; }
  @page { margin: 14mm; }
}
`;
