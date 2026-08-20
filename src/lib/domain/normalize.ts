// 補齊/修正問卷資料的結構,避免舊版 schema 或部分資料造成下游崩潰。
// 舊資料曾把 children 存成 { count, ages } 物件、無 parents/siblings/grandchildren,
// 現行需 children:陣列、parents:[{relation,age}]、siblings:陣列、grandchildren:{count}。
import type { Assets, QuestionnaireData } from "./types";
import { ASSET_FIELDS } from "./options";

type Rec = Record<string, unknown>;
const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** 補齊資產各欄位(新增 insurance_invest 後,舊資料缺欄會導致下游崩潰)。 */
function normAssets(v: unknown): Assets {
  const raw = (v ?? {}) as Rec;
  const out = {} as Record<string, { has: boolean; amount: number }>;
  for (const f of ASSET_FIELDS) {
    const a = raw[f.key] as Rec | undefined;
    out[f.key] = { has: !!a?.has, amount: num(a?.amount) };
  }
  return out as unknown as Assets;
}

function normParents(v: unknown): { relation: "父" | "母"; age: number }[] {
  // 新格式:[{ relation, age }]
  if (Array.isArray(v)) {
    return v
      .map((p, i) => {
        const o = (p ?? {}) as Rec;
        const rel: "父" | "母" = o.relation === "母" ? "母" : o.relation === "父" ? "父" : i === 0 ? "父" : "母";
        return { relation: rel, age: num(o.age) };
      })
      .slice(0, 2);
  }
  // 舊格式:{ count, ages } → 依序補為 父、母
  if (v && typeof v === "object") {
    const o = v as Rec;
    const count = Math.max(0, Math.min(2, num(o.count)));
    const ages = asArray<number>(o.ages);
    return Array.from({ length: count }, (_, i) => ({ relation: (i === 0 ? "父" : "母") as "父" | "母", age: num(ages[i]) }));
  }
  return [];
}
function normGrand(v: unknown): { count: number } {
  if (v && typeof v === "object") return { count: num((v as Rec).count) };
  return { count: 0 };
}

export function normalizeData(data: QuestionnaireData): QuestionnaireData {
  const dep = (data.core?.dependents ?? {}) as unknown as Rec;
  return {
    ...data,
    core: {
      ...data.core,
      assets: normAssets(data.core?.assets),
      dependents: {
        children: asArray(dep.children), // 舊格式的物件 → []
        parents: normParents(dep.parents),
        siblings: asArray(dep.siblings),
        grandchildren: normGrand(dep.grandchildren),
      },
    },
  } as QuestionnaireData;
}
