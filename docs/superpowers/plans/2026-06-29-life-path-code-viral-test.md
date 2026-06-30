# 职场版 MBTI · 人生路径码 Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the P1 career-MBTI viral funnel — a 28-statement slider test → 4-letter 人生路径码 + 中文昵称 on a shareable card, whose answers also feed the real AI prediction (riskAppetite + a soft prompt line).

**Architecture:** A new **pure, deterministic** domain module `packages/core/src/lifePathCode/` (axes, 16 types, 28 statements, weighted slider scoring + helpers) — no AI, no network, no `Date.now`/`Math.random`. Web adds a `/test` slider quiz + public `/t/[code]` result page (OpenGraph) + a `LifePathCard` (image export mirrors `treeShareImage.ts`). The test stores `{code, answers}` in `sessionStorage`; onboarding reads it to set `riskAppetite` + persist `lifePathCode`/`lifePathAnswers` on the `Profile`; `enrich.ts` reads `profile.lifePathCode` and injects ONE soft-tendency line.

**Tech Stack:** Next.js 16 (App Router, Turbopack, RSC for the public result page), React 19, TypeScript, Tailwind v4, Vitest 4, `@lifeplanner/core` (imported in web via `@/domain/*`).

**Spec:** `docs/superpowers/specs/2026-06-29-life-path-code-viral-test-design.md` (v2).

**Supersedes:** the v1 forced-choice plan previously in this file.

---

## File Structure

**New (domain — pure, `packages/core/src/lifePathCode/`):**
- `axes.ts` — 4 axes / 8 letters / `Axes` / `LifePathCode` / `codeOf()`.
- `types.ts` — 16 `LifePathType` records + `typeByCode()` / `allTypes()`.
- `statements.ts` — the 28 statements (`{ id, axis, text, pole }`).
- `score.ts` — `scoreQuiz()` (weighted slider) + `riskAppetiteFromAxes()` + `styleHintForCode()`.
- `index.ts` — barrel.
- Tests: `packages/core/src/__tests__/lifePathCode.test.ts`.

**New (web):**
- `src/lib/shareConfig.ts` — `SHARE_DOMAIN` + `resultUrl()`.
- `src/lib/lifePathCardImage.ts` — pure SVG card builder + re-export `downloadShareSvg`.
- `src/components/LifePathCard.tsx` — on-screen card + save-image.
- `src/components/LifePathTest.tsx` — 28-statement slider quiz (client; reusable by `/test` and onboarding).
- `src/app/test/page.tsx` — standalone quiz route → stores result → `/t/[code]`.
- `src/app/t/[code]/page.tsx` + `src/app/t/[code]/ResultActions.tsx` — public result page + OG.

**Modified (web/domain):**
- `packages/core/src/types.ts` — add optional `lifePathCode?` + `lifePathAnswers?` to `Profile`.
- `src/lib/enrich.ts` — inject the soft-tendency line when `profile.lifePathCode` is set.
- `src/components/Onboarding.tsx` — read the pending test result from `sessionStorage`; set `riskAppetite`; persist `lifePathCode`/`lifePathAnswers`; add an entry link to `/test`.
- `src/components/TreeScreen.tsx` — add a "看看你是哪型 →" link to `/test`.
- `src/i18n/messages.ts` — additive EN entries for the new chrome.

---

## Conventions (read first)

- Domain is **pure**: no `Date.now()`, no `Math.random()`, no argless `new Date()` (ESLint blocks it). Scoring is a deterministic weighted tally — no RNG.
- Web imports domain via `@/domain/lifePathCode` (tsconfig maps `@/domain/*` → `packages/core/src/*`).
- Run the domain tests: `npx vitest run packages/core/src/__tests__/lifePathCode.test.ts`
- Type **content** (16 types, 28 statements) is Chinese data — NOT through `t()`. Only UI chrome (buttons/headings) uses `useT()` + gets EN entries in `messages.ts`.
- `RiskAppetite = "conservative" | "balanced" | "aggressive"` (`packages/core/src/types.ts:46`).
- Final gate before the last commit: the `/green` skill (tsc + vitest + next build, then clear `.next`).

---

### Task 1: Axes alphabet (`axes.ts`)

**Files:**
- Create: `packages/core/src/lifePathCode/axes.ts`
- Test: `packages/core/src/__tests__/lifePathCode.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { AXES, codeOf, type Axes } from "../lifePathCode/axes";

describe("lifePathCode/axes", () => {
  it("has 4 axes in fixed order with 8 distinct letters", () => {
    expect(AXES.map((a) => a.axis)).toEqual(["tempo", "focus", "engine", "drive"]);
    expect(new Set(AXES.flatMap((a) => [a.a, a.b])).size).toBe(8);
  });
  it("codeOf concatenates poles in axis order", () => {
    const axes: Axes = { tempo: "F", focus: "D", engine: "B", drive: "V" };
    expect(codeOf(axes)).toBe("FDBV");
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** (`Cannot find module '../lifePathCode/axes'`).

Run: `npx vitest run packages/core/src/__tests__/lifePathCode.test.ts`

- [ ] **Step 3: Implement `axes.ts`**

```ts
// 人生路径码的"字母表"：4 轴 × 2 字母 = 16 型。纯常量 + 拼接函数。
export type Axis = "tempo" | "focus" | "engine" | "drive";
export type Letter = "F" | "S" | "D" | "W" | "B" | "L" | "G" | "V";

export interface AxisDef {
  axis: Axis;
  a: Letter;
  b: Letter;
  labelA: string;
  labelB: string;
}

// 顺序即码的顺序：[F|S][D|W][B|L][G|V]
export const AXES: AxisDef[] = [
  { axis: "tempo", a: "F", b: "S", labelA: "闯", labelB: "稳" },
  { axis: "focus", a: "D", b: "W", labelA: "深", labelB: "广" },
  { axis: "engine", a: "B", b: "L", labelA: "自立", labelB: "借势" },
  { axis: "drive", a: "G", b: "V", labelA: "求稳", labelB: "求自我" },
];

export interface Axes {
  tempo: "F" | "S";
  focus: "D" | "W";
  engine: "B" | "L";
  drive: "G" | "V";
}

export type LifePathCode = string; // 4 letters, axis order

