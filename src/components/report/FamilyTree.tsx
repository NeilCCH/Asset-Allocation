// 家族關係圖 — 卡通人偶版 genogram(圖像 + 文字),依世代排列,以人偶凸顯身份別。
import type { FamilyModel } from "@/lib/domain/report";

const CX = 350;
const SKIN = "#f7d5b5";

type Variant = "male" | "female" | "elder-m" | "elder-f" | "adult" | "child" | "baby";

const ROLE_COLOR: Record<string, string> = {
  self: "#10b981",
  spouse: "#0ea5e9",
  parent: "#f59e0b",
  sibling: "#94a3b8",
  child: "#8b5cf6",
  grand: "#ec4899",
};

function Person({ cx, cy, variant, color, label, sub, scale = 1 }: { cx: number; cy: number; variant: Variant; color: string; label: string; sub?: string; scale?: number }) {
  const hr = 12 * scale;
  const hy = cy - 16 * scale;
  const isElder = variant === "elder-m" || variant === "elder-f";
  const isFemale = variant === "female" || variant === "elder-f";
  const hair = isElder ? "#b6bac1" : "#4b4b52";
  const bodyTop = hy + hr - 2;
  const bodyBottom = cy + 22 * scale;

  return (
    <g>
      {/* 身體 / 衣著 */}
      {isFemale ? (
        <path d={`M ${cx - 7 * scale} ${bodyTop} L ${cx + 7 * scale} ${bodyTop} L ${cx + 16 * scale} ${bodyBottom} L ${cx - 16 * scale} ${bodyBottom} Z`} fill={color} />
      ) : (
        <rect x={cx - 13 * scale} y={bodyTop} width={26 * scale} height={bodyBottom - bodyTop} rx={9 * scale} fill={color} />
      )}
      {/* 頭 */}
      <circle cx={cx} cy={hy} r={hr} fill={SKIN} stroke="#e6b892" strokeWidth="1" />
      {/* 頭髮(上半圈) */}
      <path d={`M ${cx - hr} ${hy} A ${hr} ${hr} 0 0 1 ${cx + hr} ${hy} Z`} fill={hair} />
      {/* 女性側髮 */}
      {isFemale && (
        <path d={`M ${cx - hr} ${hy - 1} q -3 ${hr + 2} 1 ${hr + 4} M ${cx + hr} ${hy - 1} q 3 ${hr + 2} -1 ${hr + 4}`} stroke={hair} strokeWidth={2.4 * scale} fill="none" />
      )}
      {/* 長者眼鏡 */}
      {isElder && (
        <g stroke="#5b6470" strokeWidth="1" fill="none">
          <circle cx={cx - 4.5 * scale} cy={hy + 1} r={2.6 * scale} />
          <circle cx={cx + 4.5 * scale} cy={hy + 1} r={2.6 * scale} />
          <line x1={cx - 2 * scale} y1={hy + 1} x2={cx + 2 * scale} y2={hy + 1} />
        </g>
      )}
      {/* 文字 */}
      <text x={cx} y={bodyBottom + 15} textAnchor="middle" fontSize="12" fontWeight="700" fill="#334155">{label}</text>
      {sub && <text x={cx} y={bodyBottom + 27} textAnchor="middle" fontSize="10" fill="#64748b">{sub}</text>}
    </g>
  );
}

const link = (x1: number, y1: number, x2: number, y2: number, key: string) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth={1.5} />
);

