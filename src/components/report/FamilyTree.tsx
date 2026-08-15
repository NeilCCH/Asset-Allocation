// 家系關係圖 — 依世代排列的 SVG genogram(圖像 + 文字)。用於健檢報告。
import type { FamilyModel } from "@/lib/domain/report";

const NODE_W = 78;
const NODE_H = 42;
const CX = 350; // 版面中心

const STYLE: Record<string, { fill: string; stroke: string; text: string }> = {
  parent: { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
  self: { fill: "#d1fae5", stroke: "#10b981", text: "#065f46" },
  spouse: { fill: "#e0f2fe", stroke: "#0ea5e9", text: "#075985" },
  sibling: { fill: "#f1f5f9", stroke: "#94a3b8", text: "#475569" },
  child: { fill: "#ede9fe", stroke: "#8b5cf6", text: "#5b21b6" },
  grand: { fill: "#fce7f3", stroke: "#ec4899", text: "#9d174d" },
};

function Node({ cx, cy, kind, label, sub }: { cx: number; cy: number; kind: keyof typeof STYLE; label: string; sub?: string }) {
  const s = STYLE[kind];
  return (
    <g>
      <rect x={cx - NODE_W / 2} y={cy - NODE_H / 2} width={NODE_W} height={NODE_H} rx={8} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} />
      <text x={cx} y={sub ? cy - 2 : cy + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill={s.text}>{label}</text>
      {sub && <text x={cx} y={cy + 13} textAnchor="middle" fontSize={10} fill={s.text}>{sub}</text>}
    </g>
  );
}

const line = (x1: number, y1: number, x2: number, y2: number, key: string) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth={1.5} />
);

export function FamilyTree({ family }: { family: FamilyModel }) {
  const hasSpouse = family.spouseAge != null || false;
  const yParents = 34;
  const ySelf = 130;
  const yChildren = 226;
  const yGrand = 314;

  const selfCx = hasSpouse ? CX - 46 : CX;
  const spouseCx = CX + 46;
  const coupleMid = hasSpouse ? CX : selfCx;

  // 子女位置(以中心展開)
  const kids = family.children;
  const gap = 92;
  const kidsStartX = coupleMid - ((kids.length - 1) * gap) / 2;
  const kidCx = (i: number) => kidsStartX + i * gap;

  const connectors: React.ReactNode[] = [];

  // 父母 → 本人 / 兄弟姊妹(手足橫桿)
  const hasParents = family.parents.count > 0;
  const siblingCx = 120;
  if (hasParents) {
    connectors.push(line(CX, yParents + NODE_H / 2, CX, 88, "p1"));
    const barLeft = family.siblings > 0 ? siblingCx : selfCx;
    connectors.push(line(barLeft, 88, selfCx, 88, "p2"));
    connectors.push(line(selfCx, 88, selfCx, ySelf - NODE_H / 2, "p3"));
    if (family.siblings > 0) connectors.push(line(siblingCx, 88, siblingCx, ySelf - NODE_H / 2, "p4"));
  } else if (family.siblings > 0) {
    connectors.push(line(siblingCx, ySelf, selfCx, ySelf, "s1"));
  }

  // 婚姻線 + 下接子女
  if (hasSpouse) connectors.push(line(selfCx + NODE_W / 2, ySelf, spouseCx - NODE_W / 2, ySelf, "m1"));
  if (kids.length > 0) {
    connectors.push(line(coupleMid, ySelf + (hasSpouse ? 0 : NODE_H / 2), coupleMid, 190, "c0"));
    connectors.push(line(kidCx(0), 190, kidCx(kids.length - 1), 190, "cbar"));
    kids.forEach((_, i) => connectors.push(line(kidCx(i), 190, kidCx(i), yChildren - NODE_H / 2, `cdrop${i}`)));
  }

  // 子女 → 孫子女
  if (family.grandchildren > 0 && kids.length > 0) {
    connectors.push(line(coupleMid, yChildren + NODE_H / 2, coupleMid, yGrand - NODE_H / 2, "g0"));
  }

  const height = family.grandchildren > 0 ? 350 : kids.length > 0 ? 262 : 172;

  return (
    <svg viewBox={`0 0 700 ${height}`} width="100%" style={{ maxWidth: 700 }} role="img" aria-label="家系關係圖">
      {connectors}

      {/* 父母 */}
      {hasParents &&
        (family.parents.count === 1
          ? [<Node key="par" cx={CX} cy={yParents} kind="parent" label="父母" sub={family.parents.ages[0] ? `${family.parents.ages[0]} 歲` : undefined} />]
          : [
              <Node key="p0" cx={CX - 48} cy={yParents} kind="parent" label="父/母" sub={family.parents.ages[0] ? `${family.parents.ages[0]} 歲` : undefined} />,
              <Node key="p1n" cx={CX + 48} cy={yParents} kind="parent" label="父/母" sub={family.parents.ages[1] ? `${family.parents.ages[1]} 歲` : undefined} />,
            ])}

      {/* 兄弟姊妹 */}
      {family.siblings > 0 && <Node cx={siblingCx} cy={ySelf} kind="sibling" label="兄弟姊妹" sub={`×${family.siblings}`} />}

      {/* 本人 + 配偶 */}
      <Node cx={selfCx} cy={ySelf} kind="self" label={family.self.label} sub={`${family.self.age} 歲`} />
      {hasSpouse && <Node cx={spouseCx} cy={ySelf} kind="spouse" label="配偶" sub={family.spouseAge ? `${family.spouseAge} 歲` : undefined} />}

      {/* 子女 */}
      {kids.map((c, i) => (
        <Node key={i} cx={kidCx(i)} cy={yChildren} kind="child" label={`子女${i + 1}`} sub={`${c.stage}${c.age ? ` · ${c.age}歲` : ""}`} />
      ))}

      {/* 孫子女 */}
      {family.grandchildren > 0 && <Node cx={coupleMid} cy={yGrand} kind="grand" label="孫子女" sub={`×${family.grandchildren}`} />}
    </svg>
  );
}
