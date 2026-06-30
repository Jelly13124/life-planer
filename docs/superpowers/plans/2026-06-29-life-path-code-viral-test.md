# 人生路径码 · 病毒测试漏斗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the P1 viral funnel — a ~10-question scenario quiz that yields a 4-letter 人生路径码 + 中文昵称 on a shareable card, with a public result page that funnels strangers into the real onboarding/prediction.

**Architecture:** A new **pure, deterministic** domain module `packages/core/src/lifePathCode/` (axes, 16-type content, question bank, scoring) — no AI, no network, no `Date.now`/`Math.random`. The web adds two standalone Next routes (`/test` quiz, `/t/[code]` public result with OpenGraph) plus a `LifePathCard` component whose image export mirrors the existing `treeShareImage.ts` pattern. Entry buttons live on onboarding + the tree screen; the result page upsells into the existing onboarding.

**Tech Stack:** Next.js 16 (App Router, Turbopack, RSC for the public result page), React 19, TypeScript, Tailwind v4, Vitest 4, `@lifeplanner/core` workspace (imported in web via `@/domain/*`).

**Spec:** `docs/superpowers/specs/2026-06-29-life-path-code-viral-test-design.md`

---

## File Structure

**New (domain — pure, in `packages/core/src/lifePathCode/`):**
- `axes.ts` — the 4 axes, 8 letters, `Axes`/`LifePathCode` types, `codeOf()`. One responsibility: the code alphabet.
- `types.ts` — the 16 `LifePathType` records (code/nickname/light/shadow/feasibility/color/teaser) + `typeByCode()`/`allTypes()`. One responsibility: type content (single source of truth).
- `questions.ts` — the quiz question bank (typed). One responsibility: questions data.
- `score.ts` — `scoreQuiz(answers) → { code, axes }` deterministic + tie defaults. One responsibility: scoring.
- `index.ts` — barrel for the module.
- Tests in `packages/core/src/__tests__/lifePathCode.test.ts`.

**New (web):**
- `src/lib/shareConfig.ts` — `SHARE_DOMAIN` constant (env-overridable).
- `src/lib/lifePathCardImage.ts` — `buildLifePathCardSvg(type, labels)` pure SVG string builder (mirrors `treeShareImage.ts`); reuses `downloadShareSvg`.
- `src/components/LifePathCard.tsx` — on-screen card + download button.
- `src/app/test/page.tsx` — quiz UI (client).
- `src/app/t/[code]/page.tsx` — public result page (server component + `generateMetadata` for OG).
- `src/app/t/[code]/ResultActions.tsx` — small client component for the two CTAs (router push).

**Modified (web):**
- `src/components/Onboarding.tsx` — add a "先 10 秒测你的人生路径码" link to `/test` on step 0.
- `src/components/TreeScreen.tsx` — add a "看看你是哪型 →" link to `/test`.
- `src/i18n/messages.ts` — additive EN entries for the new UI chrome strings.

---

## Conventions (read before starting)

