// 家庭財務報表 — 參考公司三表(資產負債表 / 損益表 / 現金流量表)之結構與會計邏輯。
// 單位:資產負債表為萬元;損益/現金流為年或月(萬元)。
import type { QuestionnaireData } from "./types";
import { assetBreakdown, fvGrowingAnnuity, loanMonthlyPayment, remainingLoanBalance } from "./calc";
import { INCOME_BAND_VALUE, SURPLUS_BAND_VALUE, type CalcParams } from "./params";
import { estimateIncomeTax } from "./incomeTax";

export interface Line {
  label: string;
  amount: number;
  tag?: string; // 主動 / 被動 等註記
}

export interface PersonalStatements {
  // 資產負債表:資產 = 負債 + 淨值
  balanceSheet: {
    assets: Line[];
    liabilities: Line[];
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    // 退休時預估未來值(TVM)
    futureAssets?: number;
    futureLiabilities?: number;
    futureNetWorth?: number;
    futurePlannedLoan?: number; // 新增貸款計劃在退休時的剩餘本金(已含於 futureLiabilities)
  };
  // 損益表(年):收入 − 支出 = 結餘
  incomeStatement: {
    income: Line[]; // 工作期間收入(主動 + 被動)
    retireIncome: Line[]; // 退休後仍持續的收入(僅被動 + 勞退月領)
    retireIncomeTotal: number;
    totalIncome: number;
    totalExpense: number;
    surplus: number;
    activeIncome: number; // 主動收入(年,萬)= 總收入 − 被動收入
    passiveIncome: number;
    passiveRatio: number; // 被動收入占總收入
    incomeTax?: number; // 應納所得稅(萬),有填綜合所得淨額時
    afterTaxIncome?: number; // 稅後所得(萬)
    marginalRate?: number; // 邊際稅率
    // 退休前一年預估未來值(收入依薪資成長、支出依通膨)
    futureIncome?: number;
    futureExpense?: number;
    futureSurplus?: number;
  };
  // 現金流量表(月):流入 − 流出 = 淨現金流
  cashFlow: {
    inflow: number;
    outflow: number;
    debtPayment: number;
    net: number;
    // 每月固定支出明細(選填,萬/月)
    fixedExpense?: Line[];
    fixedExpenseTotal?: number;
    // 年度特別預算明細(選填,萬/年):旅遊、年度稅金、紅包、保險費等,以「年」計
    annualSpecial?: Line[];
    annualSpecialTotal?: number; // 萬/年
    annualSpecialMonthly?: number; // 折合每月(萬)= 年額 / 12
    // 退休前一年預估未來值(月)
    futureInflow?: number;
    futureOutflow?: number;
    futureNet?: number;
    // 逐年現金流趨勢(月,萬):主動收入 / 被動收入(退休後含勞退) / 貸款還款
    series?: { age: number; active: number; passive: number; debt: number }[];
    retireAge?: number;
    loanEndAge?: number; // 現有貸款預估還清年齡(有貸款時)
    estRetireSalaryUsed?: number; // 圖表採用的「預估退休前薪資」(萬/年);未填則等於現況主動收入
  };
  // 未來值投影假設(有帶 params 時才有)
  projection?: {
    years: number; // 距退休年數
    retireAge: number;
    returnRate: number;
    inflationRate: number;
    salaryGrowthRate: number;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function personalStatements(data: QuestionnaireData, params?: CalcParams): PersonalStatements {
  const { core, deep } = data;

  // ── 資產負債表 ──
  // 保障型保單不計入資產(獨立顯示)
  const assets: Line[] = assetBreakdown(core.assets)
    .filter((a) => a.amount > 0 && a.assetClass !== "保障")
    .map((a) => ({ label: a.label, amount: a.amount }));
  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);

  const liabilities: Line[] = [];
  if (deep?.liabilities) {
    if (deep.liabilities.mortgage_balance > 0) liabilities.push({ label: "房貸餘額", amount: deep.liabilities.mortgage_balance });
    if (deep.liabilities.loan_balance > 0) liabilities.push({ label: "其他貸款餘額", amount: deep.liabilities.loan_balance });
    if ((deep.liabilities.credit_card_balance ?? 0) > 0) liabilities.push({ label: "信用卡餘額", amount: deep.liabilities.credit_card_balance! });
  }
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
  const netWorth = totalAssets - totalLiabilities;

  // ── 損益表(年) ──
  // 收入:固定收入明細(年) > 舊 income_sources > 年收入級距估計。
  // 以「填報明細」為準,不再補虛構的「其他收入」把總額拉到級距(避免出現不存在的巨額收入)。
  const bandIncome = INCOME_BAND_VALUE[core.income_band] ?? 0;
  const PASSIVE_LABELS = new Set(["租金收入", "股利 / 利息"]);
  const fixedInc = deep?.annual_fixed_income ?? []; // 固定收入明細以「年」為單位,直接採用
  const src = deep?.income_sources;
  let income: Line[];
  if (fixedInc.length > 0) {
    income = fixedInc.map((i) => ({
      label: i.label,
      amount: r1(i.amount),
      tag: PASSIVE_LABELS.has(i.label) ? "被動" : undefined,
    }));
  } else if (src && [src.salary, src.bonus, src.rental, src.dividend, src.business, src.other].some((v) => v > 0)) {
    income = [
      { label: "薪資", amount: src.salary, tag: "主動" },
      { label: "獎金 / 佣金", amount: src.bonus, tag: "主動" },
      { label: "租金", amount: src.rental, tag: "被動" },
      { label: "股利 / 利息", amount: src.dividend, tag: "被動" },
      { label: "事業盈餘", amount: src.business, tag: "半被動" },
      { label: "其他", amount: src.other },
    ].filter((l) => l.amount > 0);
  } else {
    income = [{ label: "年收入(級距估計)", amount: bandIncome }];
  }
  const totalIncome = income.reduce((s, l) => s + l.amount, 0);
  // 結餘 = 每月結餘級距 × 12;夾在 [−收入, 收入] 內,避免與收入矛盾(結餘不可超過收入)。
  const rawAnnualSurplus = (SURPLUS_BAND_VALUE[core.surplus_band] ?? 0) * 12;
  const annualSurplus = Math.max(-totalIncome, Math.min(rawAnnualSurplus, totalIncome));
  const totalExpense = totalIncome - annualSurplus; // = 收入 − 結餘,恆 ≥ 0
  const passiveIncome = income.filter((l) => l.tag === "被動").reduce((s, l) => s + l.amount, 0);
  // 主動收入(年):總收入 − 被動收入。退休前薪資:優先採互動參數「預估退休前薪資」,未填則沿用現況主動收入。
  const activeIncomeAnnual = Math.max(0, totalIncome - passiveIncome);
  const estRetireSalaryAnnual =
    params?.estRetireSalaryAnnual && params.estRetireSalaryAnnual > 0 ? params.estRetireSalaryAnnual : activeIncomeAnnual;

  // 退休後仍持續的收入:主動收入(薪資/獎金/事業)於退休後停止,僅保留被動收入 + 勞退月領
  const pensionAnnual = (deep?.retire_pension_monthly ?? 0) * 12;
  const retireIncome: Line[] = income.filter((l) => l.tag === "被動").map((l) => ({ ...l }));
  if (pensionAnnual > 0) retireIncome.push({ label: "勞退月領", amount: r1(pensionAnnual), tag: "被動" });
  const retireIncomeTotal = retireIncome.reduce((s, l) => s + l.amount, 0);

  // ── 現金流量表(月) ── 與損益表採同一份(已夾住)結餘,兩表一致
  const inflow = totalIncome / 12;
  const net = annualSurplus / 12; // 月結餘
  const outflow = inflow - net;
  const debtPayment = deep?.liabilities?.monthly_payment ?? 0;

  // ── 每月固定支出明細(選填,月)──(固定收入為年,已計入上方損益表)
  const fixedExpenseItems = deep?.monthly_fixed_expense ?? [];
  const fixedExpenseTotal = fixedExpenseItems.reduce((s, i) => s + i.amount, 0);
  // ── 年度特別預算明細(選填,年)── 保險費 / 旅遊 / 年度稅金 / 紅包等,以「年」計
  const annualSpecialItems = deep?.annual_special_expense ?? [];
  const annualSpecialTotal = annualSpecialItems.reduce((s, i) => s + i.amount, 0);

  // ── 所得稅(有填綜合所得淨額時) ──
  const tax = deep?.taxable_income != null ? estimateIncomeTax(deep.taxable_income) : null;

  // ── 未來值投影(TVM,以財務計算機概念投影到退休年) ──
  // 資產:現值以報酬率複利成長 + 年結餘持續投入(成長型年金,依薪資成長率)
  // 收入:主動採「預估退休前薪資」(互動參數)、被動依通膨;支出:依通膨率(退休當年之估計)
  const n = Math.max(0, core.retire_age - core.age);
  type FutureVals = {
    futureAssets: number; futureLiabilities: number; futureNetWorth: number; futurePlannedLoan: number;
    futureIncome: number; futureExpense: number; futureSurplus: number;
    futureInflow: number; futureOutflow: number; futureNet: number;
  };
  let future: FutureVals | null = null;
  if (params && n > 0) {
    const { returnRate: r, inflationRate: inf, salaryGrowthRate: g } = params;
    const fv = (pv: number, rate: number) => pv * Math.pow(1 + rate, n);
    const futureAssets = fv(totalAssets, r) + fvGrowingAnnuity(Math.max(0, annualSurplus), r, g, n);
    // 負債未來值:現有貸款依「平均利率 + 月還款」正確攤還;加計新增貸款計劃在退休時的剩餘本金
    const liabRate = deep?.liabilities?.interest_rate ?? 0;
    const existingFutureLiab = remainingLoanBalance(totalLiabilities, debtPayment, liabRate, n);
    let plannedFutureLiab = 0;
    const pl = deep?.planned_loan;
    if (pl && pl.amount > 0 && pl.years_until < n) {
      const rate = deep?.liabilities?.interest_rate ?? 2; // 沿用平均利率,無則預設 2%
      const pmt = loanMonthlyPayment(pl.amount, rate, pl.term_years);
      plannedFutureLiab = remainingLoanBalance(pl.amount, pmt, rate, n - pl.years_until);
    }
    const futureLiabilities = existingFutureLiab + plannedFutureLiab;
    // 退休當年收入:主動採「預估退休前薪資」(互動參數)、被動依通膨複利;兩者相加
    const futureActiveIncome = estRetireSalaryAnnual;
    const futurePassiveIncome = passiveIncome * Math.pow(1 + inf, n);
    const futureIncome = futureActiveIncome + futurePassiveIncome;
    const futureExpense = fv(totalExpense, inf);
    const futureInflow = futureIncome / 12;
    const futureOutflow = fv(outflow, inf);
    future = {
      futureAssets, futureLiabilities, futureNetWorth: futureAssets - futureLiabilities, futurePlannedLoan: plannedFutureLiab,
      futureIncome, futureExpense, futureSurplus: futureIncome - futureExpense,
      futureInflow, futureOutflow, futureNet: futureInflow - futureOutflow,
    };
  }

  // ── 逐年現金流趨勢(月,萬)── 主動收入(現況→預估退休前薪資,線性推估,退休停止)/ 被動收入(通膨成長,退休後併入勞退)/ 貸款還款(隨餘額遞減至還清)
  let cashSeries: PersonalStatements["cashFlow"]["series"];
  let loanEndAge: number | undefined;
  if (params) {
    const inf = params.inflationRate;
    const startAge = core.age;
    const retAge = core.retire_age;
    const life = Math.max(retAge, params.lifeExpectancy);
    const yearsToRetire = Math.max(1, retAge - startAge);
    const activeMonthNow = activeIncomeAnnual / 12; // 主動收入(月,現況)
    const retireMonth = estRetireSalaryAnnual / 12; // 主動收入(月,退休前預估)
    const passiveMonthNow = passiveIncome / 12; // 被動收入(月,當前)
    const pensionMonth = deep?.retire_pension_monthly ?? 0; // 勞退月領
    const liabRate = deep?.liabilities?.interest_rate ?? 0;
    const pl = deep?.planned_loan;
    const plRate = liabRate || 2;
    const plPmt = pl && pl.amount > 0 ? loanMonthlyPayment(pl.amount, plRate, pl.term_years) : 0;
    const series: NonNullable<PersonalStatements["cashFlow"]["series"]> = [];
    for (let age = startAge; age <= life; age++) {
      const t = age - startAge;
      // 主動收入(薪資):自現況「線性」推估至預估退休前薪資,退休即停止(不再以成長率估算)
      const active = age <= retAge ? activeMonthNow + (retireMonth - activeMonthNow) * (Math.min(t, yearsToRetire) / yearsToRetire) : 0;
      const passive = passiveMonthNow * Math.pow(1 + inf, t) + (age >= retAge ? pensionMonth : 0);
      let debt = 0;
      if (totalLiabilities > 0 && debtPayment > 0) {
        const rem = remainingLoanBalance(totalLiabilities, debtPayment, liabRate, t);
        debt += debtPayment * (rem / totalLiabilities);
        if (rem <= 0 && loanEndAge === undefined) loanEndAge = age;
      }
      if (pl && pl.amount > 0 && t >= pl.years_until) {
        const remp = remainingLoanBalance(pl.amount, plPmt, plRate, t - pl.years_until);
        debt += plPmt * (remp / pl.amount);
      }
      series.push({ age, active: r1(active), passive: r1(passive), debt: r1(debt) });
    }
    cashSeries = series;
  }

  return {
    balanceSheet: {
      assets,
      liabilities,
      totalAssets: r1(totalAssets),
      totalLiabilities: r1(totalLiabilities),
      netWorth: r1(netWorth),
      futureAssets: future ? r1(future.futureAssets) : undefined,
      futureLiabilities: future ? r1(future.futureLiabilities) : undefined,
      futureNetWorth: future ? r1(future.futureNetWorth) : undefined,
      futurePlannedLoan: future && future.futurePlannedLoan > 0 ? r1(future.futurePlannedLoan) : undefined,
    },
    incomeStatement: {
      income,
      retireIncome: retireIncome.map((l) => ({ ...l, amount: r1(l.amount) })),
      retireIncomeTotal: r1(retireIncomeTotal),
      totalIncome: r1(totalIncome),
      totalExpense: r1(totalExpense),
      surplus: r1(annualSurplus),
      activeIncome: r1(activeIncomeAnnual),
      passiveIncome: r1(passiveIncome),
      passiveRatio: totalIncome > 0 ? Math.round((passiveIncome / totalIncome) * 100) : 0,
      incomeTax: tax ? tax.tax : undefined,
      afterTaxIncome: tax ? r1(totalIncome - tax.tax) : undefined,
      marginalRate: tax ? tax.marginalRate : undefined,
      futureIncome: future ? r1(future.futureIncome) : undefined,
      futureExpense: future ? r1(future.futureExpense) : undefined,
      futureSurplus: future ? r1(future.futureSurplus) : undefined,
    },
    cashFlow: {
      inflow: r1(inflow),
      outflow: r1(outflow),
      debtPayment: r1(debtPayment),
      net: r1(net),
      fixedExpense: fixedExpenseItems.length ? fixedExpenseItems.map((i) => ({ label: i.label, amount: r1(i.amount) })) : undefined,
      fixedExpenseTotal: fixedExpenseItems.length ? r1(fixedExpenseTotal) : undefined,
      annualSpecial: annualSpecialItems.length ? annualSpecialItems.map((i) => ({ label: i.label, amount: r1(i.amount) })) : undefined,
      annualSpecialTotal: annualSpecialItems.length ? r1(annualSpecialTotal) : undefined,
      annualSpecialMonthly: annualSpecialItems.length ? r1(annualSpecialTotal / 12) : undefined,
      futureInflow: future ? r1(future.futureInflow) : undefined,
      futureOutflow: future ? r1(future.futureOutflow) : undefined,
      futureNet: future ? r1(future.futureNet) : undefined,
      series: cashSeries,
      retireAge: cashSeries ? core.retire_age : undefined,
      loanEndAge,
      estRetireSalaryUsed: cashSeries ? r1(estRetireSalaryAnnual) : undefined,
    },
    projection:
      params && n > 0
        ? { years: n, retireAge: core.retire_age, returnRate: params.returnRate, inflationRate: params.inflationRate, salaryGrowthRate: params.salaryGrowthRate }
        : undefined,
  };
}