export function codeOf(a: Axes): LifePathCode {
  return `${a.tempo}${a.focus}${a.engine}${a.drive}`;
}
```

- [ ] **Step 4: Run test, expect PASS.**
- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lifePathCode/axes.ts packages/core/src/__tests__/lifePathCode.test.ts
git commit -m "feat(core): lifePathCode axes alphabet + codeOf"
```

---

### Task 2: The 16 types (`types.ts`)

**Files:**
- Create: `packages/core/src/lifePathCode/types.ts`
- Test: `packages/core/src/__tests__/lifePathCode.test.ts` (append)

- [ ] **Step 1: Append the failing test**

```ts
import { LIFE_PATH_TYPES, typeByCode, allTypes } from "../lifePathCode/types";

describe("lifePathCode/types", () => {
  it("covers all 16 codes exactly", () => {
    const codes = allTypes().map((t) => t.code).sort();
    expect(codes.length).toBe(16);
    expect(new Set(codes).size).toBe(16);
    for (const c of codes) expect(/^[FS][DW][BL][GV]$/.test(c)).toBe(true);
  });
  it("every type has non-empty content + a hex color + feasibility in band", () => {
    for (const t of allTypes()) {
      for (const s of [t.nickname, t.light, t.shadow, t.workStyle, t.teaser]) {
        expect(s.length).toBeGreaterThan(0);
      }
      expect(/^#[0-9a-fA-F]{6}$/.test(t.color)).toBe(true);
      expect(t.feasibility).toBeGreaterThanOrEqual(20);
      expect(t.feasibility).toBeLessThanOrEqual(85);
    }
  });
  it("typeByCode resolves or returns undefined", () => {
    expect(typeByCode("FDBV")?.nickname).toBe("孤勇拓荒者");
    expect(typeByCode("ZZZZ")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement `types.ts`** (full 16-type content — the core deliverable)

```ts
import type { LifePathCode } from "./axes";

export interface LifePathType {
  code: LifePathCode;
  nickname: string;
  light: string;    // 光：优势
  shadow: string;   // 影：代价/风险（诚实底线，必填）
  workStyle: string; // 职场打法 / 适合角色
  feasibility: number; // 0-100 粗估（非精确概率）
  color: string;    // 卡片/分支主色（hex）
  teaser: string;   // 一句未来走向，不含具体年龄
}

const T = (
  code: string, nickname: string, light: string, shadow: string,
  workStyle: string, feasibility: number, color: string, teaser: string,
): LifePathType => ({ code, nickname, light, shadow, workStyle, feasibility, color, teaser });

const LIST: LifePathType[] = [
  T("FDBG", "孤勇淘金者", "敢 all-in 赚钱方向、执行猛", "孤注一掷、赌错沉没成本大", "押一个能变现的硬方向，自己干、快进快出", 38, "#D85A30", "你大概率会先碰几次壁，钱和胆量一起练出来。"),
  T("FDBV", "孤勇拓荒者", "敢为天下先、死磕到底", "孤立无援、烧钱、易熬干", "认准一域自立门户，为信念长期投入", 40, "#D85A30", "你会先摔两跤，然后才看到光——那束光是你自己点的。"),
  T("FDLG", "快车道攀登者", "在好平台冲得快、回报高", "被体系绑架、卷到透支", "进大厂/头部，深耕一条线快速升级", 60, "#2f6fe0", "你大概率在大平台里快速升级，代价是很长一段高强度。"),
  T("FDLV", "体制内破局者", "在框架里推动真实改变", "理想撞现实、易心累出局", "借组织的势，深耕一域做有意义的改变", 50, "#7F77DD", "你会在规则里搞事情，能不能熬住决定你走多远。"),
  T("FWBG", "多线套利者", "嗅觉灵、机会捕手", "样样不精、易翻车", "自己开多个口子，哪个赚钱押哪个", 42, "#BA7517", "你会同时押好几注，赢的那注得够大才划算。"),
  T("FWBV", "多线冒险家", "好奇心强、敢试", "精力分散、难沉淀", "自立 + 多元探索，追新追热爱", 45, "#BA7517", "你会活得很热闹，最后看哪条线被你养大。"),
  T("FWLG", "机会冲浪者", "踩风口、换赛道快", "随波逐流、根基浅", "借平台、追风口，灵活换赛道求回报", 55, "#378ADD", "你会跟着风口跑，风停时手里有没有真东西是关键。"),
  T("FWLV", "斜杠理想家", "身份多元、活得精彩", "样样松、身份焦虑", "多平台斜杠，为自我表达活成多面", 48, "#D4537E", "你会有好几个标签，但总在问哪个才是真的自己。"),
  T("SDBG", "闷声匠人", "手艺做到顶、吃复利", "慢热、错过窗口、闷亏", "自己的小盘子，稳稳把一门手艺做精", 58, "#1D9E75", "你会安静地把一件事做精，时间久了才有人发现你。"),
  T("SDBV", "长期主义者", "耐寂寞、做难而正确的事", "回报太慢、易被磨平", "自立深耕，押长期价值、慢慢复利", 52, "#1D9E75", "你走的是慢路，能不能撑到复利那天是唯一的悬念。"),
  T("SDLG", "深耕守成派", "稳扎稳打、时间站你这边", "天花板早、温水煮青蛙", "在稳定平台深耕一线，求稳求保障", 70, "#2f6fe0", "你大概率过得稳当，要小心某天发现自己困在原地。"),
  T("SDLV", "体制内手艺人", "安静精进、有意义感", "被结构限制、理想缩水", "借体系的稳，专注精进、求内在意义", 62, "#7F77DD", "你会在一个位置上越做越好，代价是边界由别人定。"),
  T("SWBG", "稳健多面手", "东方不亮西方亮、抗风险", "不够聚焦、难做大", "自己经营多条稳当的小线、分散风险", 60, "#5b6478", "你不会大起大落，但也得接受很难有高光时刻。"),
  T("SWBV", "自在生活家", "生活丰富、自洽", "难积累、世俗成就有限", "自立 + 多元，把生活过舒服优先", 55, "#D4537E", "你会把日子过舒服，世俗那把尺子量不太到你。"),
  T("SWLG", "稳进多栖者", "多份保障、稳", "平庸感、缺少高光", "借平台 + 多栖，稳稳攒保障", 65, "#5b6478", "你会稳稳当当攒下一份安稳，偶尔会想是不是太安全了。"),
  T("SWLV", "随遇而安者", "松弛、随缘、知足", "目标感弱、易随波逐流", "借势、不强求，顺势而活求自洽", 58, "#5b6478", "你会顺势而活，幸福与否取决于你是否真的甘心。"),
];