- Domain is **pure**: no `Date.now()`, no `Math.random()`, no argless `new Date()`. The lint rule on `src/domain/**`/`packages/core/**` will fail otherwise. Scoring is a deterministic tally — no RNG needed.
- Web imports domain via `@/domain/lifePathCode` (tsconfig maps `@/domain/*` → `packages/core/src/*`).
- Run the domain tests with: `npx vitest run packages/core/src/__tests__/lifePathCode.test.ts`
- Type content (16 types, questions) is **data in Chinese** (like prediction content) — it does NOT go through `t()`. Only UI chrome (buttons/headings) goes through `useT()` + gets EN entries in `messages.ts`.
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
  it("has 4 axes in fixed order with distinct letters", () => {
    expect(AXES.map((a) => a.axis)).toEqual(["tempo", "focus", "engine", "drive"]);
    const letters = AXES.flatMap((a) => [a.a, a.b]);
    expect(new Set(letters).size).toBe(8);
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
// 人生路径码的"字母表":4 轴 × 2 字母 = 16 型。纯常量 + 一个拼接函数。
export type Axis = "tempo" | "focus" | "engine" | "drive";
export type Letter = "F" | "S" | "D" | "W" | "B" | "L" | "G" | "V";

export interface AxisDef {
  axis: Axis;
  a: Letter; // 第一极
  b: Letter; // 第二极
  labelA: string;
  labelB: string;
}

// 顺序即码的顺序：[F|S][D|W][B|L][G|V]
export const AXES: AxisDef[] = [
  { axis: "tempo", a: "F", b: "S", labelA: "闯", labelB: "稳" },
  { axis: "focus", a: "D", b: "W", labelA: "深", labelB: "广" },
  { axis: "engine", a: "B", b: "L", labelA: "自创", labelB: "借势" },
  { axis: "drive", a: "G", b: "V", labelA: "务实", labelB: "理想" },
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
  it("every type has non-empty nickname/light/shadow/teaser and a hex color", () => {
    for (const t of allTypes()) {
      expect(t.nickname.length).toBeGreaterThan(0);
      expect(t.light.length).toBeGreaterThan(0);
      expect(t.shadow.length).toBeGreaterThan(0);
      expect(t.teaser.length).toBeGreaterThan(0);
      expect(/^#[0-9a-fA-F]{6}$/.test(t.color)).toBe(true);
      expect(t.feasibility).toBeGreaterThanOrEqual(20);
      expect(t.feasibility).toBeLessThanOrEqual(85);
    }
  });
  it("typeByCode returns the right record or undefined", () => {
    expect(typeByCode("FDBV")?.nickname).toBe("孤勇拓荒者");
    expect(typeByCode("ZZZZ")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement `types.ts`** (full 16-type content — this is the core deliverable)

```ts
import type { LifePathCode } from "./axes";

export interface LifePathType {
  code: LifePathCode;
  nickname: string;
  light: string; // 光：优势
  shadow: string; // 影：代价/风险（诚实底线，必填）
  feasibility: number; // 0-100 粗估（非精确概率）
  color: string; // 卡片/分支主色（hex）
  teaser: string; // 一句未来走向，不含具体年龄
}

const T = (
  code: string,
  nickname: string,
  light: string,
  shadow: string,
  feasibility: number,
  color: string,
  teaser: string,
): LifePathType => ({ code, nickname, light, shadow, feasibility, color, teaser });

const LIST: LifePathType[] = [
  T("FDBG", "孤勇淘金者", "敢 all-in 一个能赚钱的方向，执行力猛", "孤注一掷，赌错了沉没成本巨大", 38, "#D85A30", "你大概率会先碰几次壁，钱和胆量一起练出来。"),
  T("FDBV", "孤勇拓荒者", "敢为天下先，认准一件事死磕到底", "容易孤立无援、烧光积蓄、把自己熬干", 40, "#D85A30", "你会先摔两跤，然后才看到光——那束光是你自己点的。"),
  T("FDLG", "快车道攀登者", "在好平台里冲得快、回报高", "被体系绑架、卷到透支", 60, "#2f6fe0", "你大概率在大平台里快速升级，代价是很长一段时间的高强度。"),
  T("FDLV", "体制内破局者", "在框架里推动真实的改变", "理想撞现实，容易心累出局", 50, "#7F77DD", "你会在规则里搞事情，能不能熬住决定你走多远。"),
  T("FWBG", "多线套利者", "嗅觉灵、机会捕手", "样样做=样样不精，容易翻车", 42, "#BA7517", "你会同时押好几注，赢的那注得够大才划算。"),
  T("FWBV", "多线冒险家", "好奇心强、什么都敢试", "精力分散、难有沉淀", 45, "#BA7517", "你会活得很热闹，最后看哪条线被你养大。"),
  T("FWLG", "机会冲浪者", "踩风口、换赛道快", "随波逐流、根基浅", 55, "#378ADD", "你会跟着风口跑，风停时手里有没有真东西是关键。"),
  T("FWLV", "斜杠理想家", "身份多元、活得精彩", "样样通样样松、身份焦虑", 48, "#D4537E", "你会有好几个标签，但总在问哪个才是真的自己。"),
  T("SDBG", "闷声匠人", "把一门手艺做到顶、吃复利", "慢热、可能错过窗口、闷亏", 58, "#1D9E75", "你会安静地把一件事做精，时间久了才有人发现你。"),
  T("SDBV", "长期主义者", "耐得住寂寞，做难而正确的事", "回报来得太慢、易被现实磨平", 52, "#1D9E75", "你走的是慢路，能不能撑到复利那天是唯一的悬念。"),
  T("SDLG", "深耕守成派", "稳扎稳打，时间和复利替你打仗", "天花板来得早、温水煮青蛙", 70, "#2f6fe0", "你大概率过得稳当，要小心某天发现自己困在原地。"),
  T("SDLV", "体制内手艺人", "在体系里安静精进、有意义感", "被结构限制、理想缩水", 62, "#7F77DD", "你会在一个位置上越做越好，代价是边界由别人定。"),
  T("SWBG", "稳健多面手", "东方不亮西方亮、抗风险", "不够聚焦、难做大", 60, "#5b6478", "你不会大起大落，但也得接受很难有高光时刻。"),
  T("SWBV", "自在生活家", "生活丰富、活得自洽", "难积累、世俗成就有限", 55, "#D4537E", "你会把日子过舒服，世俗的那把尺子量不太到你。"),
  T("SWLG", "稳进多栖者", "多份保障、稳", "平庸感、缺少高光", 65, "#5b6478", "你会稳稳当当攒下一份安稳，偶尔会想是不是太安全了。"),
  T("SWLV", "随遇而安者", "松弛、随缘、知足", "目标感弱、容易随波逐流", 58, "#5b6478", "你会顺势而活，幸福与否取决于你是否真的甘心。"),
];

export const LIFE_PATH_TYPES: Record<LifePathCode, LifePathType> = Object.fromEntries(
  LIST.map((t) => [t.code, t]),
);

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
git commit -m "feat(core): 16 life-path types (code/nickname/light/shadow/feasibility/color/teaser)"
```

---

### Task 3: Question bank (`questions.ts`)

**Files:**
- Create: `packages/core/src/lifePathCode/questions.ts`
- Test: `packages/core/src/__tests__/lifePathCode.test.ts` (append)

- [ ] **Step 1: Append the failing test**

```ts
import { QUESTIONS } from "../lifePathCode/questions";
import { AXES } from "../lifePathCode/axes";

describe("lifePathCode/questions", () => {
  it("has 10 questions, each mapping to one axis with two valid poles", () => {
    expect(QUESTIONS.length).toBe(10);
    const validLetters = new Set(AXES.flatMap((a) => [a.a, a.b]));
    for (const q of QUESTIONS) {
      expect(q.options.length).toBe(2);
      for (const o of q.options) expect(validLetters.has(o.pole)).toBe(true);
      const axisDef = AXES.find((a) => a.axis === q.axis)!;
      const poles = q.options.map((o) => o.pole).sort();
      expect(poles).toEqual([axisDef.a, axisDef.b].sort()); // both poles of its axis
    }
  });
  it("covers every axis at least twice (cross-validation)", () => {
    for (const a of AXES) {
      const n = QUESTIONS.filter((q) => q.axis === a.axis).length;
      expect(n).toBeGreaterThanOrEqual(2);
    }
  });
  it("question ids are unique", () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement `questions.ts`** (tempo×3, engine×3, focus×2, drive×2 = 10)

```ts
import type { Axis, Letter } from "./axes";

export interface QuizOption {
  label: string;
  pole: Letter;
}
export interface QuizQuestion {
  id: string;
  axis: Axis;
  prompt: string;
  options: [QuizOption, QuizOption];
}

// 每题只测一条轴（两极二选一）。打分=数票，奇/偶数题的平票由 score.ts 的默认极兜底。
export const QUESTIONS: QuizQuestion[] = [
  { id: "t1", axis: "tempo", prompt: "一份稳定 offer 和一个没谱但你心动的机会，你更可能选？", options: [{ label: "搏一把那个心动的", pole: "F" }, { label: "先要那份稳的", pole: "S" }] },
  { id: "t2", axis: "tempo", prompt: "想做一件事时，你通常？", options: [{ label: "先干起来再说", pole: "F" }, { label: "想清楚、准备好再动", pole: "S" }] },
  { id: "t3", axis: "tempo", prompt: "面对一个大机会，你更怕？", options: [{ label: "犹豫太久错过它", pole: "F" }, { label: "冲动上头摔得惨", pole: "S" }] },
  { id: "f1", axis: "focus", prompt: "做事你更像？", options: [{ label: "死磕一件事到底", pole: "D" }, { label: "多条线一起押", pole: "W" }] },
  { id: "f2", axis: "focus", prompt: "你更欣赏哪种人？", options: [{ label: "十年磨一剑的专家", pole: "D" }, { label: "什么都玩得转的多面手", pole: "W" }] },
  { id: "e1", axis: "engine", prompt: "理想的工作状态是？", options: [{ label: "自己从零搭一个东西", pole: "B" }, { label: "进一个好平台往上爬", pole: "L" }] },
  { id: "e2", axis: "engine", prompt: "你更信？", options: [{ label: "靠自己定义规则", pole: "B" }, { label: "借势、站在巨人肩上", pole: "L" }] },
  { id: "e3", axis: "engine", prompt: "更让你有安全感的是？", options: [{ label: "手里有自己的盘子", pole: "B" }, { label: "背后有靠谱的组织/平台", pole: "L" }] },
  { id: "d1", axis: "drive", prompt: "你更怕哪种结局？", options: [{ label: "一辈子碌碌无为没意义", pole: "V" }, { label: "晚景不安稳没保障", pole: "G" }] },
  { id: "d2", axis: "drive", prompt: "做选择时，你先看？", options: [{ label: "这事对我意味着什么", pole: "V" }, { label: "这事能给我多少回报/保障", pole: "G" }] },
];
```

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lifePathCode/questions.ts packages/core/src/__tests__/lifePathCode.test.ts
git commit -m "feat(core): lifePathCode 10-question bank (3/3/2/2 across axes)"
```

---

### Task 4: Deterministic scoring (`score.ts`)

**Files:**
- Create: `packages/core/src/lifePathCode/score.ts`
- Test: `packages/core/src/__tests__/lifePathCode.test.ts` (append)

- [ ] **Step 1: Append the failing test**

```ts
import { scoreQuiz, type QuizAnswer } from "../lifePathCode/score";
import { typeByCode } from "../lifePathCode/types";

describe("lifePathCode/score", () => {
  it("tallies majority per axis → a valid, content-backed code", () => {
    const answers: QuizAnswer[] = [
      { questionId: "t1", pole: "F" }, { questionId: "t2", pole: "F" }, { questionId: "t3", pole: "S" },
      { questionId: "f1", pole: "D" }, { questionId: "f2", pole: "D" },
      { questionId: "e1", pole: "B" }, { questionId: "e2", pole: "B" }, { questionId: "e3", pole: "L" },
      { questionId: "d1", pole: "V" }, { questionId: "d2", pole: "V" },
    ];
    const { code } = scoreQuiz(answers);
    expect(code).toBe("FDBV");
    expect(typeByCode(code)).toBeDefined();
  });
  it("is deterministic (same answers → same code)", () => {
    const a: QuizAnswer[] = [{ questionId: "f1", pole: "W" }, { questionId: "f2", pole: "W" }];
    expect(scoreQuiz(a).code).toBe(scoreQuiz(a).code);
  });
  it("breaks ties with the per-axis default pole (focus tie → D)", () => {
    const a: QuizAnswer[] = [{ questionId: "f1", pole: "D" }, { questionId: "f2", pole: "W" }];
    expect(scoreQuiz(a).axes.focus).toBe("D"); // 1-1 tie → default D
  });
  it("missing answers for an axis → that axis uses its default pole", () => {
    const { axes } = scoreQuiz([]); // no answers at all
    expect(axes).toEqual({ tempo: "S", focus: "D", engine: "L", drive: "G" });
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement `score.ts`**

```ts
import { AXES, codeOf, type Axes, type Axis, type Letter, type LifePathCode } from "./axes";
import { QUESTIONS } from "./questions";

export interface QuizAnswer {
  questionId: string;
  pole: Letter;
}

// 平票/缺答时的默认极：偏稳健、求实（保守兜底，符合"诚实不夸大"基调）。
const TIE_DEFAULT: Record<Axis, Letter> = {
  tempo: "S",
  focus: "D",
  engine: "L",
  drive: "G",
};

const Q_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

export function scoreQuiz(answers: QuizAnswer[]): { code: LifePathCode; axes: Axes } {
  const tally: Record<Axis, Record<string, number>> = {
    tempo: {}, focus: {}, engine: {}, drive: {},
  };
  for (const ans of answers) {
    const q = Q_BY_ID.get(ans.questionId);
    if (!q) continue;
    tally[q.axis][ans.pole] = (tally[q.axis][ans.pole] ?? 0) + 1;
  }
  const pick = (def: (typeof AXES)[number]): Letter => {
    const counts = tally[def.axis];
    const ca = counts[def.a] ?? 0;
    const cb = counts[def.b] ?? 0;
    if (ca > cb) return def.a;
    if (cb > ca) return def.b;
    return TIE_DEFAULT[def.axis]; // 平票（含 0-0）→ 默认极
  };
  const axes: Axes = {
    tempo: pick(AXES[0]) as Axes["tempo"],
    focus: pick(AXES[1]) as Axes["focus"],
    engine: pick(AXES[2]) as Axes["engine"],
    drive: pick(AXES[3]) as Axes["drive"],
  };
  return { axes, code: codeOf(axes) };
}
```

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lifePathCode/score.ts packages/core/src/__tests__/lifePathCode.test.ts
git commit -m "feat(core): deterministic scoreQuiz with per-axis tie defaults"
```

---

### Task 5: Module barrel (`index.ts`)

**Files:**
- Create: `packages/core/src/lifePathCode/index.ts`

- [ ] **Step 1: Implement the barrel** (no test needed — pure re-export)

```ts
export * from "./axes";
export * from "./types";
export * from "./questions";
export * from "./score";
```

- [ ] **Step 2: Verify the whole module typechecks + tests pass**

Run: `npx vitest run packages/core/src/__tests__/lifePathCode.test.ts`
Expected: all suites PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/lifePathCode/index.ts
git commit -m "feat(core): lifePathCode barrel export"
```

---

### Task 6: Share config (`shareConfig.ts`)

**Files:**
- Create: `src/lib/shareConfig.ts`

- [ ] **Step 1: Implement** (no test — trivial constant; env-overridable)

```ts
// 分享域名：卡片底注 + OG 链接预览用。换正式域名时改这一处（或设 NEXT_PUBLIC_SHARE_DOMAIN）。
export const SHARE_DOMAIN =
  process.env.NEXT_PUBLIC_SHARE_DOMAIN?.trim() || "life-planer-opal.vercel.app";

export function resultUrl(code: string): string {
  return `https://${SHARE_DOMAIN}/t/${code}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shareConfig.ts
git commit -m "feat(web): SHARE_DOMAIN config + resultUrl helper"
```

---

### Task 7: Card image builder (`lifePathCardImage.ts`)

**Files:**
- Create: `src/lib/lifePathCardImage.ts`
- Test: `src/lib/__tests__/lifePathCardImage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildLifePathCardSvg } from "../lifePathCardImage";
import { typeByCode } from "@/domain/lifePathCode";

describe("buildLifePathCardSvg", () => {
  it("produces a self-contained SVG with code, nickname and no CSS vars", () => {
    const t = typeByCode("FDBV")!;
    const svg = buildLifePathCardSvg(t, { domain: "example.app", disclaimer: "AI 粗估" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("FDBV");
    expect(svg).toContain("孤勇拓荒者");
    expect(svg).not.toContain("var(--"); // inlined hex only (renders outside the app)
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**

Run: `npx vitest run src/lib/__tests__/lifePathCardImage.test.ts`

- [ ] **Step 3: Implement `lifePathCardImage.ts`** (mirror `treeShareImage.ts`: pure SVG string, inlined hex, escape, + reuse `downloadShareSvg`)

```ts
import type { LifePathType } from "@/domain/lifePathCode";

const BG = "#ffffff";
const FG = "#1d1d1f";
const FG_DIM = "#6e6e73";
const FG_FAINT = "#8e8e93";
const LINE = "#e5e5ea";
const LIGHT_C = "#0F6E56"; // 光
const SHADOW_C = "#A32D2D"; // 影

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface CardLabels {
  domain: string;
  disclaimer: string;
}

// 纯函数：从一个 LifePathType 生成自包含、可截图分享的卡片 SVG（竖版，适配小红书/微信）。
export function buildLifePathCardSvg(t: LifePathType, labels: CardLabels): string {
  const W = 600;
  const H = 840;
  const cx = W / 2;
  const accent = /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : "#D85A30";
  const L: string[] = [];
  L.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`);
  L.push(`  <rect x="0" y="0" width="${W}" height="${H}" fill="${BG}"/>`);
  L.push(`  <rect x="0" y="0" width="${W}" height="10" fill="${accent}"/>`);
  L.push(`  <text x="${cx}" y="90" text-anchor="middle" font-size="20" fill="${FG_FAINT}" font-family="sans-serif">人生路径测试 · 我的结果</text>`);
  // 4-letter code
  L.push(`  <text x="${cx}" y="200" text-anchor="middle" font-size="92" font-weight="800" letter-spacing="8" fill="${accent}" font-family="sans-serif">${esc(t.code)}</text>`);
  // nickname
  L.push(`  <text x="${cx}" y="280" text-anchor="middle" font-size="44" font-weight="700" fill="${FG}" font-family="sans-serif">${esc(t.nickname)}</text>`);
  // teaser (single line, pre-truncated by content; keep ≤ ~22 chars)
  L.push(`  <text x="${cx}" y="335" text-anchor="middle" font-size="22" fill="${FG_DIM}" font-family="sans-serif">${esc(t.teaser)}</text>`);
  // 光 / 影
  L.push(`  <text x="60" y="430" font-size="22" font-weight="700" fill="${LIGHT_C}" font-family="sans-serif">光</text>`);
  L.push(`  <text x="110" y="430" font-size="22" fill="${FG_DIM}" font-family="sans-serif">${esc(t.light)}</text>`);
  L.push(`  <text x="60" y="480" font-size="22" font-weight="700" fill="${SHADOW_C}" font-family="sans-serif">影</text>`);
  L.push(`  <text x="110" y="480" font-size="22" fill="${FG_DIM}" font-family="sans-serif">${esc(t.shadow)}</text>`);
  // feasibility box
  L.push(`  <rect x="60" y="540" width="${W - 120}" height="110" rx="16" fill="#f5f5f7"/>`);
  L.push(`  <text x="84" y="588" font-size="22" fill="${FG_DIM}" font-family="sans-serif">这条路现实可行度</text>`);
  L.push(`  <text x="${W - 84}" y="600" text-anchor="end" font-size="48" font-weight="700" fill="${FG}" font-family="sans-serif">约 ${t.feasibility}%</text>`);
  L.push(`  <text x="84" y="626" font-size="16" fill="${FG_FAINT}" font-family="sans-serif">${esc(labels.disclaimer)}</text>`);
  // footer CTA + domain
  L.push(`  <line x1="60" y1="730" x2="${W - 60}" y2="730" stroke="${LINE}" stroke-width="1"/>`);
  L.push(`  <text x="60" y="775" font-size="24" font-weight="700" fill="${accent}" font-family="sans-serif">10 秒测你的 →</text>`);
  L.push(`  <text x="${W - 60}" y="775" text-anchor="end" font-size="18" fill="${FG_FAINT}" font-family="sans-serif">${esc(labels.domain)}</text>`);
  L.push(`</svg>`);
  return L.join("\n");
}

export { downloadShareSvg } from "./treeShareImage";
```

- [ ] **Step 4: Run test, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/lifePathCardImage.ts src/lib/__tests__/lifePathCardImage.test.ts
git commit -m "feat(web): pure SVG builder for the shareable life-path card"
```

---

### Task 8: On-screen card component (`LifePathCard.tsx`)

**Files:**
- Create: `src/components/LifePathCard.tsx`

- [ ] **Step 1: Implement** (visual card matching the approved mockup; download button uses Task 7). No unit test (component — verified via tsc + build + manual). Uses `useT` for chrome only.

```tsx
"use client";

import type { LifePathType } from "@/domain/lifePathCode";
import { useT } from "@/prefs/PreferencesContext";
import { SHARE_DOMAIN } from "@/lib/shareConfig";
import { buildLifePathCardSvg, downloadShareSvg } from "@/lib/lifePathCardImage";

const DISCLAIMER = "AI 粗估，非精确概率 · 会随你的真实努力上升";

export function LifePathCard({ type }: { type: LifePathType }) {
  const { t } = useT();
  const letters = type.code.split("");
  function onDownload() {
    const svg = buildLifePathCardSvg(type, { domain: SHARE_DOMAIN, disclaimer: "AI 粗估，非精确概率" });
    downloadShareSvg(svg, `lifepath-${type.code}.svg`);
  }
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="lp-card overflow-hidden p-5" style={{ borderTop: `4px solid ${type.color}` }}>
        <div className="mb-3 flex items-center justify-between text-[11px] text-[var(--fg-faint)]">
          <span>{t("人生路径测试 · 我的结果")}</span>
          <span>{t("人生树")}</span>
        </div>
        <div className="mb-2 flex gap-1.5">
          {letters.map((ch, i) => (
            <span key={i} className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold" style={{ backgroundColor: `${type.color}1a`, color: type.color }}>{ch}</span>
          ))}
        </div>
        <div className="text-[26px] font-semibold text-[var(--fg)]">{type.nickname}</div>
        <p className="mt-1 text-sm leading-relaxed text-[var(--fg-dim)]">{type.teaser}</p>
        <div className="mt-4 flex gap-2 text-[13px]"><span className="font-semibold text-[var(--c-emerald)]">{t("光")}</span><span className="text-[var(--fg-dim)]">{type.light}</span></div>
        <div className="mt-1.5 flex gap-2 text-[13px]"><span className="font-semibold text-[var(--c-rose)]">{t("影")}</span><span className="text-[var(--fg-dim)]">{type.shadow}</span></div>
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

- [ ] **Step 2: tsc check**

Run: `npx tsc --noEmit`
Expected: clean (LifePathType imported, `useT` exists, tokens valid).

- [ ] **Step 3: Commit**

```bash
git add src/components/LifePathCard.tsx
git commit -m "feat(web): LifePathCard on-screen result card + save-image button"
```

---

### Task 9: Public result page (`/t/[code]`) with OG

**Files:**
- Create: `src/app/t/[code]/page.tsx`
- Create: `src/app/t/[code]/ResultActions.tsx`

- [ ] **Step 1: Implement `ResultActions.tsx`** (client CTAs)

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/prefs/PreferencesContext";

export function ResultActions() {
  const router = useRouter();
  const { t } = useT();
  return (
    <div className="mx-auto mt-5 flex w-full max-w-sm flex-col gap-2">
      <button onClick={() => router.push("/test")} className="lp-tap inline-flex items-center justify-center rounded-full bg-[image:var(--grad-accent)] px-5 py-2.5 text-sm font-semibold text-white">
        {t("10 秒测你的")}
      </button>
      <button onClick={() => router.push("/")} className="lp-tap inline-flex items-center justify-center rounded-full border border-[var(--line)] px-5 py-2.5 text-sm text-[var(--fg-dim)] transition hover:text-[var(--fg)]">
        {t("填完整资料，生成你真正的人生树 →")}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implement `page.tsx`** (server component; OG metadata; invalid code → notFound)

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { typeByCode } from "@/domain/lifePathCode";
import { LifePathCard } from "@/components/LifePathCard";
import { ResultActions } from "./ResultActions";
import { SHARE_DOMAIN } from "@/lib/shareConfig";

export function generateMetadata({ params }: { params: { code: string } }): Metadata {
  const t = typeByCode(params.code.toUpperCase());
  if (!t) return { title: "人生路径测试" };
  const title = `${t.code} · ${t.nickname} | 人生路径测试`;
  const description = `${t.teaser} ｜ 10 秒测你的人生路径码`;
  return {
    title,
    description,
    openGraph: { title, description, url: `https://${SHARE_DOMAIN}/t/${t.code}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function ResultPage({ params }: { params: { code: string } }) {
  const type = typeByCode(params.code.toUpperCase());
  if (!type) notFound();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <LifePathCard type={type} />
      <ResultActions />
    </main>
  );
}
```

> Note (Next 16): `params` may be a Promise in async server components. If the build/types require it, make the component `async` and `const { code } = await params;` in BOTH `generateMetadata` and the page. Check `node_modules/next/dist/docs` if tsc complains — follow whatever the installed Next version's dynamic-route API requires.

- [ ] **Step 3: tsc check** (`npx tsc --noEmit`) — resolve the `params` Promise note above if it errors.

- [ ] **Step 4: Manual smoke** (after `npm run dev`): visit `/t/FDBV` → card renders + 2 CTAs; `/t/zzzz` → 404.

- [ ] **Step 5: Commit**

```bash
git add src/app/t/
git commit -m "feat(web): public /t/[code] result page with OG metadata"
```

---

### Task 10: Quiz page (`/test`)

**Files:**
- Create: `src/app/test/page.tsx`

- [ ] **Step 1: Implement** (client; renders QUESTIONS, collects answers, scores, routes to `/t/[code]`)

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/prefs/PreferencesContext";
import { QUESTIONS, scoreQuiz, type QuizAnswer } from "@/domain/lifePathCode";

export default function TestPage() {
  const router = useRouter();
  const { t } = useT();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const q = QUESTIONS[i];
  const total = QUESTIONS.length;

  function choose(pole: QuizAnswer["pole"]) {
    const next = [...answers.filter((a) => a.questionId !== q.id), { questionId: q.id, pole }];
    setAnswers(next);
    if (i + 1 < total) {
      setI(i + 1);
    } else {
      const { code } = scoreQuiz(next);
      router.push(`/t/${code}`);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex gap-1.5">
        {QUESTIONS.map((_, k) => (
          <div key={k} className="h-1 flex-1 rounded-full" style={{ background: k <= i ? "var(--accent)" : "rgba(0,0,0,0.12)" }} />
        ))}
      </div>
      <div className="text-xs uppercase tracking-[3px] text-[var(--fg-faint)]">{t("人生路径测试")} · {i + 1}/{total}</div>
      <h1 className="mt-3 text-2xl font-semibold leading-snug text-[var(--fg)]">{q.prompt}</h1>
      <div className="mt-8 flex flex-col gap-3">
        {q.options.map((o) => (
          <button key={o.pole} onClick={() => choose(o.pole)} className="lp-tap rounded-2xl border border-[var(--line)] px-5 py-4 text-left text-base text-[var(--fg)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/[0.06]">
            {o.label}
          </button>
        ))}
      </div>
      {i > 0 && (
        <button onClick={() => setI(i - 1)} className="mt-6 self-start text-sm text-[var(--fg-faint)] transition hover:text-[var(--fg-dim)]">{t("← 上一题")}</button>
      )}
    </main>
  );
}
```

- [ ] **Step 2: tsc check** (`npx tsc --noEmit`).

- [ ] **Step 3: Manual smoke** (`npm run dev`): `/test` → answer 10 → lands on `/t/[code]` with a real type.

- [ ] **Step 4: Commit**

```bash
git add src/app/test/
git commit -m "feat(web): /test quiz flow → scoreQuiz → /t/[code]"
```

---

### Task 11: Entry points (onboarding + tree screen)

**Files:**
- Modify: `src/components/Onboarding.tsx` (step 0 — add a quiz link under the title block)
- Modify: `src/components/TreeScreen.tsx` (header actions — add a "看看你是哪型" link)

- [ ] **Step 1: Onboarding entry** — in `Onboarding.tsx`, inside the intro block (after the subtitle `<p>` around line 113-115), add:

```tsx
<a href="/test" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] transition hover:underline">
  {t("先 10 秒测你的人生路径码 →")}
</a>
```

- [ ] **Step 2: Tree screen entry** — in `TreeScreen.tsx`, in the header action row (near 分享/添加岔路/重置), add a link:

```tsx
<a href="/test" className="lp-tap inline-flex items-center justify-center rounded-full border border-[var(--line)] px-3.5 py-1.5 text-xs text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]">
  {t("看看你是哪型")}
</a>
```

(Place it consistent with the existing buttons; match their wrapper. Read the surrounding JSX first and slot it in.)

- [ ] **Step 3: tsc check** (`npx tsc --noEmit`).

- [ ] **Step 4: Commit**

```bash
git add src/components/Onboarding.tsx src/components/TreeScreen.tsx
git commit -m "feat(web): entry points to /test from onboarding + tree screen"
```

---

### Task 12: i18n EN entries (additive)

**Files:**
- Modify: `src/i18n/messages.ts`

- [ ] **Step 1: Add EN entries** for every new chrome string used above (additions-only — never rewrite the dict). Add these keys (Chinese-punctuation keys must be quoted):

```ts
"人生路径测试 · 我的结果": "Life Path Test · My result",
"光": "Up",
"影": "Down",
"这条路现实可行度": "How reachable this path is",
"约 {n}%": "~{n}%",
"保存这张卡": "Save this card",
"10 秒测你的": "Take the 10-sec test",
"填完整资料，生成你真正的人生树 →": "Fill in your details → grow your real life tree →",
"人生路径测试": "Life Path Test",
"← 上一题": "← Back",
"先 10 秒测你的人生路径码 →": "First, a 10-sec life-path test →",
"看看你是哪型": "Find your type",
```

(If a key already exists, e.g. `"人生树"`, do NOT duplicate it — tsc/lint flags dup keys.)

- [ ] **Step 2: tsc check** (`npx tsc --noEmit`) — confirms no duplicate keys, no broken quotes.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages.ts
git commit -m "i18n: EN entries for the life-path test chrome"
```

---

### Task 13: Full verify + green gate

**Files:** none (verification)

- [ ] **Step 1: Run the `/green` skill** (tsc + vitest + next build, then clear `.next`). All three must pass.

Expected: tsc 0 errors; vitest all pass (incl. the new `lifePathCode.test.ts` + `lifePathCardImage.test.ts`); `next build` ok.

- [ ] **Step 2: Manual end-to-end smoke** (`npm run dev`, then via browser/preview):
  - `/test` → answer 10 questions → redirected to `/t/<code>` with a real nickname.
  - `/t/FDBV` → card shows code/nickname/光/影/约X% + "保存这张卡" downloads an SVG.
  - "10 秒测你的" → `/test`; "填完整…" → `/` (onboarding).
  - Onboarding + tree screen show the `/test` entry links.
  - `/t/zzzz` → 404.

- [ ] **Step 3: Update working memory + commit**

Append a short entry to `progress.md` (what shipped, P2 deferred: compare mode, mobile /test, EN runtime, analytics). Commit:

```bash
git add progress.md
git commit -m "docs: log life-path-code P1 funnel shipped"
```

- [ ] **Step 4: Fast-forward master + push** (per the trunk rule): `git checkout master && git merge --ff-only <branch> && git push origin master && git checkout <branch> && git push`.

---

## Self-Review (against the spec)

- **§2 16 types** → Task 2 (full content table). ✓
- **§2 axes/letters/code** → Task 1. ✓
- **§2 signature color + feasibility** → encoded per-type in Task 2. ✓
- **§3 quiz (10 Q, deterministic, no AI)** → Tasks 3–4. ✓
- **§4 result + card + image export + teaser** → Tasks 7–8 (teaser lives in type content; export mirrors treeShareImage). ✓
- **§5 funnel: /t/[code] public, /test, upsell** → Tasks 9–11. ✓ (Compare mode = P2, not in plan, per §9.)
- **§5 OG link preview** → Task 9 `generateMetadata`. ✓
- **§6 honesty guardrails** → 光+影 mandatory (Task 2 test asserts non-empty both), 约X%+disclaimer on card (Tasks 7–8). ✓
- **§7 architecture: pure domain, reuse palette/export/onboarding, no new AI route** → Tasks 1–8 (no `/api/*` added). ✓
- **§7 i18n additive** → Task 12. ✓
- **§9 zh-only P1, compare/mobile/AI-teaser deferred** → respected (not in plan). ✓
- **§10 testing: scoreQuiz determinism, all 16 reachable, 光+影 present, feasibility band** → Tasks 2 & 4 tests. ✓

**Placeholder scan:** no TBD/TODO; every code step has complete code. The one conditional is the Next 16 `params`-Promise note in Task 9 — that's a real API-version branch with explicit instructions, not a placeholder.

**Type consistency:** `Axes`/`Letter`/`LifePathCode`/`LifePathType`/`QuizAnswer`/`scoreQuiz`/`typeByCode`/`buildLifePathCardSvg` names are identical across tasks. Card image labels interface `CardLabels {domain,disclaimer}` matches its test + component call sites.
