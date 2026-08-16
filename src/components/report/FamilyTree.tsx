// 家族關係圖 — 卡通人偶 genogram。依人數生成個別人偶,並依民法標註直系/旁系。
import type { FamilyModel } from "@/lib/domain/report";

const SKIN = "#f7d5b5";
const SP = 82; // 人偶水平間距

type Variant = "male" | "female" | "elder-m" | "elder-f" | "adult" | "child" | "baby";

const ROLE_COLOR: Record<string, string> = {
  self: "#10b981",
  spouse: "#0ea5e9",
  parent: "#f59e0b",
  sibling: "#94a3b8",
  child: "#8b5cf6",
  grand: "#ec4899",
};

function Person({ cx, cy, variant, color, label, sub, kin, scale = 1 }: { cx: number; cy: number; variant: Variant; color: string; label: string; sub?: string; kin?: string; scale?: number }) {
  const hr = 12 * scale;
  const hy = cy - 16 * scale;
  const isElder = variant === "elder-m" || variant === "elder-f";
  const isFemale = variant === "female" || variant === "elder-f";
  const hair = isElder ? "#b6bac1" : "#4b4b52";
  const bodyTop = hy + hr - 2;
  const bodyBottom = cy + 22 * scale;
  return (
    <g>
      {isFemale ? (
        <path d={`M ${cx - 7 * scale} ${bodyTop} L ${cx + 7 * scale} ${bodyTop} L ${cx + 16 * scale} ${bodyBottom} L ${cx - 16 * scale} ${bodyBottom} Z`} fill={color} />
      ) : (
        <rect x={cx - 13 * scale} y={bodyTop} width={26 * scale} height={bodyBottom - bodyTop} rx={9 * scale} fill={color} />
      )}
      <circle cx={cx} cy={hy} r={hr} fill={SKIN} stroke="#e6b892" strokeWidth="1" />
      <path d={`M ${cx - hr} ${hy} A ${hr} ${hr} 0 0 1 ${cx + hr} ${hy} Z`} fill={hair} />
      {isFemale && <path d={`M ${cx - hr} ${hy - 1} q -3 ${hr + 2} 1 ${hr + 4} M ${cx + hr} ${hy - 1} q 3 ${hr + 2} -1 ${hr + 4}`} stroke={hair} strokeWidth={2.4 * scale} fill="none" />}
      {isElder && (
        <g stroke="#5b6470" strokeWidth="1" fill="none">
          <circle cx={cx - 4.5 * scale} cy={hy + 1} r={2.6 * scale} />
          <circle cx={cx + 4.5 * scale} cy={hy + 1} r={2.6 * scale} />
          <line x1={cx - 2 * scale} y1={hy + 1} x2={cx + 2 * scale} y2={hy + 1} />
        </g>
      )}
      <text x={cx} y={bodyBottom + 14} textAnchor="middle" fontSize="12" fontWeight="700" fill="#334155">{label}</text>
      {sub && <text x={cx} y={bodyBottom + 26} textAnchor="middle" fontSize="10" fill="#64748b">{sub}</text>}
      {kin && <text x={cx} y={bodyBottom + (sub ? 37 : 26)} textAnchor="middle" fontSize="9" fill="#a1a1aa">{kin}</text>}
    </g>
  );
}

const link = (x1: number, y1: number, x2: number, y2: number, key: string) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth={1.5} />
);