export const LIFE_PATH_TYPES: Record<LifePathCode, LifePathType> =
  Object.fromEntries(LIST.map((t) => [t.code, t]));

export function typeByCode(code: string): LifePathType | undefined {
  return LIFE_PATH_TYPES[code];
}

export function allTypes(): LifePathType[] {
  return LIST.slice();
}
```

- [ ] **Step 4: Run test, expect PASS.**
- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lifePathCode/types.ts packages/core/src/__tests__/lifePathCode.test.ts
git commit -m "feat(core): 16 career-path types (code/nickname/light/shadow/workStyle/...)"
```

---

### Task 3: The 28 statements (`statements.ts`)

**Files:**
- Create: `packages/core/src/lifePathCode/statements.ts`
- Test: `packages/core/src/__tests__/lifePathCode.test.ts` (append)

- [ ] **Step 1: Append the failing test**

```ts
import { STATEMENTS } from "../lifePathCode/statements";
import { AXES } from "../lifePathCode/axes";

describe("lifePathCode/statements", () => {
  it("has 28 statements, 7 per axis, each leaning a valid pole of its axis", () => {
    expect(STATEMENTS.length).toBe(28);
    for (const def of AXES) {
      const forAxis = STATEMENTS.filter((s) => s.axis === def.axis);
      expect(forAxis.length).toBe(7);
      for (const s of forAxis) expect([def.a, def.b]).toContain(s.pole);
      // mixed-keyed: each axis has at least one of each pole (reduces acquiescence bias)
      expect(forAxis.some((s) => s.pole === def.a)).toBe(true);
      expect(forAxis.some((s) => s.pole === def.b)).toBe(true);
    }
  });
  it("statement ids are unique and non-empty text", () => {
    expect(new Set(STATEMENTS.map((s) => s.id)).size).toBe(28);
    for (const s of STATEMENTS) expect(s.text.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement `statements.ts`** (verbatim from spec §3)

```ts
import type { Axis, Letter } from "./axes";

export interface QuizStatement {
  id: string;
  axis: Axis;
  text: string;
  pole: Letter; // 同意（符合）时偏向的极
}

// 28 条，每轴 7 条，混合 keying（同一轴里既有 A 极也有 B 极的陈述），降低"一律同意"偏差。
export const STATEMENTS: QuizStatement[] = [
  { id: "t1", axis: "tempo", pole: "F", text: "看到一个不稳但可能爆发的机会，我会忍不住想冲进去。" },
  { id: "t2", axis: "tempo", pole: "S", text: "重大职业决定前，我一定要把风险想清楚才敢动。" },
  { id: "t3", axis: "tempo", pole: "F", text: "与其稳稳当当，我更怕错过一个大机会。" },
  { id: "t4", axis: "tempo", pole: "S", text: "稳定、可预期的工作让我更安心。" },
  { id: "t5", axis: "tempo", pole: "F", text: "我做事常常先干起来，边做边调整。" },
  { id: "t6", axis: "tempo", pole: "S", text: "没准备好之前，我不会轻易出手。" },
  { id: "t7", axis: "tempo", pole: "F", text: "为了更大的回报，我愿意承担别人觉得太冒险的选择。" },

  { id: "f1", axis: "focus", pole: "D", text: "我愿意十年磨一剑，把一件事做到顶尖。" },
  { id: "f2", axis: "focus", pole: "W", text: "我喜欢同时涉猎很多领域，什么都想试试。" },
  { id: "f3", axis: "focus", pole: "D", text: "成为某个领域的专家，比"什么都会一点"更吸引我。" },
  { id: "f4", axis: "focus", pole: "W", text: "只押一个方向会让我不安，我更想多线下注。" },
  { id: "f5", axis: "focus", pole: "D", text: "我做事喜欢往深里钻，而不是浅尝辄止。" },
  { id: "f6", axis: "focus", pole: "W", text: "跨界、什么都拿得起的人最让我欣赏。" },
  { id: "f7", axis: "focus", pole: "D", text: "把一项技能练到极致，是我的成就感来源。" },

  { id: "e1", axis: "engine", pole: "B", text: "理想状态是自己从零搭一个东西。" },
  { id: "e2", axis: "engine", pole: "L", text: "进一个好平台、借它的势往上走，更聪明。" },
  { id: "e3", axis: "engine", pole: "B", text: "我更愿意靠自己定义规则，而不是适应别人的规则。" },
  { id: "e4", axis: "engine", pole: "L", text: "背后有靠谱的组织/平台，我才更踏实。" },
  { id: "e5", axis: "engine", pole: "B", text: "手里有自己的盘子，比拿高薪更让我安心。" },
  { id: "e6", axis: "engine", pole: "L", text: "站在巨人肩上，比单打独斗走得更快。" },
  { id: "e7", axis: "engine", pole: "B", text: "哪怕更难，我也想做自己说了算的事。" },

  { id: "d1", axis: "drive", pole: "G", text: "选工作我首先看回报和保障。" },
  { id: "d2", axis: "drive", pole: "V", text: "一份工作有没有意义，比赚多少更重要。" },
  { id: "d3", axis: "drive", pole: "G", text: "我最怕的是晚景不安稳、没有保障。" },
  { id: "d4", axis: "drive", pole: "V", text: "我最怕的是一辈子没做成一件有意义的事。" },
  { id: "d5", axis: "drive", pole: "G", text: "钱和安全感是我职业的底线。" },
  { id: "d6", axis: "drive", pole: "V", text: "能不能实现自我，是我职业的底线。" },
  { id: "d7", axis: "drive", pole: "G", text: "只要够稳够安全，平淡一点我也能接受。" },
];
```

> NOTE: statement `f3` contains ASCII double-quotes around 什么都会一点. ASCII `"` inside a JS string literal that is itself double-quoted will break it. Write `f3`'s text with the inner quotes as Chinese quotes 「」: `成为某个领域的专家，比「什么都会一点」更吸引我。` (per the i18n rule: never put ASCII `"` inside Chinese text).

- [ ] **Step 4: Run test, expect PASS.**
- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lifePathCode/statements.ts packages/core/src/__tests__/lifePathCode.test.ts
git commit -m "feat(core): 28 career-personality statements (7 per axis, mixed-keyed)"
```

