// 補齊/修正問卷資料的結構,避免舊版 schema 或部分資料造成下游崩潰。
// 舊資料曾把 children 存成 { count, ages } 物件、無 parents/siblings/grandchildren,
// 現行需 children:陣列、parents:{count,ages}、siblings:陣列、grandchildren:{count}。
import type { QuestionnaireData } from "./types";

type Rec = Record<string, unknown>;
const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function normParents(v: unknown): { count: number; ages: number[] } {
  if (v && typeof v === "object") {
    const o = v as Rec;
    return { count: num(o.count), ages: asArray<number>(o.ages) };
  }
  return { count: 0, ages: [] };
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
      dependents: {
        children: asArray(dep.children), // 舊格式的物件 → []
        parents: normParents(dep.parents),
        siblings: asArray(dep.siblings),
        grandchildren: normGrand(dep.grandchildren),
      },
    },
  } as QuestionnaireData;
}