export function FamilyTree({ family, selfIsFemale = false }: { family: FamilyModel; selfIsFemale?: boolean }) {
  const hasSpouse = family.spouseAge != null;
  const yParents = 54;
  const ySelf = 188;
  const yChildren = 322;
  const yGrand = 440;

  // 本人世代橫排:兄弟姊妹(左)+ 本人 + 配偶(右),整組置中於 0
  const nSib = family.siblings.length;
  const genCount = nSib + 1 + (hasSpouse ? 1 : 0);
  const genStart = -((genCount - 1) * SP) / 2;
  const genX = (i: number) => genStart + i * SP;
  const sibX = (i: number) => genX(i); // 0..nSib-1
  const selfCx = genX(nSib);
  const spouseCx = genX(nSib + 1);
  const coupleMid = hasSpouse ? (selfCx + spouseCx) / 2 : selfCx;
  // 父母置中於「父母的子女(兄弟姊妹 + 本人)」上方
  const parentsMid = (genX(0) + selfCx) / 2;

  const kids = family.children;
  const kidsStart = coupleMid - ((kids.length - 1) * SP) / 2;
  const kidX = (i: number) => kidsStart + i * SP;

  const nGrand = Math.max(0, family.grandchildren);
  const grandStart = coupleMid - ((nGrand - 1) * SP) / 2;
  const grandX = (i: number) => grandStart + i * SP;

  const c: React.ReactNode[] = [];
  const hasParents = family.parents.count > 0;
  const topBar = 128;
  if (hasParents) {
    c.push(link(parentsMid, yParents + 24, parentsMid, topBar, "p1"));
    c.push(link(genX(0), topBar, selfCx, topBar, "p2")); // 橫桿涵蓋兄弟姊妹 + 本人
    for (let i = 0; i <= nSib; i++) c.push(link(genX(i), topBar, genX(i), ySelf - 30, `pd${i}`));
  } else if (nSib > 0) {
    c.push(link(genX(0), ySelf, selfCx, ySelf, "s1"));
  }
  if (hasSpouse) c.push(link(selfCx + 20, ySelf - 4, spouseCx - 20, ySelf - 4, "m1"));
  const midBar = 256;
  if (kids.length > 0) {
    c.push(link(coupleMid, ySelf + 22, coupleMid, midBar, "c0"));
    c.push(link(kidX(0), midBar, kidX(kids.length - 1), midBar, "cbar"));
    kids.forEach((_, i) => c.push(link(kidX(i), midBar, kidX(i), yChildren - 28, `cd${i}`)));
  }
  const gBar = 390;
  if (nGrand > 0 && kids.length > 0) {
    c.push(link(coupleMid, yChildren + 22, coupleMid, gBar, "g0"));
    c.push(link(grandX(0), gBar, grandX(nGrand - 1), gBar, "gbar"));
    for (let i = 0; i < nGrand; i++) c.push(link(grandX(i), gBar, grandX(i), yGrand - 24, `gd${i}`));
  }

  // 動態版面寬度:涵蓋所有節點
  const allX = [
    ...(hasParents ? [parentsMid - 52, parentsMid + 52] : []),
    ...Array.from({ length: nSib }, (_, i) => sibX(i)),
    selfCx,
    ...(hasSpouse ? [spouseCx] : []),
    ...kids.map((_, i) => kidX(i)),
    ...Array.from({ length: nGrand }, (_, i) => grandX(i)),
  ];
  const minX = Math.min(...allX) - 48;
  const maxX = Math.max(...allX) + 48;
  const width = Math.max(360, maxX - minX);
  const height = nGrand > 0 && kids.length > 0 ? 490 : kids.length > 0 ? 372 : 250;

  return (
    <svg viewBox={`${minX} 0 ${width} ${height}`} width="100%" style={{ maxWidth: Math.min(720, width) }} role="img" aria-label="家族關係圖">
      {c}

      {/* 父母(直系尊親屬) */}
      {hasParents &&
        (family.parents.count === 1 ? (
          <Person cx={parentsMid} cy={yParents} variant="elder-m" color={ROLE_COLOR.parent} label="父母" sub={family.parents.ages[0] ? `${family.parents.ages[0]} 歲` : undefined} kin="直系尊親屬" />
        ) : (
          <>
            <Person cx={parentsMid - 52} cy={yParents} variant="elder-m" color={ROLE_COLOR.parent} label="父" sub={family.parents.ages[0] ? `${family.parents.ages[0]} 歲` : undefined} kin="直系尊親屬" />
            <Person cx={parentsMid + 52} cy={yParents} variant="elder-f" color={ROLE_COLOR.parent} label="母" sub={family.parents.ages[1] ? `${family.parents.ages[1]} 歲` : undefined} kin="直系尊親屬" />
          </>
        ))}

      {/* 兄弟姊妹(旁系血親)— 逐位關係 + 性別 */}
      {family.siblings.map((s, i) => (
        <Person key={`sib${i}`} cx={sibX(i)} cy={ySelf} variant={s.isFemale ? "female" : "male"} color={ROLE_COLOR.sibling} label={s.relation} kin="旁系血親" />
      ))}

      {/* 本人 + 配偶 */}
      <Person cx={selfCx} cy={ySelf} variant={selfIsFemale ? "female" : "male"} color={ROLE_COLOR.self} label={family.self.label} sub={`${family.self.age} 歲`} kin="本人" />
      {hasSpouse && <Person cx={spouseCx} cy={ySelf} variant={selfIsFemale ? "male" : "female"} color={ROLE_COLOR.spouse} label="配偶" sub={family.spouseAge ? `${family.spouseAge} 歲` : undefined} kin="配偶" />}

      {/* 子女(直系卑親屬) */}
      {kids.map((k, i) => (
        <Person key={`kid${i}`} cx={kidX(i)} cy={yChildren} variant="child" color={ROLE_COLOR.child} label={`子女${i + 1}`} sub={`${k.stage}${k.age ? ` · ${k.age}歲` : ""}`} kin="直系卑親屬" scale={0.85} />
      ))}

      {/* 孫子女(直系卑親屬)— 依人數個別人偶 */}
      {Array.from({ length: nGrand }, (_, i) => (
        <Person key={`gc${i}`} cx={grandX(i)} cy={yGrand} variant="baby" color={ROLE_COLOR.grand} label={`孫${i + 1}`} kin="直系卑親屬" scale={0.72} />
      ))}
    </svg>
  );
}