---

### Task 4: Weighted scoring + helpers (`score.ts`)

**Files:**
- Create: `packages/core/src/lifePathCode/score.ts`
- Test: `packages/core/src/__tests__/lifePathCode.test.ts` (append)

- [ ] **Step 1: Append the failing test**

```ts
import { scoreQuiz, riskAppetiteFromAxes, styleHintForCode, type QuizAnswer } from "../lifePathCode/score";
import { STATEMENTS } from "../lifePathCode/statements";

// helper: answer every statement "非常符合" (+2) → each axis resolves to the pole the
// majority of its statements lean. With mixed keying, majority pole per axis = whichever
// pole has ≥4 of the 7 statements.
function agreeAll(): QuizAnswer[] {
  return STATEMENTS.map((s) => ({ statementId: s.id, value: 2 as const }));
}

describe("lifePathCode/score", () => {
  it("is deterministic and returns a content-backed code", () => {
    const a = agreeAll();
    const r1 = scoreQuiz(a);
    const r2 = scoreQuiz(a);
    expect(r1.code).toBe(r2.code);
    expect(/^[FS][DW][BL][GV]$/.test(r1.code)).toBe(true);
  });
  it("all-neutral (or empty) → TIE_DEFAULT code SDLG", () => {
    expect(scoreQuiz([]).code).toBe("SDLG");
    expect(scoreQuiz(STATEMENTS.map((s) => ({ statementId: s.id, value: 0 as const }))).code).toBe("SDLG");
  });
  it("strongly agreeing only with F/D/B/V statements yields FDBV", () => {
    const ans: QuizAnswer[] = STATEMENTS.map((s) => ({
      statementId: s.id,
      value: (["F", "D", "B", "V"].includes(s.pole) ? 2 : -2) as QuizAnswer["value"],
    }));
    expect(scoreQuiz(ans).code).toBe("FDBV");
  });
  it("riskAppetiteFromAxes maps tempo F→aggressive, S→conservative", () => {
    expect(riskAppetiteFromAxes({ tempo: "F", focus: "D", engine: "B", drive: "V" })).toBe("aggressive");
    expect(riskAppetiteFromAxes({ tempo: "S", focus: "D", engine: "L", drive: "G" })).toBe("conservative");
  });
  it("styleHintForCode returns a non-empty clause naming the type", () => {
    const h = styleHintForCode("FDBV");
    expect(h).toContain("孤勇拓荒者");
    expect(h.length).toBeGreaterThan(10);
    expect(styleHintForCode("ZZZZ")).toBe(""); // unknown code → empty (no injection)
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement `score.ts`**

```ts
import { AXES, codeOf, type Axes, type Axis, type Letter, type LifePathCode } from "./axes";
import { STATEMENTS } from "./statements";
import { typeByCode } from "./types";

export type SliderValue = -2 | -1 | 0 | 1 | 2; // 非常符合(+2) … 完全不符合(-2)
export interface QuizAnswer {
  statementId: string;
  value: SliderValue;
}

// 平票/缺答时的默认极：偏稳健、求实（保守兜底，符合"诚实不夸大"基调）。→ 默认码 SDLG
const TIE_DEFAULT: Record<Axis, Letter> = { tempo: "S", focus: "D", engine: "L", drive: "G" };
const ST_BY_ID = new Map(STATEMENTS.map((s) => [s.id, s]));

export function scoreQuiz(answers: QuizAnswer[]): { code: LifePathCode; axes: Axes } {
  // 每轴累加：陈述偏 a 极 → +value；偏 b 极 → -value。>0 取 a，<0 取 b，=0 取默认极。
  const score: Record<Axis, number> = { tempo: 0, focus: 0, engine: 0, drive: 0 };
  for (const ans of answers) {
    const st = ST_BY_ID.get(ans.statementId);
    if (!st) continue;
    const def = AXES.find((a) => a.axis === st.axis)!;
    score[st.axis] += st.pole === def.a ? ans.value : -ans.value;
  }
  const pick = (def: (typeof AXES)[number]): Letter =>
    score[def.axis] > 0 ? def.a : score[def.axis] < 0 ? def.b : TIE_DEFAULT[def.axis];
  const axes: Axes = {
    tempo: pick(AXES[0]) as Axes["tempo"],
    focus: pick(AXES[1]) as Axes["focus"],
    engine: pick(AXES[2]) as Axes["engine"],
    drive: pick(AXES[3]) as Axes["drive"],
  };
  return { axes, code: codeOf(axes) };
}

// tempo → 现有 Profile.riskAppetite（已经经 financialFacts 进预测提示词）。
export function riskAppetiteFromAxes(axes: Axes): "conservative" | "balanced" | "aggressive" {
  return axes.tempo === "F" ? "aggressive" : "conservative";
}

const LETTER_HINT: Record<Letter, string> = {
  F: "倾向冒险抢先", S: "偏稳健谨慎",
  D: "死磕一域", W: "多线开花",
  B: "想自己造盘子", L: "善于借平台的势",
  G: "以回报和安全为先", V: "以意义和自我实现为先",
};

// 给预测提示词的一行"软性倾向"。未知码 → 空串（不注入）。
export function styleHintForCode(code: string): string {
  const t = typeByCode(code);
  if (!t) return "";
  const clauses = (code.split("") as Letter[]).map((c) => LETTER_HINT[c]).filter(Boolean).join("、");
  return `${t.nickname}：${clauses}`;
}
```

- [ ] **Step 4: Run test, expect PASS.**
- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lifePathCode/score.ts packages/core/src/__tests__/lifePathCode.test.ts
git commit -m "feat(core): weighted slider scoreQuiz + riskAppetiteFromAxes + styleHintForCode"
```

---

### Task 5: Module barrel (`index.ts`)

**Files:** Create `packages/core/src/lifePathCode/index.ts`

- [ ] **Step 1: Implement**

```ts
export * from "./axes";
export * from "./types";
export * from "./statements";
export * from "./score";
```

