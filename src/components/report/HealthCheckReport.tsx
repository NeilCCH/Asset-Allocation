// 健檢報告 — §8 單一來源 HTML。自帶 <style>，不依賴 Tailwind,
// 同一份可用於:App 內閱讀（RWD)、瀏覽器列印、後端無頭瀏覽器印 PDF。
import type { ReportModel } from "@/lib/domain/report";
import { fmtWan } from "@/lib/domain/report";
import type { PersonalStatements } from "@/lib/domain/statements";
import { FamilyTree } from "./FamilyTree";
import { InheritanceHint } from "./InheritanceHint";
import { computeInheritance } from "@/lib/domain/inheritance";
import { groupLicensesByCategory, type AdvisorLicense } from "@/lib/domain/licenses";

const GAP_FORMULA: Record<string, string> = {
  退休金缺口:
    "退休後總支出需求 −（現有可投資資產成長 + 未來平準投入 + 勞退/月退）。支出需求 = 退休首年支出（今日支出 ×(1+通膨)^距退休年數）後，退休期間再逐年通膨累加之名目總額；資產成長以年報酬複利；未來投入採每年固定金額（平投）以年報酬複利累積（保守，不假設退休後本金再成長）",
  保障缺口: "（未償負債 + 未來扶養支出 + 子女教育金） − （現有壽險保額 + 流動資產）",
  教育金缺口: "Σ 每位子女（每年教育+生活預算 × 就讀年數），依距就學年數以報酬率折現",
};

// 資產三分類配色
const CLASS_COLOR: Record<string, string> = {
  流動: "#0ea5e9",
  固定: "#f59e0b",
  風險: "#8b5cf6",
};
// 風險資產：穩定 vs 高風險
const RISK_COLOR: Record<string, string> = {
  穩定: "#10b981",
  風險: "#f43f5e",
};
// 收入分類配色（主動 / 被動 / 半被動）
const TAG_COLOR: Record<string, string> = {
  主動: "#0ea5e9",
  被動: "#10b981",
  半被動: "#8b5cf6",
  其他: "#94a3b8",
};

function Donut({ segments, centerLabel = "總資產", centerValue, size = 160, ariaLabel = "資產類別分布" }: { segments: { label: string; value: number; color: string }[]; centerLabel?: string; centerValue?: string; size?: number; ariaLabel?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 60;
  const C = 2 * Math.PI * R;
  const GAP = 2; // 區段間細縫
  // 各弧的長度與起始偏移（起始 = 前面各段長度和），以純計算取代 render 期間變數累加
  const arcs = segments.map((s, i) => {
    const len = (s.value / total) * C;
    const start = segments.slice(0, i).reduce((sum, x) => sum + (x.value / total) * C, 0);
    return { label: s.label, color: s.color, len, start };
  });
  return (
    <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label={ariaLabel}>
      <circle cx="80" cy="80" r={R} fill="none" stroke="#eef2f6" strokeWidth="26" />
      <g transform="rotate(-90 80 80)">
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth="26"
            strokeDasharray={`${Math.max(0, a.len - GAP)} ${C - a.len + GAP}`}
            strokeDashoffset={-a.start}
          />
        ))}
      </g>
      <text x="80" y="75" textAnchor="middle" fontSize="12" fill="#94a3b8">{centerLabel}</text>
      <text x="80" y="94" textAnchor="middle" fontSize="17" fontWeight="700" fill="#334155">{centerValue ?? fmtWan(total)}</text>
    </svg>
  );
}

