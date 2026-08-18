// 民法繼承篇 §1138(順位)/ §1140(代位)/ §1144(配偶應繼分)
// 被繼承人 = 客戶本人。配偶為當然繼承人;血親繼承人由近而遠,前順位存在則後順位不繼承。
// 依問卷實際填入的家庭成員推算「繼承順位」與「應繼分」,供傳承規劃參考。
import type { FamilyModel } from "./report";

export interface ShareRow {
  role: string;
  count?: number;
  each: string; // 每人應繼分
  total: string; // 該身份合計
}

export interface OrderRow {
  order: 1 | 2 | 3 | 4;
  rank: string; // 第一順位…
  title: string; // 直系血親卑親屬…
  note: string; // 具體成員或「無」/「問卷未蒐集」
  present: boolean; // 問卷是否有此類成員
  active: boolean; // 是否為實際繼承的順位
}

export interface InheritanceResult {
  hasSpouse: boolean;
  activeOrder: 1 | 2 | 3 | 4 | null;
  orders: OrderRow[];
  shares: ShareRow[];
  headline: string;
  caveat?: string;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
function frac(n: number, d: number): string {
  if (n === 0) return "0";
  const g = gcd(n, d) || 1;
  const nn = n / g;
  const dd = d / g;
  return dd === 1 ? `${nn}` : `${nn}/${dd}`;
}

export function computeInheritance(f: FamilyModel): InheritanceResult {
  const hasSpouse = f.hasSpouse;
  const kids = f.children.length;
  const grand = f.grandchildren;
  const firstPresent = kids > 0 || grand > 0;
  const firstCount = kids > 0 ? kids : grand; // 無子女時,孫子女以代位/次親等繼承
  const parents = f.parents.length;
  const sibs = f.siblings.length;

  const orders: OrderRow[] = [
    {
      order: 1,
      rank: "第一順位",
      title: "直系血親卑親屬",
      note: kids > 0 ? `子女 ${kids} 位${grand > 0 ? `、孫子女 ${grand} 位` : ""}` : grand > 0 ? `孫子女 ${grand} 位(代位/次親等)` : "無",
      present: firstPresent,
      active: false,
    },
    { order: 2, rank: "第二順位", title: "父母", note: parents > 0 ? `父母 ${parents} 位` : "無", present: parents > 0, active: false },
    { order: 3, rank: "第三順位", title: "兄弟姊妹", note: sibs > 0 ? `兄弟姊妹 ${sibs} 位` : "無", present: sibs > 0, active: false },
    { order: 4, rank: "第四順位", title: "祖父母", note: "問卷未蒐集", present: false, active: false },
  ];

  // 決定實際繼承順位:血親由近而遠,取第一個存在者
  let activeOrder: 1 | 2 | 3 | 4 | null = null;
  if (firstPresent) activeOrder = 1;
  else if (parents > 0) activeOrder = 2;
  else if (sibs > 0) activeOrder = 3;
  else activeOrder = null; // 第四順位祖父母問卷未蒐集,無法判定

  if (activeOrder) orders[activeOrder - 1].active = true;

  const shares: ShareRow[] = [];
  let headline = "";
  let caveat: string | undefined;

  if (activeOrder === 1) {
    const heads = firstCount + (hasSpouse ? 1 : 0);
    const label = kids > 0 ? "子女" : "孫子女";
    if (hasSpouse) shares.push({ role: "配偶", each: frac(1, heads), total: frac(1, heads) });
    shares.push({ role: label, count: firstCount, each: frac(1, heads), total: frac(firstCount, heads) });
    headline = hasSpouse ? `配偶與${label}共同繼承,人人均分` : `由${label}均分`;
  } else if (activeOrder === 2) {
    if (hasSpouse) {
      shares.push({ role: "配偶", each: frac(1, 2), total: frac(1, 2) });
      shares.push({ role: "父母", count: parents, each: frac(1, 2 * parents), total: frac(1, 2) });
      headline = "配偶 1/2,父母均分另 1/2";
    } else {
      shares.push({ role: "父母", count: parents, each: frac(1, parents), total: "1" });
      headline = "由父母均分";
    }
  } else if (activeOrder === 3) {
    if (hasSpouse) {
      shares.push({ role: "配偶", each: frac(1, 2), total: frac(1, 2) });
      shares.push({ role: "兄弟姊妹", count: sibs, each: frac(1, 2 * sibs), total: frac(1, 2) });
      headline = "配偶 1/2,兄弟姊妹均分另 1/2";
    } else {
      shares.push({ role: "兄弟姊妹", count: sibs, each: frac(1, sibs), total: "1" });
      headline = "由兄弟姊妹均分";
    }
  } else {
    // 無第一~三順位血親(祖父母未蒐集)
    if (hasSpouse) {
      shares.push({ role: "配偶", each: "全部", total: "1" });
      headline = "配偶單獨繼承全部遺產";
      caveat = "※ 若祖父母在世則為第四順位:配偶 2/3、祖父母均分 1/3(問卷未蒐集祖父母)。";
    } else {
      headline = "依問卷資料查無法定繼承人";
      caveat = "※ 問卷未蒐集祖父母;若確無任何順位血親與配偶,遺產於清償債務後歸屬國庫(民法 §1185)。";
    }
  }

  return { hasSpouse, activeOrder, orders, shares, headline, caveat };
}