- [ ] **Step 2: Run the whole module test** — `npx vitest run packages/core/src/__tests__/lifePathCode.test.ts` → all PASS.
- [ ] **Step 3: Commit** — `git add packages/core/src/lifePathCode/index.ts && git commit -m "feat(core): lifePathCode barrel"`

---

### Task 6: Profile optional fields

**Files:** Modify `packages/core/src/types.ts` (the `Profile` interface, after `riskAppetite?` at line ~70)

- [ ] **Step 1: Add fields**

```ts
  riskAppetite?: RiskAppetite;   // 风险偏好
  // 职场人格测试结果（可选；旧数据无此字段，optional 即 backfill，无需迁移）
  lifePathCode?: string;         // 4 字母码，如 "FDBV"
  lifePathAnswers?: { statementId: string; value: number }[]; // 原始答案（便于复算/回显）
```

- [ ] **Step 2: tsc** — `npx tsc --noEmit` → clean. (Optional fields; `normalizeLoadedTree` spreads `profile`, so old trees load unchanged and new fields persist.)
- [ ] **Step 3: Commit** — `git add packages/core/src/types.ts && git commit -m "feat(core): Profile.lifePathCode + lifePathAnswers (optional, backfilled)"`

---

### Task 7: Share config (`shareConfig.ts`)

**Files:** Create `src/lib/shareConfig.ts`

- [ ] **Step 1: Implement** (trivial constant — no test)

```ts
// 分享域名：卡片底注 + OG 链接预览。换正式域名改这一处（或设 NEXT_PUBLIC_SHARE_DOMAIN）。
export const SHARE_DOMAIN =
  process.env.NEXT_PUBLIC_SHARE_DOMAIN?.trim() || "life-planer-opal.vercel.app";

export function resultUrl(code: string): string {
  return `https://${SHARE_DOMAIN}/t/${code}`;
}
```

- [ ] **Step 2: Commit** — `git add src/lib/shareConfig.ts && git commit -m "feat(web): SHARE_DOMAIN config + resultUrl"`

---

### Task 8: Card image builder (`lifePathCardImage.ts`)

**Files:**
- Create: `src/lib/lifePathCardImage.ts`
- Test: `src/lib/__tests__/lifePathCardImage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildLifePathCardSvg } from "../lifePathCardImage";
import { typeByCode } from "@/domain/lifePathCode";

