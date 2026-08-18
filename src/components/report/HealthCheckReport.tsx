// 健檢報告 — §8 單一來源 HTML。自帶 <style>,不依賴 Tailwind,
// 同一份可用於:App 內閱讀(RWD)、瀏覽器列印、後端無頭瀏覽器印 PDF。
import type { ReportModel } from "@/lib/domain/report";
import { fmtWan } from "@/lib/domain/report";
import type { PersonalStatements } from "@/lib/domain/statements";
import { FamilyTree } from "./FamilyTree";
import { InheritanceHint } from "./InheritanceHint";
import { computeInheritance } from "@/lib/domain/inheritance";
import { groupLicensesByCategory, type AdvisorLicense } from "@/lib/domain/licenses";

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

      {/* 家庭財務報表(參考公司三表結構) */}
      <PersonalStatementsBlock s={model.statements} />

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
          <span><i className="hcr-ldot" style={{ background: "#8b5cf6" }} />保障型 {fmtWan(model.summary.protection)}</span>
          <span>投資型 {fmtWan(model.summary.investment)}<i className="hcr-ldot" style={{ background: "#0ea5e9" }} /></span>
        </div>
      </section>

      {/* 投資組合分析(投資型保單以帳戶價值計,保額不列入) */}
      {(() => {
        const inv = model.assets.filter((a) => a.category === "投資" && a.amount > 0);
        const invTotal = inv.reduce((s, a) => s + a.amount, 0);
        if (invTotal === 0) return null;
        return (
          <section className="hcr-card">
            <h2>投資組合分析</h2>
            <ul className="hcr-invest">
              {inv.map((a) => {
                const p = Math.round((a.amount / invTotal) * 100);
                return (
                  <li key={a.label}>
                    <div className="hcr-invest-row">
                      <span>{a.label}</span>
                      <span>{fmtWan(a.amount)}<em>{p}%</em></span>
                    </div>
                    <div className="hcr-invest-bar"><div style={{ width: `${p}%` }} /></div>
                  </li>
                );
              })}
            </ul>
            <div className="hcr-invest-total"><span>投資資產合計</span><span>{fmtWan(invTotal)}</span></div>
            <p className="hcr-note">投資型/儲蓄保單以「帳戶價值(現金價值)」計入,身故保額不列入投資統計,以反映實際可運用的投資部位。</p>
          </section>
        );
      })()}

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
          <p style={{ margin: 0, fontSize: 20, lineHeight: 1.8 }}>
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
                <div style={{ fontSize: 20, fontWeight: 700, color: "#334155", margin: "4px 0" }}>{m.member}</div>
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
          <h2>家族關係圖與法定繼承順位</h2>
          <div className="hcr-genogram">
            <div className="hcr-genogram-tree">
              <FamilyTree family={model.family} selfIsFemale={model.family.selfIsFemale} />
            </div>
            <InheritanceHint result={computeInheritance(model.family)} />
          </div>
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

      {/* 缺口補足建議(完整版) */}
      {full && model.solutions.length > 0 && (
        <section className="hcr-card">
          <h2>缺口補足建議</h2>
          {model.solutions.map((s) => (
            <div key={s.name} className="hcr-gap short">
              <span className="hcr-gap-name">
                {s.name}
                <span style={{ fontWeight: 400, color: "#888", marginLeft: 8, fontSize: 18 }}>缺 {Math.round(s.gap).toLocaleString("zh-TW")} 萬 · {s.action}</span>
              </span>
              <span className="hcr-gap-val">
                {s.monthly != null ? `每月 ${s.monthly.toLocaleString("zh-TW")} 萬` : s.lump != null ? `補足 ${Math.round(s.lump).toLocaleString("zh-TW")} 萬` : ""}
              </span>
            </div>
          ))}
          <p className="hcr-note">為客觀試算之補足方向估計,實際規劃與商品配置由顧問依專業判斷提供。</p>
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
                  <div className="hcr-dim-title">{d.title}</div>
                  <div className="hcr-dim-desc">{d.desc}</div>
                </div>
              ))}
            </div>
          )}
          {model.advisorRecommendation && <p className="hcr-reco">{model.advisorRecommendation}</p>}
          {model.advisorSignature && (
            <div className="hcr-sign">
              <div className="hcr-sign-name">規劃顧問:{model.advisorSignature.name}</div>
              {(model.advisorSignature.company || model.advisorSignature.title) && (
                <div className="hcr-sign-org">
                  {[model.advisorSignature.company, model.advisorSignature.title].filter(Boolean).join(" · ")}
                </div>
              )}
              {model.advisorSignature.licenses.length > 0 && (
                <div className="hcr-sign-lics">
                  {groupLicensesByCategory(model.advisorSignature.licenses as AdvisorLicense[]).map((g) => (
                    <div key={g.category} className="hcr-sign-licrow">
                      <span className="hcr-sign-cat">{g.category}</span>
                      {g.items.map((l, i) => (
                        <span key={i} className="hcr-sign-lic">
                          {l.type}
                          {l.number && <span className="hcr-sign-licno">{l.number}</span>}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
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

// 水平堆疊條(資產負債表 / 損益表用)
function StackBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  return (
    <div style={{ margin: "6px 0 2px" }}>
      <div style={{ display: "flex", height: 20, borderRadius: 10, overflow: "hidden", background: "#f1f5f9" }}>
        {segments.map((s) => s.value > 0 && <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6, fontSize: 17, color: "#555" }}>
        {segments.map((s) => (
          <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, display: "inline-block" }} />
            {s.label} {fmtWan(s.value)}（{Math.round((s.value / total) * 100)}%）
          </span>
        ))}
      </div>
    </div>
  );
}

// 現金流量瀑布圖(流入 → 流出 → 淨流)
function Waterfall({ inflow, outflow, net }: { inflow: number; outflow: number; net: number }) {
  const maxV = Math.max(inflow, 0.01);
  const W = 300, H = 118, top = 10, bottom = H - 26, plotH = bottom - top, barW = 56;
  const xs = [24, 24 + barW + 40, 24 + (barW + 40) * 2];
  const y = (v: number) => bottom - (Math.max(0, v) / maxV) * plotH;
  const bars = [
    { x: xs[0], y0: bottom, y1: y(inflow), color: "#10b981", label: "流入", val: inflow },
    { x: xs[1], y0: y(inflow), y1: y(net), color: "#f59e0b", label: "流出", val: outflow },
    { x: xs[2], y0: bottom, y1: y(net), color: net >= 0 ? "#0ea5e9" : "#ef4444", label: "淨流", val: net },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 320 }} role="img" aria-label="現金流量瀑布圖">
      <line x1="12" y1={bottom} x2={W - 8} y2={bottom} stroke="#e5e7eb" strokeWidth="1" />
      {/* 連接虛線 */}
      <line x1={xs[0] + barW} y1={y(inflow)} x2={xs[1]} y2={y(inflow)} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
      <line x1={xs[1] + barW} y1={y(net)} x2={xs[2]} y2={y(net)} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
      {bars.map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={Math.min(b.y0, b.y1)} width={barW} height={Math.abs(b.y1 - b.y0) || 1} rx="3" fill={b.color} />
          <text x={b.x + barW / 2} y={bottom + 12} textAnchor="middle" fontSize="11" fill="#334155">{b.label}</text>
          <text x={b.x + barW / 2} y={bottom + 23} textAnchor="middle" fontSize="10" fill="#64748b">{fmtWan(b.val)}</text>
        </g>
      ))}
    </svg>
  );
}

function PersonalStatementsBlock({ s }: { s: PersonalStatements }) {
  const bs = s.balanceSheet;
  const is = s.incomeStatement;
  const cf = s.cashFlow;
  return (
    <section className="hcr-card">
      <h2>家庭財務報表</h2>
      <p className="hcr-note" style={{ marginTop: 0, marginBottom: 10 }}>參考公司三表結構,依會計邏輯分列:資產負債表、損益表、現金流量表(以家庭為單位)。</p>

      {/* ① 資產負債表 */}
      <div className="hcr-stmt">
        <div className="hcr-stmt-title">① 資產負債表(資產 = 負債 + 淨值)</div>
        <div className="hcr-stmt-grid">
          <div>
            <div className="hcr-stmt-sub">資產</div>
            {bs.assets.map((a) => (
              <div key={a.label} className="hcr-stmt-row"><span>{a.label}</span><span>{fmtWan(a.amount)}</span></div>
            ))}
            <div className="hcr-stmt-row total"><span>資產總額</span><span>{fmtWan(bs.totalAssets)}</span></div>
          </div>
          <div>
            <div className="hcr-stmt-sub">負債</div>
            {bs.liabilities.length ? bs.liabilities.map((l) => (
              <div key={l.label} className="hcr-stmt-row"><span>{l.label}</span><span>{fmtWan(l.amount)}</span></div>
            )) : <div className="hcr-stmt-row"><span>無負債</span><span>0</span></div>}
            <div className="hcr-stmt-row total"><span>負債總額</span><span>{fmtWan(bs.totalLiabilities)}</span></div>
            <div className="hcr-stmt-row total" style={{ color: "#059669" }}><span>淨值</span><span>{fmtWan(bs.netWorth)}</span></div>
          </div>
        </div>
        <StackBar segments={[{ label: "負債", value: bs.totalLiabilities, color: "#f59e0b" }, { label: "淨值", value: Math.max(0, bs.netWorth), color: "#10b981" }]} />
      </div>

      {/* ② 損益表 */}
      <div className="hcr-stmt">
        <div className="hcr-stmt-title">② 損益表 · 年(收入 − 支出 = 結餘)</div>
        {is.income.map((l) => (
          <div key={l.label} className="hcr-stmt-row"><span>{l.label}{l.tag ? ` (${l.tag})` : ""}</span><span>{fmtWan(l.amount)}</span></div>
        ))}
        <div className="hcr-stmt-row total"><span>年收入合計</span><span>{fmtWan(is.totalIncome)}</span></div>
        <div className="hcr-stmt-row"><span>年支出(推估)</span><span>−{fmtWan(is.totalExpense)}</span></div>
        <div className="hcr-stmt-row total" style={{ color: "#059669" }}><span>年結餘</span><span>{fmtWan(is.surplus)}</span></div>
        {is.incomeTax != null && (
          <>
            <div className="hcr-stmt-row"><span>綜所稅(估)</span><span>−{fmtWan(is.incomeTax)}</span></div>
            <div className="hcr-stmt-row"><span>稅後所得</span><span>{fmtWan(is.afterTaxIncome ?? 0)}</span></div>
            <div className="hcr-stmt-note">邊際稅率 {Math.round((is.marginalRate ?? 0) * 100)}%</div>
          </>
        )}
        <StackBar segments={[{ label: "支出", value: is.totalExpense, color: "#94a3b8" }, { label: "結餘", value: Math.max(0, is.surplus), color: "#10b981" }]} />
        {is.passiveIncome > 0 && (
          <>
            <div className="hcr-stmt-note" style={{ marginTop: 8 }}>收入結構(主動 vs 被動)</div>
            <StackBar segments={[{ label: "被動收入", value: is.passiveIncome, color: "#0ea5e9" }, { label: "其他收入", value: Math.max(0, is.totalIncome - is.passiveIncome), color: "#cbd5e1" }]} />
          </>
        )}
      </div>

      {/* ③ 現金流量表 */}
      <div className="hcr-stmt">
        <div className="hcr-stmt-title">③ 現金流量表 · 月(流入 − 流出 = 淨現金流)</div>
        <div className="hcr-stmt-row"><span>每月現金流入(收入)</span><span>{fmtWan(cf.inflow)}</span></div>
        <div className="hcr-stmt-row"><span>每月現金流出(支出,含還款 {fmtWan(cf.debtPayment)})</span><span>−{fmtWan(cf.outflow)}</span></div>
        <div className="hcr-stmt-row total" style={{ color: cf.net >= 0 ? "#059669" : "#b45309" }}><span>每月淨現金流</span><span>{fmtWan(cf.net)}</span></div>
        <div style={{ marginTop: 8 }}><Waterfall inflow={cf.inflow} outflow={cf.outflow} net={cf.net} /></div>
      </div>
    </section>
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
.hcr h2 { font-size: 23px; font-weight: 700; margin: 0 0 12px; }
.hcr-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px;
  padding-bottom:16px; border-bottom:2px solid #10b981; margin-bottom:20px; }
.hcr-kicker { font-size:18px; letter-spacing:2px; color:#059669; font-weight:600; }
.hcr-title { font-size:39px; font-weight:800; margin:4px 0 6px; }
.hcr-sub { font-size:20px; color:#666; }
.hcr-date { font-size:18px; color:#888; text-align:right; line-height:1.6; }
.hcr-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:16px; }
.hcr-stat { border:1px solid #eee; border-radius:12px; padding:14px; text-align:center; }
.hcr-stat-val { font-size:33px; font-weight:800; }
.hcr-stat-label { font-size:18px; color:#666; margin-top:2px; }
.hcr-stat-sub { font-size:17px; color:#aaa; }
.hcr-card { background:#fcfdfe; border:1px solid #e9edf2; border-radius:14px; padding:18px; margin-bottom:16px; break-inside:avoid; }
.hcr-dist { display:flex; align-items:center; gap:24px; flex-wrap:wrap; }
.hcr-legend { list-style:none; margin:0; padding:0; flex:1; min-width:220px; }
.hcr-legend li { display:flex; align-items:center; gap:8px; font-size:20px; padding:3px 0; }
.hcr-dot { width:10px; height:10px; border-radius:50%; flex:none; }
.hcr-legend-label { flex:1; color:#444; }
.hcr-legend-val { font-weight:600; } .hcr-legend-val em { color:#999; font-style:normal; margin-left:6px; font-size:17px; }
.hcr-bar { display:flex; height:22px; border-radius:11px; overflow:hidden; background:#f1f5f9; }
.hcr-bar-legend { display:flex; justify-content:space-between; align-items:center; font-size:18px; color:#555; margin-top:8px; }
.hcr-ldot { display:inline-block; width:10px; height:10px; border-radius:50%; vertical-align:middle; margin:0 6px; }
.hcr-gap { display:flex; justify-content:space-between; align-items:center; padding:10px 14px;
  border-radius:10px; margin-bottom:8px; font-size:21px; }
.hcr-gap.short { background:#fffbeb; border:1px solid #fde68a; }
.hcr-gap.ok { background:#ecfdf5; border:1px solid #a7f3d0; }
.hcr-gap.pending { background:#fafafa; border:1px dashed #ddd; }
.hcr-gap-name { font-weight:600; }
.hcr-gap.short .hcr-gap-val { color:#b45309; font-weight:700; }
.hcr-gap.ok .hcr-gap-val { color:#059669; font-weight:700; }
.hcr-gap.pending .hcr-gap-val { color:#999; font-size:18px; }
.hcr-note { font-size:17px; color:#888; line-height:1.6; margin:10px 0 0; background:#fafafa; padding:10px; border-radius:8px; }
.hcr-invest { list-style:none; margin:0; padding:0; }
.hcr-invest li { margin-bottom:9px; }
.hcr-invest-row { display:flex; justify-content:space-between; font-size:19px; }
.hcr-invest-row em { color:#94a3b8; font-style:normal; margin-left:8px; font-size:16px; }
.hcr-invest-bar { margin-top:4px; height:7px; border-radius:4px; background:#eef2f6; overflow:hidden; }
.hcr-invest-bar > div { height:100%; border-radius:4px; background:#0ea5e9; }
.hcr-invest-total { display:flex; justify-content:space-between; font-size:19px; font-weight:700; color:#0369a1; border-top:1px solid #e5eef5; margin-top:4px; padding-top:8px; }
.hcr-ins { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.hcr-ins-row { display:flex; justify-content:space-between; font-size:20px; padding:8px 12px; border-radius:8px; border:1px solid #eee; }
.hcr-ins-row.on { background:#ecfdf5; border-color:#a7f3d0; }
.hcr-ins-row.on span:last-child { color:#059669; font-weight:600; }
.hcr-ins-row.off span:last-child { color:#bbb; }
.hcr-calc { background:#f8fafc; border:1px solid #eaeef3; border-radius:10px; padding:12px; margin-bottom:10px; break-inside:avoid; }
.hcr-calc-title { font-size:20px; font-weight:700; }
.hcr-calc-formula { font-size:17px; color:#475569; background:#eef2f6; padding:6px 8px; border-radius:6px; margin:6px 0; }
.hcr-calc-list { list-style:none; margin:0; padding:0; }
.hcr-calc-list li { display:flex; justify-content:space-between; font-size:18px; padding:2px 0; color:#555; border-bottom:1px dashed #f0f0f0; }
.hcr-calc-result { text-align:right; font-size:20px; font-weight:700; margin-top:6px; }
.hcr-stmt { background:#f8fafc; border:1px solid #eaeef3; border-radius:10px; padding:12px; margin-bottom:10px; break-inside:avoid; }
.hcr-stmt-title { font-size:20px; font-weight:700; color:#334155; margin-bottom:6px; }
.hcr-stmt-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.hcr-stmt-sub { font-size:17px; color:#94a3b8; border-bottom:1px solid #eee; padding-bottom:2px; margin-bottom:2px; }
.hcr-stmt-row { display:flex; justify-content:space-between; font-size:18px; padding:2px 0; color:#555; }
.hcr-stmt-row.total { font-weight:700; color:#334155; border-top:1px solid #eee; margin-top:2px; padding-top:3px; }
.hcr-stmt-note { font-size:17px; color:#0369a1; margin-top:4px; }
.hcr-advisor { background:#f4faf6; border-color:#cfe9dd; }
.hcr-dims { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
.hcr-dim { padding:12px 14px; background:#fff; border:1px solid #dcece3; border-left:3px solid #10b981; border-radius:10px; break-inside:avoid; }
.hcr-dim-title { font-size:19px; font-weight:700; color:#0f5132; }
.hcr-dim-desc { font-size:16px; color:#5b6b63; line-height:1.55; margin-top:3px; }
.hcr-reco { font-size:21px; line-height:1.8; white-space:pre-wrap; margin:0; }
.hcr-sign { margin-top:14px; padding-top:12px; border-top:1px solid #cfe9dd; font-size:20px; color:#333; }
.hcr-sign-name { font-weight:700; }
.hcr-sign-org { font-size:16px; color:#666; margin-top:3px; }
.hcr-sign-lics { margin-top:8px; display:flex; flex-direction:column; gap:5px; }
.hcr-sign-licrow { display:flex; flex-wrap:wrap; align-items:center; gap:6px; }
.hcr-sign-cat { font-size:14px; font-weight:700; color:#0369a1; min-width:104px; }
.hcr-sign-lic { display:inline-flex; align-items:center; gap:6px; border:1px solid #e2e8f0; background:#f8fafc; border-radius:6px; padding:2px 9px; font-size:16px; color:#334155; }
.hcr-sign-licno { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; color:#94a3b8; }
.hcr-lic { color:#0369a1; margin-left:6px; font-size:18px; }
.hcr-foot { font-size:17px; color:#999; text-align:center; margin-top:20px; line-height:1.7; }
/* 家族關係圖 + 繼承順位(左圖右表,窄螢幕/列印自動堆疊) */
.hcr-genogram { display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap; }
.hcr-genogram-tree { flex:1 1 300px; min-width:0; }
.hcr-inh { flex:1 1 300px; min-width:260px; border:1px solid #eee; border-radius:10px; padding:14px; background:#fafafa; break-inside:avoid; }
.hcr-inh-title { font-size:18px; font-weight:700; color:#334155; margin-bottom:10px; }
.hcr-inh-orders { list-style:none; margin:0 0 12px; padding:0; }
.hcr-inh-order { display:flex; align-items:baseline; gap:8px; font-size:16px; padding:6px 8px; border-radius:6px; margin-bottom:4px; border:1px solid transparent; }
.hcr-inh-order.active { background:#ecfdf5; border-color:#a7f3d0; }
.hcr-inh-order.present { background:#fff; border-color:#eee; }
.hcr-inh-order.none { color:#bbb; }
.hcr-inh-rank { font-weight:700; color:#059669; white-space:nowrap; }
.hcr-inh-order.none .hcr-inh-rank { color:#ccc; }
.hcr-inh-role { font-weight:600; }
.hcr-inh-order.none .hcr-inh-role { font-weight:500; }
.hcr-inh-note { margin-left:auto; font-size:14px; color:#777; text-align:right; }
.hcr-inh-order.active .hcr-inh-note { color:#059669; font-weight:600; }
.hcr-inh-headline { font-size:16px; font-weight:700; color:#0369a1; margin:6px 0 8px; line-height:1.5; }
.hcr-inh-tbl { width:100%; border-collapse:collapse; font-size:15px; }
.hcr-inh-tbl td { padding:4px 6px; border-bottom:1px dashed #eee; }
.hcr-inh-tbl td:nth-child(2), .hcr-inh-tbl td:nth-child(3) { text-align:right; color:#555; white-space:nowrap; }
.hcr-inh-caveat { font-size:14px; color:#b45309; margin:8px 0 0; line-height:1.6; }
.hcr-inh-cite { font-size:13px; color:#999; margin:10px 0 0; line-height:1.6; }
@media print {
  /* 列印時整體縮為 65%(螢幕顯示不受影響),讓每頁容納更多、字級更合宜 */
  .hcr { max-width:none; padding:0; zoom:0.65; }
  /* 自然分頁:每個卡片/區塊盡量不跨頁截斷,內容合理流到下一頁 */
  .hcr-card, .hcr-stats, .hcr-head, .hcr-calc, .hcr-ins-row { break-inside:avoid; page-break-inside:avoid; }
  .hcr h2 { break-after:avoid; page-break-after:avoid; }
  .hcr svg { break-inside:avoid; page-break-inside:avoid; }
  @page { margin: 14mm; }
}
`;