// 收入結構圓環（依主動/被動/半被動上色）+ 圖例
function IncomeDonutBlock({ title, lines, total }: { title: string; lines: { label: string; amount: number; tag?: string }[]; total: number }) {
  const segs = lines
    .filter((l) => l.amount > 0)
    .map((l) => ({ label: l.label, value: l.amount, tag: l.tag, color: TAG_COLOR[l.tag ?? "其他"] ?? TAG_COLOR["其他"] }));
  return (
    <div className="hcr-income-donut">
      <div className="hcr-income-donut-title">{title}</div>
      {segs.length === 0 || total <= 0 ? (
        <p style={{ fontSize: 16, color: "#94a3b8", margin: "20px 0" }}>無持續性收入</p>
      ) : (
        <>
          <Donut segments={segs} centerLabel="年收入" centerValue={fmtWan(total)} size={140} ariaLabel={`${title}收入結構`} />
          <ul className="hcr-income-legend">
            {segs.map((s) => (
              <li key={s.label}>
                <span className="hcr-dot" style={{ background: s.color }} />
                <span className="hcr-income-legend-label">{s.label}{s.tag ? `（${s.tag}）` : ""}</span>
                <em>{Math.round((s.value / total) * 100)}%</em>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function HealthCheckReport({ model, variant = "full" }: { model: ReportModel; variant?: "simple" | "full" }) {
  const full = variant === "full";
  const family = model.family;
  // 資產分布以三分類（固定 / 流動 / 風險）呈現
  const segments = model.assetClasses.map((c) => ({
    label: c.assetClass,
    value: c.amount,
    color: CLASS_COLOR[c.assetClass] ?? "#94a3b8",
  }));

  // 健檢重點 — 客觀事實摘要（非建議）
  const topCls = [...model.assetClasses].sort((a, b) => b.amount - a.amount)[0];
  const computedGaps = model.gaps.filter((g) => g.result.status === "computed");
  const shortfalls = computedGaps.filter((g) => g.result.gap > 0).map((g) => g.name.replace(/缺口$/, ""));
  const pendingGaps = model.gaps.filter((g) => g.result.status === "needs_deep_data").length;
  const highlights: string[] = [];
  if (topCls) highlights.push(`資產以「${topCls.assetClass}資產」為主，約占 ${topCls.pct}%；流動資產占 ${model.summary.liquidPct}%、風險資產占 ${model.summary.riskPct}%。`);
  if (model.summary.protection > 0) highlights.push(`另有保險保障 ${fmtWan(model.summary.protection)}（個別顯示，不計入資產總額；若有保單價值準備金，可併入儲蓄保單計算）。`);
  if (shortfalls.length) highlights.push(`試算顯示 ${shortfalls.join("、")} 有缺口（詳見下方明細）。`);
  else if (computedGaps.length) highlights.push(`已試算之缺口項目均達標。`);
  if (pendingGaps > 0) highlights.push(`另有 ${pendingGaps} 項缺口待補充深化資料後試算。`);

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

      {/* 關鍵數字（資產總額不含保障型保單） */}
      <section className="hcr-stats">
        <Stat label="資產總額" value={fmtWan(model.summary.total)} sub="不含保險保障" />
        <Stat label="流動資產占比" value={`${model.summary.liquidPct}%`} sub={fmtWan(model.summary.liquid)} />
        <Stat label="風險資產占比" value={`${model.summary.riskPct}%`} sub={fmtWan(model.summary.riskTotal)} />
      </section>

      {/* 健檢重點（客觀摘要） */}
      {highlights.length > 0 && (
        <section className="hcr-highlights">
          <div className="hcr-hl-title">健檢重點</div>
          <ul>
            {highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 家庭財務報表（現況三表；客戶 + 顧問皆呈現） */}
      <PersonalStatementsBlock s={model.statements} />

      {/* 財務預估投影（至退休）— ⚠️ 顧問專屬，以分析格式呈現 */}
      {full && model.statements.projection && <FinancialProjectionBlock s={model.statements} />}

      {/* 資產分布（固定 / 流動 / 風險 三類；保障獨立） */}
      <section className="hcr-card">
        <h2>資產類別分布</h2>
        <div className="hcr-dist">
          <Donut segments={segments} />
          <ul className="hcr-legend">
            {model.assets.map((a) => (
              <li key={a.label}>
                <span className="hcr-dot" style={{ background: CLASS_COLOR[a.assetClass] ?? "#94a3b8" }} />
                <span className="hcr-legend-label">{a.label}</span>
                <span className="hcr-legend-val">{fmtWan(a.amount)}<em>{a.pct}%</em></span>
              </li>
            ))}
          </ul>
        </div>
        {model.summary.protection > 0 && (
          <>
            <div className="hcr-gap short" style={{ marginTop: 12 }}>
              <span className="hcr-gap-name">保險保障（個別顯示，不計入資產總額）</span>
              <span className="hcr-gap-val">{fmtWan(model.summary.protection)}</span>
            </div>
            <p className="hcr-note">保障型保單以「保障」性質列示，不視為可運用資產，故不計入資產總額；若該保單另有<strong>保單價值準備金（解約金）</strong>，其現金價值可另計入「儲蓄保單」納入資產評估。</p>
          </>
        )}
      </section>

      {/* 風險資產配置：穩定收益 vs 高風險 */}
      {model.riskAssets.total > 0 && (
        <section className="hcr-card">
          <h2>投資配置</h2>
          <div className="hcr-bar">
            <div style={{ width: `${model.riskAssets.stablePct}%`, background: RISK_COLOR.穩定 }} />
            <div style={{ flex: 1, background: RISK_COLOR.風險 }} />
          </div>
          <div className="hcr-bar-legend">
            <span><i className="hcr-ldot" style={{ background: RISK_COLOR.穩定 }} />穩定收益 {fmtWan(model.riskAssets.stable.total)}（{model.riskAssets.stablePct}%）</span>
            <span>風險報酬 {fmtWan(model.riskAssets.risky.total)}（{model.riskAssets.riskyPct}%）<i className="hcr-ldot" style={{ background: RISK_COLOR.風險 }} /></span>
          </div>
          <ul className="hcr-invest" style={{ marginTop: 12 }}>
            {[...model.riskAssets.stable.items.map((i) => ({ ...i, c: RISK_COLOR.穩定 })), ...model.riskAssets.risky.items.map((i) => ({ ...i, c: RISK_COLOR.風險 }))].map((a) => {
              const p = Math.round((a.amount / model.riskAssets.total) * 100);
              return (
                <li key={a.key}>
                  <div className="hcr-invest-row">
                    <span><i className="hcr-ldot" style={{ background: a.c }} />{a.label}</span>
                    <span>{fmtWan(a.amount)}<em>{p}%</em></span>
                  </div>
                  <div className="hcr-invest-bar"><div style={{ width: `${p}%`, background: a.c }} /></div>
                </li>
              );
            })}
          </ul>
          <div className="hcr-invest-total"><span>投資配置合計</span><span>{fmtWan(model.riskAssets.total)}</span></div>
          <p className="hcr-note">穩定收益型=收租不動產、黃金/貴金屬；風險報酬型=股票、基金/ETF、投資型保單、加密貨幣（投資型保單以帳戶價值計）。儲蓄保單、外幣、退休專戶等歸固定/流動，不列入投資配置。</p>
        </section>
      )}

      {/* 風險屬性與配置落差（⚠️ 顧問參考，僅完整版） */}
      {full && model.riskAllocation && (
        <section className="hcr-card hcr-advisor">
          <h2>風險屬性與配置落差（顧問參考）</h2>
          <div className="hcr-stats">
            <Stat label="風險屬性" value={`RR${model.riskAllocation.rr}`} sub={model.riskAllocation.profile} />
            <Stat label="現況風險投資" value={`${model.riskAllocation.currentRiskyPct}%`} sub="占風險資產" />
            <Stat label="參考目標" value={`${model.riskAllocation.targetRiskyPct}%`} sub={`落差 ${model.riskAllocation.gap > 0 ? "+" : ""}${model.riskAllocation.gap}%`} />
          </div>
          <RiskAllocGauge current={model.riskAllocation.currentRiskyPct} target={model.riskAllocation.targetRiskyPct} />
          <div className={`hcr-gap ${model.riskAllocation.status === "相符" ? "ok" : "short"}`} style={{ marginTop: 12 }}>
            <span className="hcr-gap-name">配置落差</span>
            <span className="hcr-gap-val">
              {model.riskAllocation.status}
              {model.riskAllocation.status !== "相符" ? `（${model.riskAllocation.gap > 0 ? "+" : ""}${model.riskAllocation.gap}%）` : ""}
            </span>
          </div>
          {model.riskAllocation.status !== "相符" && (() => {
            const ra = model.riskAllocation!;
            const shiftAmt = Math.round((Math.abs(ra.gap) / 100) * ra.riskTotal);
            const dir = ra.gap > 0 ? "由「風險報酬」移向「穩定收益」" : "由「穩定收益」移向「風險報酬」";
            return (
              <p className="hcr-alert">
                ⚠ 現況投資配置與風險屬性 RR{ra.rr} 之參考目標落差達 {ra.gap > 0 ? "+" : ""}{ra.gap}%
                ({ra.status}){ra.gap > 0 ? "，承擔風險高於屬性建議" : "，配置偏保守、可能不利長期報酬"};
                若要回到參考目標，約需將 <strong>{shiftAmt.toLocaleString("zh-TW")} 萬</strong> {dir}（現況風險資產 {fmtWan(ra.riskTotal)})。
                實際調整由顧問依專業判斷，或重新評估風險承受度。
              </p>
            );
          })()}
          <p className="hcr-note">
            依風險屬性 RR{model.riskAllocation.rr} 之參考目標「風險投資占風險資產約 {model.riskAllocation.targetRiskyPct}%」對照現況 {model.riskAllocation.currentRiskyPct}%,
            落差 {model.riskAllocation.gap > 0 ? "+" : ""}{model.riskAllocation.gap}%({model.riskAllocation.status})。此為客觀規則參考，實際配置由顧問依專業判斷提供。
          </p>
        </section>
      )}

      {/* 缺口概況 */}
      <section className="hcr-card">
        <h2>缺口概況（客觀試算）</h2>
        {model.gaps.map((g) => (
          <div key={g.name} className={`hcr-gap ${gapClass(g.result)}`}>
            <span className="hcr-gap-name">{g.name}</span>
            <span className="hcr-gap-val">{gapText(g.result)}</span>
          </div>
        ))}
        <p className="hcr-note">
          試算採透明公式與假設（報酬 {pctNum(model.params.returnRate)} / 通膨 {pctNum(model.params.inflationRate)} /
          預估餘命 {model.params.lifeExpectancy} 歲），屬客觀試算，不構成投資建議。
        </p>
      </section>

      {/* 退休金準備分析（⚠️ 顧問參考，僅完整版） */}
      {full && <RetirementReadinessBlock model={model} />}

      {/* 簡易版：提示完整報告洽顧問 */}
      {!full && (
        <section className="hcr-card hcr-advisor">
          <p style={{ margin: 0, fontSize: 20, lineHeight: 1.8 }}>
            本頁為<strong>簡易資產健檢摘要</strong>。完整報告（含現有保障總覽、遺產稅預估、各項計算明細與規劃建議）,
            請洽您的<strong>財富管理顧問</strong>。
          </p>
        </section>
      )}

      {/* 家戶保障總覽（保單健檢：本人 + 配偶 + 子女） */}
      {full && <HouseholdInsuranceBlock model={model} />}

      {/* 家系關係圖（完整版） */}
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
            {family.parents.length > 0 ? `、父母 ${family.parents.length} 位` : ""}
            {family.siblings.length > 0 ? `、兄弟姊妹 ${family.siblings.length} 位` : ""}
            {family.children.length > 0 ? `、子女 ${family.children.length} 位` : ""}
            {family.grandchildren > 0 ? `、孫子女 ${family.grandchildren} 位` : ""}
            。供遺產繼承順位與傳承規劃參考。
          </p>
        </section>
      )}

      {/* 遺產稅預估與傳承（達課稅標準才有，完整版） */}
      {full && model.estateTax && <EstateTaxBlock model={model} />}

      {/* 試算計算明細（供驗證，完整版） */}
      {full && (
      <section className="hcr-card">
        <h2>試算計算明細（供驗證）</h2>
        <p className="hcr-note">
          試算參數：年報酬 {pctNum(model.params.returnRate)} · 通膨 {pctNum(model.params.inflationRate)} ·
          {model.params.estRetireSalaryAnnual != null && model.params.estRetireSalaryAnnual > 0 ? ` 預估退休前薪資 ${fmtWan(model.params.estRetireSalaryAnnual)}/年 · ` : " "}
          預估餘命 {model.params.lifeExpectancy} 歲 ·
          所得替代率 {model.params.defaultRetireLifestylePct}% · 子女獨立年齡 {model.params.childIndependentAge} 歲
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
            <div className="hcr-calc-formula">（遺產總額 − 扣除額） × 稅率 − 累進差額</div>
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

      {/* 缺口補足建議（完整版） */}
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
          <p className="hcr-note">為客觀試算之補足方向估計，實際規劃與商品配置由顧問依專業判斷提供。</p>
        </section>
      )}

      {/* 顧問建議（顧問版才有） */}
      {(model.advisorRecommendation || model.selectedDimensions?.length) && (
        <section className="hcr-card hcr-advisor">
          <h2>顧問規劃建議</h2>
          {model.selectedDimensions && model.selectedDimensions.length > 0 && (
            <>
              <div className="hcr-sub-label">規劃面向</div>
              <div className="hcr-dims">
                {model.selectedDimensions.map((d) => (
                  <div key={d.title} className="hcr-dim">
                    <div className="hcr-dim-title">{d.title}</div>
                    <div className="hcr-dim-desc">{d.desc}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {model.advisorRecommendation && (
            <>
              <div className="hcr-sub-label">顧問建議</div>
              <p className="hcr-reco">{model.advisorRecommendation}</p>
            </>
          )}
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
                      <span className="hcr-sign-licgroup">
                        {g.items.map((l, i) => (
                          <span key={i} className="hcr-sign-lic">
                            {l.type}
                            {l.number && <span className="hcr-sign-licno">{l.number}</span>}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 計算公式與法源依據（揭露於報告最後，供顧問驗算） */}
      <section className="hcr-card">
        <h2>計算公式與法源依據（供驗算）</h2>
        <p className="hcr-note" style={{ marginTop: 0 }}>以下揭露報告各項試算所採用之公式與法令/理論依據，供顧問覆核。稅率、免稅額與扣除額等金額，均以主管機關/財政部最新公告為準。</p>
        <ul className="hcr-src">
          <li><b>資產負債表</b>：資產總額 − 負債總額 = 淨值（會計恆等式）。保障型保單不計入資產總額。</li>
          <li><b>未來值（複利終值）</b>：FV = PV × (1 + r)<sup>n</sup>,r 為年報酬率、n 為年數（財務管理 Time Value of Money）。</li>
          <li><b>年結餘持續投入（成長型年金終值）</b>：FV = PMT × [ (1+r)<sup>n</sup> − (1+g)<sup>n</sup> ] / (r − g),g 為年成長率（r = g 時以 n×PMT×(1+r)<sup>n−1</sup> 計）。</li>
          <li><b>貸款攤還</b>：月付金 = P × i / [ 1 − (1+i)<sup>−N</sup> ]；剩餘本金 = P × (1+i)<sup>m</sup> − PMT × [ (1+i)<sup>m</sup> − 1 ] / i(i 為月利率、N 為總期數、m 為已繳期數）。</li>
          <li><b>退休前薪資（互動參數）</b>：由顧問/客戶輸入「預估退休前薪資」，主動收入曲線自現況<b>線性推估</b>至該值：當年主動收入 = 現況 +（預估退休前薪資 − 現況）× t / n,t 為經過年數、n 為距退休年數。</li>
          <li><b>現金流趨勢三線</b>：主動收入（薪資）自現況線性推估至預估退休前薪資、退休即停止；被動收入依通膨率逐年複利；退休後併入勞退月領（《勞工退休金條例》新制個人專戶）；貸款還款隨本金餘額遞減至還清。</li>
          <li><b>綜合所得稅</b>：依《所得稅法》綜合所得淨額累進級距計算應納稅額與邊際稅率；免稅額、扣除額依財政部每年度公告。</li>
          <li><b>遺產稅</b>：依《遺產及贈與稅法》,（遺產總額 − 免稅額 − 各項扣除額） × 累進稅率 − 累進差額；免稅額與扣除額以國稅局公告為準。</li>
          <li><b>保險保障之計入</b>：保障型保單以風險移轉性質列示、不視為可運用資產，故不計入資產總額；其保單價值準備金（解約金）之現金價值可另計入「儲蓄保單」納入資產評估。</li>
          <li><b>投資配置與風險屬性落差</b>：以 KYC 風險屬性 RR 對應之參考目標比較現況風險投資占比，落差絕對值逾 10% 視為偏離並提示；為客觀規則參考，實際配置由顧問專業判斷。</li>
        </ul>
      </section>

      <footer className="hcr-foot">
        本報告為資產配置檢視與缺口試算，採透明公式與假設參數，<strong>僅供參考，以實際狀況及主管機關/國稅局核定為準</strong>；
        系統不推介任何金融商品，對客戶之規劃建議由具專業資格之顧問提供。
      </footer>
    </div>
  );
}

// 水平堆疊條（資產負債表 / 損益表用）
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

// 現金流量趨勢線圖（三線並進：主動收入 / 被動收入含勞退 / 貸款還款）
function CashFlowLines({ series, retireAge, loanEndAge }: { series: NonNullable<PersonalStatements["cashFlow"]["series"]>; retireAge: number; loanEndAge?: number }) {
  if (series.length < 2) return null;
  // 圖表區約占 2/3(plotW)，圖例區約占 1/3(mr)；整體加寬提升可讀性
  const W = 760, H = 320, ml = 50, mr = 224, mt = 24, mb = 48;
  const plotW = W - ml - mr, plotH = H - mt - mb;
  const minAge = series[0].age, maxAge = series[series.length - 1].age;
  const rawMax = Math.max(...series.flatMap((p) => [p.active, p.passive, p.debt]), 1);
  const niceMax = Math.ceil(rawMax / 5) * 5 || 5;
  const x = (age: number) => ml + ((age - minAge) / (maxAge - minAge || 1)) * plotW;
  const y = (v: number) => mt + plotH - (Math.max(0, v) / niceMax) * plotH;
  const toPath = (pts: { age: number; v: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const activePts = series.filter((p) => p.age <= retireAge && p.active > 0).map((p) => ({ age: p.age, v: p.active }));
  const passivePts = series.map((p) => ({ age: p.age, v: p.passive }));
  const debtPts = series.filter((p) => p.debt > 0.05).map((p) => ({ age: p.age, v: p.debt }));
  const activeEnd = activePts[activePts.length - 1];
  const passiveAtRetire = series.find((p) => p.age === retireAge);
  const debtEnd = debtPts[debtPts.length - 1];
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => niceMax * f);
  const COL = { active: "#2a78d6", passive: "#1baf7a", debt: "#eb6834" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 760, height: "auto", aspectRatio: `${W} / ${H}` }} role="img" aria-label="家庭現金流三線趨勢圖：主動收入隨薪資成長至退休停止，被動收入依通膨成長並於退休後併入勞退，貸款還款隨餘額遞減至還清">
      {/* Y 網格與刻度（萬/月） */}
      {gridY.map((v, i) => (
        <g key={i}>
          <line x1={ml} y1={y(v)} x2={ml + plotW} y2={y(v)} stroke={i === 0 ? "#cbd5e1" : "#eef2f6"} strokeWidth="1" />
          <text x={ml - 8} y={y(v) + 4} textAnchor="end" fontSize="13" fill="#94a3b8">{Math.round(v)}</text>
        </g>
      ))}
      <text x={ml - 8} y={mt - 9} textAnchor="end" fontSize="12" fill="#94a3b8">萬/月</text>
      {/* 里程碑：退休 / 還款結束 */}
      {loanEndAge != null && loanEndAge < maxAge && (
        <g>
          <line x1={x(loanEndAge)} y1={mt} x2={x(loanEndAge)} y2={mt + plotH} stroke="#e2c9b8" strokeWidth="1" strokeDasharray="3 3" />
          <text x={x(loanEndAge)} y={mt + plotH + 32} textAnchor="middle" fontSize="12" fill="#b45309">還款結束·{loanEndAge}</text>
        </g>
      )}
      <line x1={x(retireAge)} y1={mt} x2={x(retireAge)} y2={mt + plotH} stroke="#bcd4ee" strokeWidth="1" strokeDasharray="3 3" />
      <text x={x(retireAge)} y={mt + plotH + 32} textAnchor="middle" fontSize="12" fill="#185fa5">退休·{retireAge}</text>
      {/* X 端點年齡 */}
      <text x={ml} y={mt + plotH + 16} textAnchor="middle" fontSize="12" fill="#94a3b8">{minAge}</text>
      <text x={ml + plotW} y={mt + plotH + 16} textAnchor="middle" fontSize="12" fill="#94a3b8">{maxAge}</text>
      <text x={ml + plotW / 2} y={mt + plotH + 16} textAnchor="middle" fontSize="12" fill="#94a3b8">年齡</text>
      {/* 三條線 */}
      {debtPts.length > 1 && <path d={toPath(debtPts)} fill="none" stroke={COL.debt} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
      {passivePts.length > 1 && <path d={toPath(passivePts)} fill="none" stroke={COL.passive} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
      {activePts.length > 1 && <path d={toPath(activePts)} fill="none" stroke={COL.active} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
      {/* 端點標記 */}
      {debtEnd && <circle cx={x(debtEnd.age)} cy={y(debtEnd.v)} r="4" fill={COL.debt} stroke="#fff" strokeWidth="1.5" />}
      {/* 貸款還清年齡標註；置於端點上方避免與 X 軸年齡重疊 */}
      {debtEnd && (() => {
        const flip = x(debtEnd.age) > ml + plotW * 0.55;
        return (
          <text x={x(debtEnd.age) + (flip ? -8 : 8)} y={Math.max(mt + 9, y(debtEnd.v) - 8)} textAnchor={flip ? "end" : "start"} fontSize="13" fontWeight="700" fill={COL.debt}>
            {loanEndAge ?? debtEnd.age} 歲清償
          </text>
        );
      })()}
      {passiveAtRetire && <circle cx={x(retireAge)} cy={y(passiveAtRetire.passive)} r="3.5" fill={COL.passive} stroke="#fff" strokeWidth="1.5" />}
      {activeEnd && <circle cx={x(activeEnd.age)} cy={y(activeEnd.v)} r="4.5" fill="#fff" stroke={COL.active} strokeWidth="2.2" />}
      {/* 退休當年主動收入（推估終點）數值標註；靠右時翻到左側避免出界 */}
      {activeEnd && (() => {
        const flip = x(activeEnd.age) > ml + plotW * 0.55;
        const ly = Math.max(mt + 9, y(activeEnd.v) - 8);
        return (
          <text x={x(activeEnd.age) + (flip ? -9 : 9)} y={ly} textAnchor={flip ? "end" : "start"} fontSize="13" fontWeight="700" fill={COL.active}>
            退休 {activeEnd.v} 萬/月
          </text>
        );
      })()}
      {/* 退休後被動收入（含勞退）水準數值標註；置於端點下方避免與主動標籤重疊 */}
      {passiveAtRetire && (() => {
        const flip = x(retireAge) > ml + plotW * 0.55;
        const ly = Math.min(mt + plotH - 4, y(passiveAtRetire.passive) + 18);
        return (
          <text x={x(retireAge) + (flip ? -9 : 9)} y={ly} textAnchor={flip ? "end" : "start"} fontSize="13" fontWeight="700" fill={COL.passive}>
            退休後 {passiveAtRetire.passive} 萬/月
          </text>
        );
      })()}
      {/* 圖例（右側，約占 1/3；放大字級便於閱覽） */}
      <g fontSize="16">
        <rect x={ml + plotW + 20} y={mt + 14} width="15" height="15" rx="3" fill={COL.active} />
        <text x={ml + plotW + 44} y={mt + 27} fill="#334155">主動收入</text>
        <rect x={ml + plotW + 20} y={mt + 46} width="15" height="15" rx="3" fill={COL.passive} />
        <text x={ml + plotW + 44} y={mt + 59} fill="#334155">被動收入</text>
        <text x={ml + plotW + 44} y={mt + 79} fill="#94a3b8" fontSize="13">+ 勞退月領</text>
        <rect x={ml + plotW + 20} y={mt + 98} width="15" height="15" rx="3" fill={COL.debt} />
        <text x={ml + plotW + 44} y={mt + 111} fill="#334155">貸款還款</text>
      </g>
    </svg>
  );
}

// 三表金額配色：流入 / 正值=綠，流出 / 負值=紅（依使用者要求「正數綠、負數紅」)
const AMT_IN = "#059669";
const AMT_OUT = "#dc2626";
const netColor = (v: number) => (v >= 0 ? AMT_IN : AMT_OUT);

// 風險投資占比量尺：相符區間（目標±10%）綠帶 + 目標刻度 + 現況標記
function RiskAllocGauge({ current, target }: { current: number; target: number }) {
  const lo = Math.max(0, target - 10), hi = Math.min(100, target + 10);
  const c = Math.max(0, Math.min(100, current));
  const labelLeft = Math.max(8, Math.min(92, c));
  return (
    <div style={{ margin: "22px 0 4px" }}>
      <div style={{ position: "relative", height: 24, background: "#f1f5f9", borderRadius: 12 }}>
        <div style={{ position: "absolute", left: `${lo}%`, width: `${hi - lo}%`, top: 0, bottom: 0, background: "#d1fae5", borderRadius: 12 }} />
        <div style={{ position: "absolute", left: `${target}%`, top: -3, bottom: -3, width: 2, background: "#10b981" }} />
        <div style={{ position: "absolute", left: `${c}%`, top: -5, bottom: -5, width: 3, background: "#0f172a", transform: "translateX(-1.5px)" }} />
        <div style={{ position: "absolute", left: `${labelLeft}%`, top: -19, transform: "translateX(-50%)", fontSize: 14, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>現況 {current}%</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#94a3b8", marginTop: 6 }}>
        <span>0%</span>
        <span style={{ color: "#059669", fontWeight: 700 }}>相符區間 {lo}–{hi}%（目標 {target}%）</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// 家戶保障總覽：壽險保障缺口（家庭責任 vs 已備）+ 各成員投保完整度
function HouseholdInsuranceBlock({ model }: { model: ReportModel }) {
  const members = model.householdInsurance.filter((m) => m.rows.length > 0);
  if (members.length === 0) return null;
  const pg = model.gaps.find((x) => x.name === "保障缺口")?.result;
  return (
    <section className="hcr-card">
      <h2>家戶保障總覽</h2>

      {/* 壽險保障缺口：家庭責任 vs 已備 */}
      {pg && pg.status === "computed" && (() => {
        const bd: Record<string, number> = {};
        pg.breakdown.forEach((b) => { bd[b.label] = b.amount; });
        const debt = Math.max(0, bd["未償負債"] ?? 0);
        const support = Math.max(0, bd["扶養支出"] ?? 0);
        const edu = Math.max(0, bd["子女教育金"] ?? 0);
        const life = Math.abs(bd["現有壽險保額"] ?? 0);
        const liquid = Math.abs(bd["流動資產"] ?? 0);
        const need = debt + support + edu, have = life + liquid;
        const gap = pg.gap, covered = gap <= 0;
        const maxV = Math.max(need, have, 1);
        const w = (v: number) => `${Math.max(0, (v / maxV) * 100)}%`;
        const needSegs = [
          { label: "未償負債", value: debt, color: "#f59e0b" },
          { label: "扶養支出", value: support, color: "#fb923c" },
          { label: "子女教育金", value: edu, color: "#fbbf24" },
        ].filter((s) => s.value > 0);
        const haveSegs = [
          { label: "現有壽險保額", value: life, color: "#0ea5e9" },
          { label: "流動資產", value: liquid, color: "#10b981" },
        ].filter((s) => s.value > 0);
        return (
          <div style={{ marginBottom: 16 }}>
            <div className="hcr-sub-label">壽險保障缺口（家庭責任 vs 已備）</div>
            <div className="hcr-stats">
              <Stat label="家庭責任總額" value={fmtWan(need)} sub="負債 + 扶養 + 教育" />
              <Stat label="已備保障" value={fmtWan(have)} sub="壽險保額 + 流動資產" />
              <Stat label={covered ? "保障充足" : "壽險保障缺口"} value={fmtWan(Math.abs(gap))} sub={covered ? "已足夠" : "建議補足壽險"} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="hcr-cmp-row">
                <span className="hcr-cmp-tag">家庭責任</span>
                <div className="hcr-cmp-track">{needSegs.map((s) => <div key={s.label} style={{ width: w(s.value), background: s.color }} />)}</div>
                <span className="hcr-cmp-num">{fmtWan(need)}</span>
              </div>
              <div className="hcr-cmp-row">
                <span className="hcr-cmp-tag">已備保障</span>
                <div className="hcr-cmp-track">
                  {haveSegs.map((s) => <div key={s.label} style={{ width: w(s.value), background: s.color }} />)}
                  {!covered && <div style={{ width: w(gap), background: "repeating-linear-gradient(45deg, #ef4444, #ef4444 4px, #fca5a5 4px, #fca5a5 8px)" }} />}
                </div>
                <span className="hcr-cmp-num">{fmtWan(have)}</span>
              </div>
            </div>
            <div className="hcr-bar-legend" style={{ marginTop: 8, flexWrap: "wrap", gap: 14 }}>
              {[...needSegs, ...haveSegs].map((s) => <span key={s.label}><i className="hcr-ldot" style={{ background: s.color }} />{s.label} {fmtWan(s.value)}</span>)}
              {!covered && <span><i className="hcr-ldot" style={{ background: "#ef4444" }} />缺口 {fmtWan(gap)}</span>}
            </div>
            {covered ? (
              <div className="hcr-gap ok" style={{ marginTop: 10 }}>
                <span className="hcr-gap-name">壽險保障評估</span>
                <span className="hcr-gap-val">已足夠（盈餘 {fmtWan(Math.abs(gap))}）</span>
              </div>
            ) : (
              <p className="hcr-alert">⚠ 家庭責任 {fmtWan(need)} 高於已備保障 {fmtWan(have)}，壽險保障缺口約 <strong>{fmtWan(gap)}</strong>；建議增加壽險保額以覆蓋家庭責任，保障家人於事故時仍能清償負債並維持生活。</p>
            )}
          </div>
        );
      })()}

      {/* 各成員投保完整度 + 清單 */}
      {members.map((m) => {
        const on = m.rows.filter((r) => r.has).length, total = m.rows.length;
        const pct = Math.round((on / total) * 100);
        const col = pct >= 75 ? "#059669" : pct >= 50 ? "#d97706" : "#dc2626";
        return (
          <div key={m.member} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0" }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#334155" }}>{m.member}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: col }}>投保 {on}/{total} 項</span>
            </div>
            <div className="hcr-invest-bar" style={{ marginBottom: 6 }}><div style={{ width: `${pct}%`, background: col }} /></div>
            <div className="hcr-ins">
              {m.rows.map((r) => (
                <div key={r.label} className={`hcr-ins-row ${r.has ? "on" : "off"}`}>
                  <span>{r.has ? "✓ " : "✕ "}{r.label}</span>
                  <span>{r.has ? r.text : "尚無"}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="hcr-note">各險種單位不同：壽險/意外/重疾為保額（萬）、醫療為日額+實支實付、失能/長照為每月給付。壽險保障缺口 =（未償負債 + 未來扶養 + 子女教育）−（現有壽險保額 + 流動資產）；其餘險種為家戶保障完整度檢視，實際規劃由顧問依需求判斷。</p>
    </section>
  );
}

// 退休金準備分析：需求 vs 可累積（現有資產成長 + 未來投入 + 勞退）比較
function RetirementReadinessBlock({ model }: { model: ReportModel }) {
  const gr = model.gaps.find((x) => x.name === "退休金缺口")?.result;
  if (!gr || gr.status !== "computed") return null;
  const bd: Record<string, number> = {};
  gr.breakdown.forEach((b) => { bd[b.label] = b.amount; });
  const totalNeed = bd["退休後總支出需求"] ?? 0;
  const grown = Math.max(0, bd["現有資產成長估計"] ?? 0);
  const contrib = Math.max(0, bd["未來持續投入估計"] ?? 0);
  const pension = Math.abs(bd["退休金收入（勞退/月退）"] ?? 0);
  const accumulable = grown + contrib + pension;
  const gap = gr.gap; // = 總需求 − 可累積
  const covered = gap <= 0;
  const maxV = Math.max(totalNeed, accumulable, 1);
  const w = (v: number) => `${Math.max(0, (v / maxV) * 100)}%`;
  const monthly = model.solutions.find((s) => s.name === "退休金")?.monthly;
  const retireYears = Math.max(0, model.params.lifeExpectancy - model.profile.retireAge);
  const yearsToRetire = Math.max(0, model.profile.retireAge - model.profile.age);
  const COV = { grown: "#0ea5e9", contrib: "#10b981", pension: "#8b5cf6", gap: "#ef4444" };
  const segs = [
    { label: "現有資產成長", value: grown, color: COV.grown },
    { label: "未來持續投入", value: contrib, color: COV.contrib },
    { label: "勞退 / 月退", value: pension, color: COV.pension },
  ].filter((s) => s.value > 0);
  return (
    <section className="hcr-card hcr-advisor">
      <h2>退休金準備分析（顧問參考）</h2>
      <div className="hcr-stats">
        <Stat label="退休後總支出需求" value={fmtWan(totalNeed)} sub={`${model.profile.retireAge}→${model.params.lifeExpectancy} 歲 · 退休 ${retireYears} 年`} />
        <Stat label="退休可累積資產" value={fmtWan(accumulable)} sub="現有成長 + 未來投入 + 勞退" />
        <Stat label={covered ? "預估盈餘" : "退休金缺口"} value={fmtWan(Math.abs(gap))} sub={covered ? "已達標" : "尚需補足"} />
      </div>

      {/* 需求 vs 可累積 比較條（同一比例尺） */}
      <div style={{ marginTop: 14 }}>
        <div className="hcr-cmp-row">
          <span className="hcr-cmp-tag">總支出需求</span>
          <div className="hcr-cmp-track"><div style={{ width: w(totalNeed), background: "#f59e0b" }} /></div>
          <span className="hcr-cmp-num">{fmtWan(totalNeed)}</span>
        </div>
        <div className="hcr-cmp-row">
          <span className="hcr-cmp-tag">可累積資產</span>
          <div className="hcr-cmp-track">
            {segs.map((s) => <div key={s.label} style={{ width: w(s.value), background: s.color }} title={s.label} />)}
            {!covered && <div style={{ width: w(gap), background: `repeating-linear-gradient(45deg, ${COV.gap}, ${COV.gap} 4px, #fca5a5 4px, #fca5a5 8px)` }} title="缺口" />}
          </div>
          <span className="hcr-cmp-num">{fmtWan(accumulable)}</span>
        </div>
      </div>

      {/* 圖例 */}
      <div className="hcr-bar-legend" style={{ marginTop: 8, flexWrap: "wrap", gap: 14 }}>
        {segs.map((s) => <span key={s.label}><i className="hcr-ldot" style={{ background: s.color }} />{s.label} {fmtWan(s.value)}</span>)}
        {!covered && <span><i className="hcr-ldot" style={{ background: COV.gap }} />缺口 {fmtWan(gap)}</span>}
      </div>

      {/* 結論 */}
      {covered ? (
        <div className="hcr-gap ok" style={{ marginTop: 12 }}>
          <span className="hcr-gap-name">退休準備評估</span>
          <span className="hcr-gap-val">預估已達標（盈餘 {fmtWan(Math.abs(gap))}）</span>
        </div>
      ) : (
        <>
          <div className="hcr-gap short" style={{ marginTop: 12 }}>
            <span className="hcr-gap-name">退休準備評估</span>
            <span className="hcr-gap-val">不足 {fmtWan(gap)}</span>
          </div>
          {monthly != null && monthly > 0 && (
            <p className="hcr-alert">
              ⚠ 距退休 {yearsToRetire} 年，建議自現在起每月增加儲蓄約 <strong>{monthly.toLocaleString("zh-TW")} 萬</strong>（以年報酬 {pctNum(model.params.returnRate)} 複利、平準年金回推），即可補足退休金缺口。
            </p>
          )}
        </>
      )}

      <p className="hcr-note">
        總支出需求 = 退休首年支出（今日支出 ×(1+通膨 {pctNum(model.params.inflationRate)})<sup>{yearsToRetire}</sup>）後，退休期間 {retireYears} 年<strong>逐年再通膨累加</strong>之名目總額；
        退休首年支出依 {model.params.defaultRetireLifestylePct}% 所得替代率（或填報之退休後月支出）估算。
        可累積資產 = 現有可投資資產以年報酬 {pctNum(model.params.returnRate)} 複利 + 年結餘每年<strong>固定投入（平投）</strong>以年報酬複利 + 勞退/月退累積。
        <strong>保守估計</strong>：不假設退休後本金再成長。屬客觀試算，不構成投資建議。
      </p>
    </section>
  );
}

// 應繼分分數字串（"1/2"、"1")→ 數值
function parseFrac(s: string): number {
  if (!s) return 0;
  const [n, d] = s.split("/");
  const num = Number(n), den = d ? Number(d) : 1;
  return den ? num / den : 0;
}

// 遺產稅預估與傳承：稅 vs 淨傳承視覺化、扣除額明細、法定應繼分金額試算
function EstateTaxBlock({ model }: { model: ReportModel }) {
  const et = model.estateTax!;
  const netInherit = Math.max(0, et.grossEstate - et.tax);
  const taxPct = et.grossEstate > 0 ? Math.round((et.tax / et.grossEstate) * 100) : 0;
  const inh = computeInheritance(model.family);
  const bracketLabel = et.rate <= 0.1 ? "5,000 萬以下 10%" : et.rate <= 0.15 ? "5,000 萬–1 億 15%（累進差額 250 萬）" : "1 億以上 20%（累進差額 750 萬）";
  const w = (v: number) => `${et.grossEstate > 0 ? Math.max(0, (v / et.grossEstate) * 100) : 0}%`;
  return (
    <section className="hcr-card">
      <h2>遺產稅預估與傳承</h2>
      <div className="hcr-stats">
        <Stat label="遺產總額" value={fmtWan(et.grossEstate)} />
        <Stat label="課稅遺產淨額" value={fmtWan(et.netTaxable)} sub={`扣除額 ${fmtWan(et.totalDeductions)}`} />
        <Stat label="預估遺產稅" value={fmtWan(et.tax)} sub={`稅率 ${Math.round(et.rate * 100)}%`} />
        <Stat label="淨傳承（給繼承人）" value={fmtWan(netInherit)} sub={`占遺產 ${100 - taxPct}%`} />
      </div>

      {/* 稅 vs 淨傳承 */}
      <div className="hcr-cmp-row" style={{ marginTop: 12 }}>
        <span className="hcr-cmp-tag">遺產分配</span>
        <div className="hcr-cmp-track">
          <div style={{ width: w(netInherit), background: "#10b981" }} title="淨傳承" />
          <div style={{ width: w(et.tax), background: "#ef4444" }} title="遺產稅" />
        </div>
        <span className="hcr-cmp-num">{fmtWan(et.grossEstate)}</span>
      </div>
      <div className="hcr-bar-legend" style={{ marginTop: 8 }}>
        <span><i className="hcr-ldot" style={{ background: "#10b981" }} />淨傳承 {fmtWan(netInherit)}（{100 - taxPct}%）</span>
        <span>遺產稅 {fmtWan(et.tax)}（{taxPct}%）<i className="hcr-ldot" style={{ background: "#ef4444" }} /></span>
      </div>

      {/* 扣除額明細 */}
      <div className="hcr-sub-label" style={{ marginTop: 14 }}>扣除額明細</div>
      <div className="hcr-ins">
        {et.deductions.map((d) => (
          <div key={d.label} className="hcr-ins-row on"><span>{d.label}</span><span>{fmtWan(d.amount)}</span></div>
        ))}
      </div>

      {/* 法定應繼分預估分配 */}
      {inh.shares.length > 0 && netInherit > 0 && (
        <>
          <div className="hcr-sub-label" style={{ marginTop: 14 }}>法定應繼分 · 淨傳承預估分配</div>
          {inh.shares.map((s) => (
            <div key={s.role} className="hcr-gap ok">
              <span className="hcr-gap-name">
                {s.role}{s.count ? ` ×${s.count}` : ""}
                <span style={{ fontWeight: 400, color: "#888", marginLeft: 8, fontSize: 16 }}>應繼分 {s.total}{s.count && s.count > 1 ? `（每人 ${s.each})` : ""}</span>
              </span>
              <span className="hcr-gap-val">{fmtWan(netInherit * parseFrac(s.total))}</span>
            </div>
          ))}
          <p className="hcr-note">{inh.headline}{inh.caveat ? `;${inh.caveat}` : ""}。分配金額以「淨傳承」× 應繼分估計，未計特留分、遺囑指定或指定受益人之保單（身故保險金可跳脫遺產分配）。</p>
        </>
      )}

      <p className="hcr-note">
        依台灣現行遺產稅概數試算：免稅額 1,333 萬、喪葬 138 萬、配偶 493 萬、每位子女 56 萬、每位父母 138 萬、未償債務可扣除；適用級距:{bracketLabel}。
        傳承規劃方向：善用<strong>保單指定受益人</strong>、<strong>生前贈與</strong>（每年免稅贈與額）、<strong>預留稅源</strong>等，由顧問依家庭狀況規劃。實際以國稅局核定為準。
      </p>
    </section>
  );
}

function PersonalStatementsBlock({ s }: { s: PersonalStatements }) {
  const bs = s.balanceSheet;
  const is = s.incomeStatement;
  const cf = s.cashFlow;
  return (
    <section className="hcr-card">
      <h2>家庭財務報表（現況）</h2>
      <p className="hcr-note" style={{ marginTop: 0, marginBottom: 10 }}>參考公司三表結構，依會計邏輯分列：資產負債表、損益表、現金流量表（以家庭為單位）。<strong>本表僅呈現目前狀況</strong>；未來各項預估與趨勢另見「財務預估投影」。</p>

      {/* ① 資產負債表 */}
      <div className="hcr-stmt">
        <div className="hcr-stmt-title">① 資產負債表（資產 = 負債 + 淨值）</div>
        <div className="hcr-stmt-grid">
          <div>
            <div className="hcr-stmt-sub">資產</div>
            {bs.assets.map((a) => (
              <div key={a.label} className="hcr-stmt-row"><span>{a.label}</span><span style={{ color: AMT_IN }}>{fmtWan(a.amount)}</span></div>
            ))}
            <div className="hcr-stmt-row total"><span>資產總額</span><span style={{ color: AMT_IN }}>{fmtWan(bs.totalAssets)}</span></div>
          </div>
          <div>
            <div className="hcr-stmt-sub">負債</div>
            {bs.liabilities.length ? bs.liabilities.map((l) => (
              <div key={l.label} className="hcr-stmt-row"><span>{l.label}</span><span style={{ color: AMT_OUT }}>{fmtWan(l.amount)}</span></div>
            )) : <div className="hcr-stmt-row"><span>無負債</span><span style={{ color: AMT_IN }}>0</span></div>}
            <div className="hcr-stmt-row total"><span>負債總額</span><span style={{ color: AMT_OUT }}>{fmtWan(bs.totalLiabilities)}</span></div>
            <div className="hcr-stmt-row total"><span>淨值</span><span style={{ color: netColor(bs.netWorth) }}>{fmtWan(bs.netWorth)}</span></div>
          </div>
        </div>
        <StackBar segments={[{ label: "負債", value: bs.totalLiabilities, color: "#f59e0b" }, { label: "淨值", value: Math.max(0, bs.netWorth), color: "#10b981" }]} />
      </div>

      {/* ② 損益表 */}
      <div className="hcr-stmt">
        <div className="hcr-stmt-title">② 損益表 · 年（收入 − 支出 = 結餘）</div>
        {is.income.map((l) => (
          <div key={l.label} className="hcr-stmt-row"><span>{l.label}{l.tag ? `（${l.tag}）` : ""}</span><span style={{ color: AMT_IN }}>{fmtWan(l.amount)}</span></div>
        ))}
        <div className="hcr-stmt-row total"><span>年收入合計</span><span style={{ color: AMT_IN }}>{fmtWan(is.totalIncome)}</span></div>
        <div className="hcr-stmt-row"><span>年支出（推估）</span><span style={{ color: AMT_OUT }}>−{fmtWan(is.totalExpense)}</span></div>
        <div className="hcr-stmt-row total"><span>年結餘</span><span style={{ color: netColor(is.surplus) }}>{fmtWan(is.surplus)}</span></div>
        {is.incomeTax != null && (
          <>
            <div className="hcr-stmt-row"><span>綜所稅（估）</span><span style={{ color: AMT_OUT }}>−{fmtWan(is.incomeTax)}</span></div>
            <div className="hcr-stmt-row"><span>稅後所得</span><span style={{ color: AMT_IN }}>{fmtWan(is.afterTaxIncome ?? 0)}</span></div>
            <div className="hcr-stmt-note">邊際稅率 {Math.round((is.marginalRate ?? 0) * 100)}%</div>
          </>
        )}
        <StackBar segments={[{ label: "支出", value: is.totalExpense, color: "#94a3b8" }, { label: "結餘", value: Math.max(0, is.surplus), color: "#10b981" }]} />
        {/* 收入結構圓環（現況：工作期間） */}
        <div className="hcr-stmt-note" style={{ marginTop: 10 }}>收入結構（現況）</div>
        <div className="hcr-income-donuts">
          <IncomeDonutBlock title="工作期間" lines={is.income} total={is.totalIncome} />
        </div>
      </div>

      {/* ③ 現金流量表 */}
      <div className="hcr-stmt">
        <div className="hcr-stmt-title">③ 現金流量表 · 月（流入 − 流出 = 淨現金流）</div>
        <div className="hcr-stmt-row"><span>每月現金流入（收入）</span><span style={{ color: AMT_IN }}>{fmtWan(cf.inflow)}</span></div>
        <div className="hcr-stmt-row"><span>每月現金流出（支出，含還款 {fmtWan(cf.debtPayment)}）</span><span style={{ color: AMT_OUT }}>−{fmtWan(cf.outflow)}</span></div>
        <div className="hcr-stmt-row total"><span>每月淨現金流</span><span style={{ color: netColor(cf.net) }}>{fmtWan(cf.net)}</span></div>
        {cf.fixedExpense && (
          <div style={{ marginTop: 10, borderTop: "1px solid #eaeef3", paddingTop: 8 }}>
            <div className="hcr-stmt-note">每月固定支出明細（萬/月）</div>
            {cf.fixedExpense.map((l) => (
              <div key={l.label} className="hcr-stmt-row"><span>{l.label}</span><span style={{ color: AMT_OUT }}>−{fmtWan(l.amount)}</span></div>
            ))}
            <div className="hcr-stmt-row total"><span>每月固定支出合計</span><span style={{ color: AMT_OUT }}>−{fmtWan(cf.fixedExpenseTotal ?? 0)}</span></div>
          </div>
        )}
        {cf.annualSpecial && (
          <div style={{ marginTop: 10, borderTop: "1px solid #eaeef3", paddingTop: 8 }}>
            <div className="hcr-stmt-note">年度特別預算明細（萬/年 · 與每月支出分開計算）</div>
            {cf.annualSpecial.map((l) => (
              <div key={l.label} className="hcr-stmt-row"><span>{l.label}</span><span style={{ color: AMT_OUT }}>−{fmtWan(l.amount)}</span></div>
            ))}
            <div className="hcr-stmt-row total"><span>年度特別預算合計</span><span style={{ color: AMT_OUT }}>−{fmtWan(cf.annualSpecialTotal ?? 0)} / 年</span></div>
            <div className="hcr-stmt-note" style={{ marginTop: 4 }}>折合每月約 {fmtWan(cf.annualSpecialMonthly ?? 0)}（僅供比較；此為年度支出，已與每月固定支出分列，未重複計入）。</div>
          </div>
        )}
      </div>
    </section>
  );
}

// 財務預估投影（至退休）— 顧問專屬。以分析/圖表格式呈現，不套用三表版面。
function FinancialProjectionBlock({ s }: { s: PersonalStatements }) {
  const proj = s.projection;
  if (!proj) return null;
  const bs = s.balanceSheet, is = s.incomeStatement, cf = s.cashFlow;
  return (
    <section className="hcr-card hcr-advisor">
      <h2>財務預估投影（至退休 · 顧問參考）</h2>
      <p className="hcr-note" style={{ marginTop: 0 }}>
        以財務計算機概念投影 {proj.years} 年到 {proj.retireAge} 歲：資產以年報酬 {pctNum(proj.returnRate)} 複利、並持續投入年結餘（成長型年金）；主動收入（薪資）自現況<strong>線性推估</strong>至「預估退休前薪資」{cf.estRetireSalaryUsed != null ? `（${fmtWan(cf.estRetireSalaryUsed)}/年）` : ""}、被動收入依通膨、支出依通膨 {pctNum(proj.inflationRate)}。屬試算假設、非保證；貨幣具時間價值，今日金額與退休時金額不可直接比較。
      </p>

      {/* 現金流三線趨勢圖（主圖） */}
      {cf.series && cf.retireAge != null && (
        <>
          <div className="hcr-sub-label" style={{ marginTop: 4 }}>現金流趨勢（主動 / 被動含勞退 / 貸款，萬/月）</div>
          <div style={{ marginTop: 4 }}><CashFlowLines series={cf.series} retireAge={cf.retireAge} loanEndAge={cf.loanEndAge} /></div>
          <p className="hcr-note">主動收入自現況線性推估至預估退休前薪資，退休即停止（空心圈）；被動收入依通膨成長，退休後併入勞退月領（綠點起跳）；貸款還款隨本金餘額遞減至還清（實心點）。</p>
        </>
      )}

      {/* 退休時淨值投影 */}
      {bs.futureNetWorth != null && (
        <>
          <div className="hcr-sub-label" style={{ marginTop: 14 }}>退休時淨值投影</div>
          <div className="hcr-stats">
            <Stat label="退休時資產" value={fmtWan(bs.futureAssets ?? 0)} sub="現值複利 + 年結餘投入" />
            <Stat label="退休時負債" value={fmtWan(bs.futureLiabilities ?? 0)} sub="本息攤還後餘額" />
            <Stat label="退休時淨值" value={fmtWan(bs.futureNetWorth)} sub="資產 − 負債" />
          </div>
          {bs.futurePlannedLoan != null && bs.futurePlannedLoan > 0 && (
            <p className="hcr-note" style={{ color: "#b91c1c", background: "#fef2f2" }}>其中含新增貸款計劃於退休時剩餘本金 {fmtWan(bs.futurePlannedLoan)}；若用於購置資產，該資產價值未納入本試算。</p>
          )}
        </>
      )}

      {/* 退休當年收支投影 */}
      {is.futureSurplus != null && (
        <>
          <div className="hcr-sub-label" style={{ marginTop: 14 }}>退休當年收支投影</div>
          <div className="hcr-stats">
            <Stat label="退休當年年收入" value={fmtWan(is.futureIncome ?? 0)} sub="薪資推估 + 被動（通膨）" />
            <Stat label="退休當年年支出" value={fmtWan(is.futureExpense ?? 0)} sub="依通膨成長" />
            <Stat label="退休當年年結餘" value={fmtWan(is.futureSurplus)} sub="收入 − 支出" />
          </div>
          {cf.futureNet != null && <div className="hcr-stmt-note" style={{ marginTop: 6 }}>退休前每月淨現金流（未來值）:{fmtWan(cf.futureNet)}</div>}
        </>
      )}

      {/* 退休後收入結構 */}
      <div className="hcr-sub-label" style={{ marginTop: 14 }}>退休後收入結構</div>
      <div className="hcr-income-donuts">
        <IncomeDonutBlock title="退休後" lines={is.retireIncome} total={is.retireIncomeTotal} />
      </div>
      <p className="hcr-note">退休後主動收入（薪資 / 獎金 / 事業）停止，僅被動收入（租金 / 配息）與勞退月領持續；被動收入受市場波動與投資調整影響，非固定保證。</p>
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

function pctNum(r: number): string {
  return `${(r * 100).toFixed(1)}%`;
}
function gapClass(g: ReportModel["gaps"][number]["result"]): string {
  if (g.status === "needs_deep_data") return "pending";
  if (g.status === "not_planned") return "short"; // 警示色：尚未規劃，不可視為足夠
  return g.gap > 0 ? "short" : "ok";
}
function gapText(g: ReportModel["gaps"][number]["result"]): string {
  if (g.status === "needs_deep_data") return "補充深化問卷後可試算";
  if (g.status === "not_planned") return "退休生活尚未規劃，請補充需求";
  return g.gap > 0 ? `不足 ${fmtWan(g.gap)}` : "已足夠";
}

const css = `
.hcr { max-width: 100%; margin: 0 auto; padding: 30px 30px; color: #171717;
  font-family: -apple-system, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif; background:#fff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.hcr h2 { font-size: 23px; font-weight: 700; margin: 0 0 13px; padding-left: 11px; border-left: 4px solid #10b981; line-height: 1.15; }
.hcr-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px;
  padding-bottom:16px; border-bottom:2px solid #10b981; margin-bottom:20px; }
.hcr-kicker { font-size:18px; letter-spacing:2px; color:#059669; font-weight:600; }
.hcr-title { font-size:39px; font-weight:800; margin:4px 0 6px; }
.hcr-sub { font-size:20px; color:#666; }
.hcr-date { font-size:18px; color:#888; text-align:right; line-height:1.6; }
.hcr-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:16px; }
.hcr-stat { background:#f8fafc; border:1px solid #eef1f4; border-radius:12px; padding:16px 14px; text-align:center; }
.hcr-stat-val { font-size:33px; font-weight:800; letter-spacing:-0.5px; color:#0f172a; }
.hcr-stat-label { font-size:18px; color:#64748b; margin-top:3px; }
.hcr-stat-sub { font-size:16px; color:#94a3b8; margin-top:1px; }
.hcr-highlights { background:#f1f9f5; border:1px solid #cfe9dd; border-radius:14px; padding:14px 18px 15px; margin-bottom:16px; break-inside:avoid; }
.hcr-hl-title { font-size:18px; font-weight:700; color:#0f5132; margin-bottom:6px; letter-spacing:1px; }
.hcr-highlights ul { list-style:none; margin:0; padding:0; }
.hcr-highlights li { font-size:19px; color:#334155; line-height:1.55; padding:3px 0 3px 20px; position:relative; }
.hcr-highlights li::before { content:""; position:absolute; left:3px; top:12px; width:7px; height:7px; border-radius:50%; background:#10b981; }
.hcr-card { background:#fcfdfe; border:1px solid #e9edf2; border-radius:14px; padding:18px; margin-bottom:16px; break-inside:avoid; }
.hcr-dist { display:flex; align-items:center; gap:24px; flex-wrap:wrap; }
.hcr-legend { list-style:none; margin:0; padding:0; flex:1; min-width:220px; }
.hcr-legend li { display:flex; align-items:center; gap:8px; font-size:20px; padding:3px 0; }
.hcr-dot { width:10px; height:10px; border-radius:50%; flex:none; }
.hcr-legend-label { flex:1; color:#444; }
.hcr-legend-val { font-weight:600; } .hcr-legend-val em { color:#999; font-style:normal; margin-left:6px; font-size:17px; }
.hcr-bar { display:flex; height:22px; border-radius:11px; overflow:hidden; background:#f1f5f9; }
.hcr-cmp-row { display:flex; align-items:center; gap:10px; margin:6px 0; }
.hcr-cmp-tag { flex:0 0 88px; font-size:16px; color:#555; }
.hcr-cmp-track { flex:1; display:flex; height:20px; border-radius:10px; overflow:hidden; background:#f1f5f9; }
.hcr-cmp-num { flex:0 0 auto; min-width:70px; text-align:right; font-size:16px; font-weight:700; color:#334155; }
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
.hcr-alert { font-size:17px; color:#b91c1c; font-weight:600; line-height:1.6; margin:10px 0 0; background:#fef2f2; border:1px solid #fecaca; padding:10px 12px; border-radius:8px; }
.hcr-src { margin:8px 0 0; padding-left:20px; font-size:16px; color:#475569; line-height:1.7; }
.hcr-src li { margin-bottom:6px; break-inside:avoid; }
.hcr-src b { color:#0f172a; }
.hcr-src sup { font-size:0.7em; }
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
.hcr-ins-row.off { background:#fef2f2; border-color:#fecaca; }
.hcr-ins-row.off span:first-child { color:#dc2626; }
.hcr-ins-row.off span:last-child { color:#f87171; }
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
.hcr-stmt-future { display:flex; justify-content:space-between; font-size:18px; font-weight:600; color:#0369a1; background:#f0f9ff; border:1px solid #e0f2fe; border-radius:7px; padding:4px 9px; margin-top:4px; }
.hcr-stmt-future-group { margin-top:4px; display:flex; flex-direction:column; gap:2px; }
.hcr-stmt-future-group .hcr-stmt-future { margin-top:0; }
.hcr-income-donuts { display:flex; gap:20px; flex-wrap:wrap; justify-content:center; margin-top:6px; }
.hcr-income-donut { flex:1 1 240px; min-width:200px; text-align:center; }
.hcr-income-donut-title { font-size:18px; font-weight:700; color:#334155; margin-bottom:4px; }
.hcr-income-legend { list-style:none; margin:8px auto 0; padding:0; max-width:280px; display:flex; flex-direction:column; gap:3px; }
.hcr-income-legend li { display:flex; align-items:center; gap:7px; font-size:16px; color:#444; }
.hcr-income-legend-label { flex:1; text-align:left; }
.hcr-income-legend li em { color:#999; font-style:normal; font-size:15px; }
.hcr-advisor { background:#f4faf6; border-color:#cfe9dd; }
.hcr-dims { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
.hcr-dim { padding:12px 14px; background:#fff; border:1px solid #dcece3; border-left:3px solid #10b981; border-radius:10px; break-inside:avoid; }
.hcr-dim-title { font-size:19px; font-weight:700; color:#0f5132; }
.hcr-dim-desc { font-size:16px; color:#5b6b63; line-height:1.55; margin-top:3px; }
.hcr-sub-label { font-size:16px; font-weight:700; color:#0f5132; letter-spacing:1px; margin:2px 0 8px; }
.hcr-reco { font-size:21px; line-height:1.8; white-space:pre-wrap; margin:0; background:#fff; border:1px solid #d9ede4; border-left:3px solid #10b981; border-radius:10px; padding:12px 15px; color:#1e293b; }
.hcr-sign { margin-top:14px; padding-top:12px; border-top:1px solid #cfe9dd; font-size:20px; color:#333; }
.hcr-sign-name { font-weight:700; }
.hcr-sign-org { font-size:16px; color:#666; margin-top:3px; }
.hcr-sign-lics { margin-top:8px; display:flex; flex-direction:column; gap:5px; }
.hcr-sign-licrow { display:flex; align-items:flex-start; gap:8px; }
.hcr-sign-cat { font-size:14px; font-weight:700; color:#0369a1; min-width:104px; flex:none; padding-top:4px; }
.hcr-sign-licgroup { display:flex; flex-wrap:wrap; gap:6px; flex:1; min-width:0; }
.hcr-sign-lic { display:inline-flex; align-items:center; gap:6px; border:1px solid #e2e8f0; background:#f8fafc; border-radius:6px; padding:2px 9px; font-size:16px; color:#334155; }
.hcr-sign-licno { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; color:#94a3b8; }
.hcr-lic { color:#0369a1; margin-left:6px; font-size:18px; }
.hcr-foot { font-size:17px; color:#999; text-align:center; margin-top:20px; line-height:1.7; }
/* 家族關係圖 + 繼承順位（左圖右表，窄螢幕/列印自動堆疊） */
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
/* 螢幕字級調整（僅螢幕；列印輸出不受影響，維持 A4 版式一致）。由外層 data-hcr-fs 控制。 */
@media screen {
  [data-hcr-fs="base"] { zoom: 0.9; }
  [data-hcr-fs="lg"] { zoom: 1.008; }
  [data-hcr-fs="xl"] { zoom: 1.125; }
}
@media print {
  /* 列印時整體縮為 65%（螢幕顯示不受影響），讓每頁容納更多、字級更合宜 */
  .hcr { max-width:none; padding:0; zoom:0.65; }
  /* 自然分頁：每個卡片/區塊盡量不跨頁截斷，內容合理流到下一頁 */
  .hcr-card, .hcr-stats, .hcr-head, .hcr-highlights, .hcr-calc, .hcr-ins-row,
  .hcr-stmt, .hcr-dim, .hcr-gap, .hcr-reco, .hcr-sign, .hcr-invest li { break-inside:avoid; page-break-inside:avoid; }
  .hcr h2, .hcr-sub-label, .hcr-stmt-title { break-after:avoid; page-break-after:avoid; }
  .hcr svg { break-inside:avoid; page-break-inside:avoid; }
  .hcr-foot { break-inside:avoid; page-break-inside:avoid; }
  @page { margin: 14mm; }
}
`;