describe("buildLifePathCardSvg", () => {
  it("self-contained SVG with code + nickname, no CSS vars", () => {
    const t = typeByCode("FDBV")!;
    const svg = buildLifePathCardSvg(t, { domain: "example.app", disclaimer: "AI 粗估" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("FDBV");
    expect(svg).toContain("孤勇拓荒者");
    expect(svg).not.toContain("var(--");
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `npx vitest run src/lib/__tests__/lifePathCardImage.test.ts`

- [ ] **Step 3: Implement `lifePathCardImage.ts`** (mirror `treeShareImage.ts`: pure SVG string, inlined hex, `esc()`; re-export `downloadShareSvg`)

```ts
import type { LifePathType } from "@/domain/lifePathCode";

const BG = "#ffffff";
const FG = "#1d1d1f";
const FG_DIM = "#6e6e73";
const FG_FAINT = "#8e8e93";
const LINE = "#e5e5ea";
const LIGHT_C = "#0F6E56";
const SHADOW_C = "#A32D2D";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface CardLabels { domain: string; disclaimer: string }

export function buildLifePathCardSvg(t: LifePathType, labels: CardLabels): string {
  const W = 600, H = 860, cx = W / 2;
  const accent = /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : "#D85A30";
  const L: string[] = [];
  L.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`);
  L.push(`  <rect x="0" y="0" width="${W}" height="${H}" fill="${BG}"/>`);
  L.push(`  <rect x="0" y="0" width="${W}" height="10" fill="${accent}"/>`);
  L.push(`  <text x="${cx}" y="88" text-anchor="middle" font-size="20" fill="${FG_FAINT}" font-family="sans-serif">职场人格测试 · 我的结果</text>`);
  L.push(`  <text x="${cx}" y="200" text-anchor="middle" font-size="92" font-weight="800" letter-spacing="8" fill="${accent}" font-family="sans-serif">${esc(t.code)}</text>`);
  L.push(`  <text x="${cx}" y="278" text-anchor="middle" font-size="44" font-weight="700" fill="${FG}" font-family="sans-serif">${esc(t.nickname)}</text>`);
  L.push(`  <text x="${cx}" y="330" text-anchor="middle" font-size="21" fill="${FG_DIM}" font-family="sans-serif">${esc(t.teaser)}</text>`);
  L.push(`  <text x="56" y="424" font-size="22" font-weight="700" fill="${LIGHT_C}" font-family="sans-serif">光</text>`);
  L.push(`  <text x="104" y="424" font-size="21" fill="${FG_DIM}" font-family="sans-serif">${esc(t.light)}</text>`);
  L.push(`  <text x="56" y="470" font-size="22" font-weight="700" fill="${SHADOW_C}" font-family="sans-serif">影</text>`);
  L.push(`  <text x="104" y="470" font-size="21" fill="${FG_DIM}" font-family="sans-serif">${esc(t.shadow)}</text>`);
  L.push(`  <text x="56" y="520" font-size="21" fill="${FG_DIM}" font-family="sans-serif">打法：${esc(t.workStyle)}</text>`);
  L.push(`  <rect x="56" y="560" width="${W - 112}" height="110" rx="16" fill="#f5f5f7"/>`);
  L.push(`  <text x="80" y="608" font-size="22" fill="${FG_DIM}" font-family="sans-serif">这条路现实可行度</text>`);
  L.push(`  <text x="${W - 80}" y="620" text-anchor="end" font-size="48" font-weight="700" fill="${FG}" font-family="sans-serif">约 ${t.feasibility}%</text>`);
  L.push(`  <text x="80" y="646" font-size="16" fill="${FG_FAINT}" font-family="sans-serif">${esc(labels.disclaimer)}</text>`);
  L.push(`  <line x1="56" y1="752" x2="${W - 56}" y2="752" stroke="${LINE}" stroke-width="1"/>`);
  L.push(`  <text x="56" y="800" font-size="24" font-weight="700" fill="${accent}" font-family="sans-serif">28 题测你的 →</text>`);
  L.push(`  <text x="${W - 56}" y="800" text-anchor="end" font-size="18" fill="${FG_FAINT}" font-family="sans-serif">${esc(labels.domain)}</text>`);
  L.push(`</svg>`);
  return L.join("\n");
}

export { downloadShareSvg } from "./treeShareImage";
```

- [ ] **Step 4: Run test, expect PASS.**
- [ ] **Step 5: Commit** — `git add src/lib/lifePathCardImage.ts src/lib/__tests__/lifePathCardImage.test.ts && git commit -m "feat(web): pure SVG builder for the career-type share card"`

---

### Task 9: On-screen card (`LifePathCard.tsx`)

**Files:** Create `src/components/LifePathCard.tsx`

- [ ] **Step 1: Implement** (matches the approved mockup; download uses Task 8; `useT` chrome only)

```tsx
"use client";

import type { LifePathType } from "@/domain/lifePathCode";
import { useT } from "@/prefs/PreferencesContext";
import { SHARE_DOMAIN } from "@/lib/shareConfig";
import { buildLifePathCardSvg, downloadShareSvg } from "@/lib/lifePathCardImage";

const DISCLAIMER = "AI 粗估，非精确概率 · 会随你的真实努力上升";

export function LifePathCard({ type }: { type: LifePathType }) {
  const { t } = useT();
  function onDownload() {
    const svg = buildLifePathCardSvg(type, { domain: SHARE_DOMAIN, disclaimer: "AI 粗估，非精确概率" });
    downloadShareSvg(svg, `career-type-${type.code}.svg`);
  }
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="lp-card overflow-hidden p-5" style={{ borderTop: `4px solid ${type.color}` }}>
        <div className="mb-3 flex items-center justify-between text-[11px] text-[var(--fg-faint)]">
          <span>{t("职场人格测试 · 我的结果")}</span><span>{t("人生树")}</span>
        </div>
        <div className="mb-2 flex gap-1.5">
          {type.code.split("").map((ch, i) => (
            <span key={i} className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold" style={{ backgroundColor: `${type.color}1a`, color: type.color }}>{ch}</span>
          ))}
        </div>
        <div className="text-[26px] font-semibold text-[var(--fg)]">{type.nickname}</div>
        <p className="mt-1 text-sm leading-relaxed text-[var(--fg-dim)]">{type.teaser}</p>
        <div className="mt-4 flex gap-2 text-[13px]"><span className="font-semibold text-[var(--c-emerald)]">{t("光")}</span><span className="text-[var(--fg-dim)]">{type.light}</span></div>
        <div className="mt-1.5 flex gap-2 text-[13px]"><span className="font-semibold text-[var(--c-rose)]">{t("影")}</span><span className="text-[var(--fg-dim)]">{type.shadow}</span></div>
        <div className="mt-1.5 flex gap-2 text-[13px]"><span className="font-semibold text-[var(--fg-faint)]">{t("打法")}</span><span className="text-[var(--fg-dim)]">{type.workStyle}</span></div>
        <div className="mt-4 rounded-2xl bg-[var(--bg-2)] px-3 py-2.5">
          <div className="flex items-baseline justify-between"><span className="text-[13px] text-[var(--fg-dim)]">{t("这条路现实可行度")}</span><span className="text-xl font-semibold text-[var(--fg)]">{t("约 {n}%", { n: type.feasibility })}</span></div>
          <p className="mt-1 text-[11px] text-[var(--fg-faint)]">{DISCLAIMER}</p>
        </div>
      </div>
      <button onClick={onDownload} className="lp-tap mt-3 inline-flex w-full items-center justify-center rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]">
        {t("保存这张卡")}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: tsc** (`npx tsc --noEmit`) clean.
- [ ] **Step 3: Commit** — `git add src/components/LifePathCard.tsx && git commit -m "feat(web): LifePathCard on-screen card + save image"`

---

### Task 10: Public result page (`/t/[code]`) + OG

**Files:** Create `src/app/t/[code]/page.tsx` + `src/app/t/[code]/ResultActions.tsx`

- [ ] **Step 1: Implement `ResultActions.tsx`** (client CTAs; stash nothing — code already in URL)

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/prefs/PreferencesContext";

export function ResultActions() {
  const router = useRouter();
  const { t } = useT();
  return (
    <div className="mx-auto mt-5 flex w-full max-w-sm flex-col gap-2">
      <button onClick={() => router.push("/test")} className="lp-tap inline-flex items-center justify-center rounded-full bg-[image:var(--grad-accent)] px-5 py-2.5 text-sm font-semibold text-white">{t("28 题测你的")}</button>
      <button onClick={() => router.push("/")} className="lp-tap inline-flex items-center justify-center rounded-full border border-[var(--line)] px-5 py-2.5 text-sm text-[var(--fg-dim)] transition hover:text-[var(--fg)]">{t("填完整资料，生成你真正的人生树 →")}</button>
    </div>
  );
}
```

- [ ] **Step 2: Implement `page.tsx`** (server component; OG; invalid → notFound)

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { typeByCode } from "@/domain/lifePathCode";
import { LifePathCard } from "@/components/LifePathCard";
import { ResultActions } from "./ResultActions";
import { SHARE_DOMAIN } from "@/lib/shareConfig";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const t = typeByCode(code.toUpperCase());
  if (!t) return { title: "职场人格测试" };
  const title = `${t.code} · ${t.nickname} | 职场人格测试`;
  const description = `${t.teaser} ｜ 28 题测你的职场人格`;
  return { title, description, openGraph: { title, description, url: `https://${SHARE_DOMAIN}/t/${t.code}` }, twitter: { card: "summary_large_image", title, description } };
}

export default async function ResultPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const type = typeByCode(code.toUpperCase());
  if (!type) notFound();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <LifePathCard type={type} />
      <ResultActions />
    </main>
  );
}
```

> Next 16 dynamic routes pass `params` as a Promise (hence `await params`). If tsc/build disagrees for the installed version, check `node_modules/next/dist/docs` and match its API.

- [ ] **Step 3: tsc** (`npx tsc --noEmit`).
- [ ] **Step 4: Manual smoke** (`npm run dev`): `/t/FDBV` → card + 2 CTAs; `/t/zzzz` → 404.
- [ ] **Step 5: Commit** — `git add src/app/t/ && git commit -m "feat(web): public /t/[code] result page with OG"`

---

### Task 11: Slider quiz component (`LifePathTest.tsx`)

**Files:** Create `src/components/LifePathTest.tsx`

- [ ] **Step 1: Implement** (28 statements, one at a time, 5-point slider; calls `onDone({code, answers})`)

```tsx
"use client";

import { useState } from "react";
import { useT } from "@/prefs/PreferencesContext";
import { STATEMENTS, scoreQuiz, type QuizAnswer, type SliderValue } from "@/domain/lifePathCode";

const CHOICES: { v: SliderValue; label: string }[] = [
  { v: 2, label: "非常符合" }, { v: 1, label: "比较符合" }, { v: 0, label: "中立" },
  { v: -1, label: "不太符合" }, { v: -2, label: "完全不符合" },
];

export function LifePathTest({ onDone }: { onDone: (r: { code: string; answers: QuizAnswer[] }) => void }) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const s = STATEMENTS[i];
  const total = STATEMENTS.length;

  function answer(v: SliderValue) {
    const next = [...answers.filter((a) => a.statementId !== s.id), { statementId: s.id, value: v }];
    setAnswers(next);
    if (i + 1 < total) setI(i + 1);
    else onDone({ code: scoreQuiz(next).code, answers: next });
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="mb-8 flex gap-1.5">
        {STATEMENTS.map((_, k) => (
          <div key={k} className="h-1 flex-1 rounded-full" style={{ background: k <= i ? "var(--accent)" : "rgba(0,0,0,0.12)" }} />
        ))}
      </div>
      <div className="text-xs uppercase tracking-[3px] text-[var(--fg-faint)]">{t("职场人格测试")} · {i + 1}/{total}</div>
      <h1 className="mt-3 min-h-[4.5rem] text-2xl font-semibold leading-snug text-[var(--fg)]">{s.text}</h1>
      <div className="mt-6 flex flex-col gap-2.5">
        {CHOICES.map((c) => (
          <button key={c.v} onClick={() => answer(c.v)} className="lp-tap rounded-2xl border border-[var(--line)] px-5 py-3.5 text-left text-base text-[var(--fg)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/[0.06]">
            {c.label}
          </button>
        ))}
      </div>
      {i > 0 && (
        <button onClick={() => setI(i - 1)} className="mt-6 self-start text-sm text-[var(--fg-faint)] transition hover:text-[var(--fg-dim)]">{t("← 上一题")}</button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: tsc** (`npx tsc --noEmit`).
- [ ] **Step 3: Commit** — `git add src/components/LifePathTest.tsx && git commit -m "feat(web): 28-statement slider quiz component"`

---

### Task 12: Standalone `/test` route

**Files:** Create `src/app/test/page.tsx`

- [ ] **Step 1: Implement** (renders the test; on finish, stash `{code, answers}` in sessionStorage for the onboarding upsell, then route to `/t/[code]`)

```tsx
"use client";

import { useRouter } from "next/navigation";
import { LifePathTest } from "@/components/LifePathTest";

export default function TestPage() {
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <LifePathTest
        onDone={({ code, answers }) => {
          try {
            sessionStorage.setItem("lp.lifePath", JSON.stringify({ code, answers }));
          } catch {
            /* sessionStorage 不可用时无所谓，码已在 URL */
          }
          router.push(`/t/${code}`);
        }}
      />
    </main>
  );
}
```

- [ ] **Step 2: tsc** + manual smoke (`/test` → answer 28 → `/t/<code>`).
- [ ] **Step 3: Commit** — `git add src/app/test/ && git commit -m "feat(web): /test slider quiz route → /t/[code]"`

---

### Task 13: Feed the type into the prediction (`enrich.ts` §5.2)

**Files:** Modify `src/lib/enrich.ts` (`buildUserPrompt`)

- [ ] **Step 1: Import the helper** — at the top of `enrich.ts`, add to the domain import:

```ts
import { styleHintForCode } from "@/domain/lifePathCode";
```

- [ ] **Step 2: Inject the soft line** — in `buildUserPrompt`, right after the `现状（既定事实…）` line and before the visa block (around `if (isUSVisa(p)) ...`), add:

```ts
  // 职场人格倾向（软性背景）：影响他更可能做的选择与走向，但不得凌驾真实事实。
  if (p.lifePathCode) {
    const hint = styleHintForCode(p.lifePathCode);
    if (hint) {
      lines.push(
        `职场决策风格（软性倾向，仅供参考）：${hint}。把它当作他更可能的倾向，影响选择与走向；但绝不可凌驾于真实事实（年龄/收入/签证/所在地）之上，也不可写成"因为他是某型所以必然如何"。`,
      );
    }
  }
```

(Use Chinese quotes 「」 around 因为…如何 if ASCII quotes would break the literal — match the existing file's quoting style.)

- [ ] **Step 3: tsc** (`npx tsc --noEmit`) — `p.lifePathCode` now exists on `Profile` (Task 6).
- [ ] **Step 4: Optional eval** (if a DeepSeek key is configured): POST `/api/enrich` with a profile that has `lifePathCode: "FDBV"` and confirm the output leans toward the tendency without contradicting facts. (Not a blocking gate; the line is additive + guarded.)
- [ ] **Step 5: Commit** — `git add src/lib/enrich.ts && git commit -m "feat(predict): inject soft career-type tendency line when profile.lifePathCode set"`

---

### Task 14: Onboarding reads the test result + persists it

**Files:** Modify `src/components/Onboarding.tsx`

- [ ] **Step 1: Read pending result on mount + pre-set riskAppetite.** Add near the top of the component (after the existing `useState`s), importing what's needed:

```tsx
import { useEffect } from "react";
import { scoreQuiz, riskAppetiteFromAxes, type QuizAnswer } from "@/domain/lifePathCode";
```

```tsx
  const [lifePathCode, setLifePathCode] = useState<string | undefined>(undefined);
  const [lifePathAnswers, setLifePathAnswers] = useState<QuizAnswer[] | undefined>(undefined);

  // 从 /test 跳来的：读出测试结果，预置风险偏好（不覆盖用户后续手动修改）。
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("lp.lifePath");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { code: string; answers: QuizAnswer[] };
      if (!parsed?.code) return;
      setLifePathCode(parsed.code);
      setLifePathAnswers(parsed.answers);
      const { axes } = scoreQuiz(parsed.answers);
      setRiskAppetite(riskAppetiteFromAxes(axes));
      sessionStorage.removeItem("lp.lifePath");
    } catch {
      /* 忽略坏数据 */
    }
  }, []);
```

> NOTE: `riskAppetite` state in `Onboarding.tsx` is typed `RiskAppetite | ""`. `riskAppetiteFromAxes` returns a concrete `RiskAppetite`, so `setRiskAppetite(...)` is type-safe. Verify the exact state setter name when editing.

- [ ] **Step 2: Persist on submit.** In the `submit()` function, add `lifePathCode` + `lifePathAnswers` to the `inputs` object (so they flow into the `Profile`):

```ts
      riskAppetite: riskAppetite || undefined,
      lifePathCode: lifePathCode,
      lifePathAnswers: lifePathAnswers,
```

- [ ] **Step 3: Add a `/test` entry link** on step 0 (under the subtitle `<p>`), for users who land on onboarding directly:

```tsx
<a href="/test" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] transition hover:underline">
  {t("先 28 题测你的职场人格 →")}
</a>
```

- [ ] **Step 4: tsc** (`npx tsc --noEmit`) — confirm `inputs` is assignable to `ProfileInputs`/`Profile` with the two new optional fields.
- [ ] **Step 5: Manual smoke** (`npm run dev`): `/test` → finish → `/t/[code]` → "填完整…" → `/` onboarding (risk pre-set) → generate → tree exists; reload tree, inspect `localStorage` `lifeplanner.tree.v3` → `profile.lifePathCode` present.
- [ ] **Step 6: Commit** — `git add src/components/Onboarding.tsx && git commit -m "feat(web): onboarding reads test result → riskAppetite + persists lifePathCode"`

---

### Task 15: Tree-screen entry + i18n + green gate

**Files:** Modify `src/components/TreeScreen.tsx`, `src/i18n/messages.ts`

- [ ] **Step 1: Tree-screen entry link** — in the header action row (near 分享/添加岔路/重置), slot a link matching the existing buttons' wrapper:

```tsx
<a href="/test" className="lp-tap inline-flex items-center justify-center rounded-full border border-[var(--line)] px-3.5 py-1.5 text-xs text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]">
  {t("看看你是哪型")}
</a>
```

- [ ] **Step 2: i18n EN entries** (additions-only; quoted Chinese-punctuation keys; skip any that already exist like `"人生树"`):

```ts
"职场人格测试 · 我的结果": "Career Type Test · My result",
"职场人格测试": "Career Type Test",
"光": "Up",
"影": "Down",
"打法": "Play",
"这条路现实可行度": "How reachable this path is",
"约 {n}%": "~{n}%",
"保存这张卡": "Save this card",
"28 题测你的": "Take the 28-question test",
"填完整资料，生成你真正的人生树 →": "Fill in your details → grow your real life tree →",
"← 上一题": "← Back",
"先 28 题测你的职场人格 →": "First, a 28-question career-type test →",
"看看你是哪型": "Find your type",
```

- [ ] **Step 3: Run the `/green` skill** (tsc + vitest + next build, then clear `.next`). All three must pass (incl. new `lifePathCode.test.ts` + `lifePathCardImage.test.ts`).

- [ ] **Step 4: Full manual smoke** (`npm run dev`):
  - `/test` → 28 sliders → `/t/<code>` card (光/影/打法/约X%) + "保存这张卡" downloads SVG.
  - "28 题测你的" → `/test`; "填完整…" → onboarding with risk pre-set → generate tree.
  - Onboarding + tree screen show `/test` entry links.
  - `/t/zzzz` → 404.

- [ ] **Step 5: Update `progress.md`** (what shipped; P2 deferred: §5.3 pre-seeded branch, compare/CP mode, mobile /test, AI teaser, analytics) and **commit**.

- [ ] **Step 6: Fast-forward `master` + push** (trunk rule): `git checkout master && git merge --ff-only <branch> && git push origin master && git checkout <branch> && git push`.

---

## Self-Review (against spec v2)

- **§2 axes/letters/code** → Task 1. ✓
- **§2 16 types (incl. workStyle, feasibility, color, teaser)** → Task 2. ✓
- **§3 28 statements (7/axis, mixed-keyed)** → Task 3 (verbatim). ✓
- **§3 5-point slider + weighted deterministic scoring + TIE_DEFAULT SDLG** → Tasks 4 (`scoreQuiz`) + 11 (slider UI). ✓
- **§4 unified test-first flow** → `/test` (Task 12) + onboarding handoff via sessionStorage (Task 14). ✓
- **§5.1 tempo→riskAppetite** → `riskAppetiteFromAxes` (Task 4) applied in onboarding (Task 14); already reaches prompt via `financialFacts`. ✓
- **§5.2 soft prompt line** → Task 13 (reads `profile.lifePathCode`, guarded). ✓
- **§5.3 pre-seeded branch** → P2, explicitly not in plan. ✓ (spec §9)
- **§6 Profile.lifePathCode + lifePathAnswers (optional, backfilled)** → Task 6. ✓
- **§7 honesty: 光+影 mandatory, 约X%+disclaimer, soft-not-destiny** → Task 2 test asserts 光+影 non-empty; card disclaimer (Tasks 8–9); enrich guardrail wording (Task 13). ✓
- **§8 architecture: pure domain, reuse palette/export/onboarding/enrich, no new AI route** → Tasks 1–14 (no `/api/*` added). ✓
- **§8 i18n additive** → Task 15. ✓
- **§9 zh-only P1; compare/mobile/AI-teaser/§5.3 deferred** → respected. ✓
- **§10 testing** → Tasks 2/3/4 domain tests + Task 15 green + smoke. ✓

**Placeholder scan:** no TBD/TODO; every code step has complete code. The Next-16 `params` Promise note (Task 10) and the f3 ASCII-quote note (Task 3) are explicit correctness guards, not placeholders.

**Type consistency:** `Axes`/`Letter`/`LifePathCode`/`LifePathType`/`SliderValue`/`QuizAnswer`/`QuizStatement`/`scoreQuiz`/`riskAppetiteFromAxes`/`styleHintForCode`/`typeByCode`/`buildLifePathCardSvg`/`CardLabels {domain,disclaimer}` are identical across tasks and match call sites (LifePathCard, LifePathTest, /test, enrich, onboarding).