export function FamilyTree({ family, selfIsFemale = false }: { family: FamilyModel; selfIsFemale?: boolean }) {
  const hasSpouse = family.spouseAge != null;
  const yParents = 52;
  const ySelf = 168;
  const yChildren = 284;
  const yGrand = 388;

  const selfCx = hasSpouse ? CX - 54 : CX;
  const spouseCx = CX + 54;
  const coupleMid = hasSpouse ? CX : selfCx;
  const siblingCx = 96;

  const kids = family.children;
  const gap = 96;
  const kidsStartX = coupleMid - ((kids.length - 1) * gap) / 2;
  const kidCx = (i: number) => kidsStartX + i * gap;

  const c: React.ReactNode[] = [];
  const hasParents = family.parents.count > 0;
  const topBar = 112; // 父母↔本人/手足 橫桿
  if (hasParents) {
    c.push(link(CX, yParents + 24, CX, topBar, "p1"));
    const barLeft = family.siblings > 0 ? siblingCx : selfCx;
    c.push(link(barLeft, topBar, selfCx, topBar, "p2"));
    c.push(link(selfCx, topBar, selfCx, ySelf - 30, "p3"));
    if (family.siblings > 0) c.push(link(siblingCx, topBar, siblingCx, ySelf - 30, "p4"));
  } else if (family.siblings > 0) {
    c.push(link(siblingCx, ySelf, selfCx, ySelf, "s1"));
  }
  if (hasSpouse) c.push(link(selfCx + 20, ySelf - 4, spouseCx - 20, ySelf - 4, "m1"));
  const midBar = 232;
  if (kids.length > 0) {
    c.push(link(coupleMid, ySelf + 22, coupleMid, midBar, "c0"));
    c.push(link(kidCx(0), midBar, kidCx(kids.length - 1), midBar, "cbar"));
    kids.forEach((_, i) => c.push(link(kidCx(i), midBar, kidCx(i), yChildren - 28, `cd${i}`)));
  }
  if (family.grandchildren > 0 && kids.length > 0) c.push(link(coupleMid, yChildren + 24, coupleMid, yGrand - 26, "g0"));

  const height = family.grandchildren > 0 ? 430 : kids.length > 0 ? 330 : 240;

  return (
    <svg viewBox={`0 0 700 ${height}`} width="100%" style={{ maxWidth: 700 }} role="img" aria-label="家族關係圖">
      {c}

      {/* 父母 */}
      {hasParents &&
        (family.parents.count === 1 ? (
          <Person cx={CX} cy={yParents} variant="elder-m" color={ROLE_COLOR.parent} label="父母" sub={family.parents.ages[0] ? `${family.parents.ages[0]} 歲` : undefined} />
        ) : (
          <>
            <Person cx={CX - 52} cy={yParents} variant="elder-m" color={ROLE_COLOR.parent} label="父" sub={family.parents.ages[0] ? `${family.parents.ages[0]} 歲` : undefined} />
            <Person cx={CX + 52} cy={yParents} variant="elder-f" color={ROLE_COLOR.parent} label="母" sub={family.parents.ages[1] ? `${family.parents.ages[1]} 歲` : undefined} />
          </>
        ))}

      {/* 兄弟姊妹 */}
      {family.siblings > 0 && <Person cx={siblingCx} cy={ySelf} variant="adult" color={ROLE_COLOR.sibling} label="兄弟姊妹" sub={`×${family.siblings}`} />}

      {/* 本人 + 配偶 */}
      <Person cx={selfCx} cy={ySelf} variant={selfIsFemale ? "female" : "male"} color={ROLE_COLOR.self} label={family.self.label} sub={`${family.self.age} 歲`} />
      {hasSpouse && <Person cx={spouseCx} cy={ySelf} variant={selfIsFemale ? "male" : "female"} color={ROLE_COLOR.spouse} label="配偶" sub={family.spouseAge ? `${family.spouseAge} 歲` : undefined} />}

      {/* 子女 */}
      {kids.map((k, i) => (
        <Person key={i} cx={kidCx(i)} cy={yChildren} variant="child" color={ROLE_COLOR.child} label={`子女${i + 1}`} sub={`${k.stage}${k.age ? ` · ${k.age}歲` : ""}`} scale={0.85} />
      ))}

      {/* 孫子女 */}
      {family.grandchildren > 0 && <Person cx={coupleMid} cy={yGrand} variant="baby" color={ROLE_COLOR.grand} label="孫子女" sub={`×${family.grandchildren}`} scale={0.72} />}
    </svg>
  );
}
