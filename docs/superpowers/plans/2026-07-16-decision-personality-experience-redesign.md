# Decision Personality Experience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有职业决策风格测试改造成四字母代码主导、带 16 型编辑插画角色、半夸半损结果文案和社交分享闭环的“决策人格”体验，同时保持计分、隐私和旧结果兼容。

**Architecture:** 共享包新增纯静态人格展示资料与五档刻度语义，Web 和 App 分别实现原生答题控件与结果组件。16 张角色图使用同一代码命名并在 Web/App 各保存一份经过哈希校验的发布副本；服务端 `ImageResponse` 读取 Web 副本，分别生成 1080×1350 portrait PNG 与 1200×630 OG 图。现有签名 token、计分和存储结构不变。

**Tech Stack:** TypeScript, React 19, Next.js 16.2.9 App Router, Tailwind CSS 4, Vitest 4, React Native 0.85, Expo SDK 56, Expo Updates, `next/og`, `qrcode-generator` 2.0.4.

**Design spec:** `docs/superpowers/specs/2026-07-16-decision-personality-experience-redesign-design.md`

## Global Constraints

- 不修改 28 道完整题、12 道快测题、四轴计分算法、`DecisionStyleSummary` 或签名 token 字段。
- 四字母代码是结果与分享卡的最大主视觉；中文人格名是第二层。
- 文案使用半夸半损语气，不羞辱用户，不声称心理诊断或科学人格结论。
- 答题视觉只显示左右真实选项与五个圆点；“强烈偏向”等长描述仅用于无障碍名称。
- 选择后 200ms 自动推进；最后一题自动结算；保留返回修改。
- portrait PNG 固定为 1080×1350；OG 固定为 1200×630；两者不互相裁切。
- 原始答案继续只保存在本地；公开 token 继续只含版本、来源、代码和四轴整数分数。
- ImageResponse JSX 只使用 flexbox、绝对定位和已支持 CSS，不使用 CSS Grid。
- 不迁移框架，不新增数据库表，不新增用户级追踪。
- 执行时保留当前脏工作区；每次只暂存任务列出的文件，不覆盖无关修改。

## File Structure

### Shared domain

- Create `packages/core/src/decisionStyle/presentation.ts` — 16 型社交展示文案与查询函数。
- Create `packages/core/src/decisionStyle/answerScale.ts` — 五档值、无障碍名称、不可变答案更新函数。
- Create `packages/core/src/decisionStyle/comparison.ts` — 两个人格的确定性关系句。
- Modify `packages/core/src/decisionStyle/index.ts` — 导出新增接口。
- Create `packages/core/src/__tests__/decisionStylePresentation.test.ts` — 共享展示、刻度和对比语义测试。

### Character assets

- Create `public/decision-style/characters/{CODE}.png` — Web、公开页和图片路由的 16 张角色图。
- Create `mobile/assets/decision-style/characters/{CODE}.png` — App 的 16 张相同角色图。
- Create `src/lib/__tests__/decisionStyleCharacterAssets.test.ts` — PNG 格式、尺寸、透明通道和跨端哈希测试。
- Create `src/components/decision-style/DecisionStyleCharacter.tsx` — Web 角色图与缺图剪影。
- Create `mobile/src/components/DecisionStyleCharacter.tsx` — React Native 静态资源注册表与缺图剪影。

### Test flow

- Create `src/components/decision-style/DecisionStyleScale.tsx` — Web 双端五档控件。
- Modify `src/components/decision-style/DecisionStyleTest.tsx` — 自动推进、返回、加赛题和新开场。
- Modify `src/components/decision-style/__tests__/DecisionStyleTest.test.tsx` — 新交互回归测试。
- Create `mobile/src/components/DecisionStyleScale.tsx` — App 双端五档控件。
- Modify `mobile/src/components/DecisionStyleQuickTest.tsx` — App 自动推进、返回和加赛题。

### Results and sharing

- Create `src/components/decision-style/DecisionPersonalityHero.tsx` — Web 结果主视觉。
- Modify `src/components/decision-style/DecisionStyleResult.tsx` — 主视觉 + 折叠详情 + 新操作顺序。
- Modify `src/components/decision-style/DecisionStyleAxisBars.tsx` — 仅在详情中展示，去除内部字段泄漏。
- Create `mobile/src/components/DecisionPersonalityCard.tsx` — App 结果与“我”页面共用卡片。
- Modify `mobile/src/screens/MeScreen.tsx` — 使用新人格卡。
- Modify `src/components/decision-style/__tests__/DecisionStyleResult.test.tsx` — 结果优先级与详情测试。
- Create `src/components/decision-style/DecisionStyleShareArtwork.tsx` — portrait/OG 两种 Satori 安全布局。
- Create `src/lib/decisionStyleShareAssets.server.ts` — 角色 data URL 与 QR data URL。
- Modify `src/app/style/[code]/[token]/card.png/route.ts` — portrait PNG 与签名结果二维码。
- Modify `src/app/style/[code]/[token]/opengraph-image.tsx` — 独立横版 OG。
- Modify `src/app/style/[code]/[token]/page.tsx` — 公开人格页。
- Modify `src/app/style/[code]/[token]/page.test.tsx` — 页面与图像路由测试。
- Modify `src/app/compare/[left]/[right]/page.tsx` — 双角色与关系句。
- Modify `src/app/compare/[left]/[right]/page.test.tsx` — 对比语义测试。
- Modify `src/lib/decisionStyleShareClient.ts` and its tests — 新分享标题、文案和下载文件名。
- Create `mobile/src/lib/decisionStyleShareResponse.ts` and its test — 校验 `{ token, path }` 并构造可信绝对 URL。
- Modify `mobile/src/lib/decisionStyleShare.ts` — 新分享标题与链接回退文案。
- Modify `package.json` and `package-lock.json` — 添加零运行时依赖且自带 TypeScript 声明的 `qrcode-generator@2.0.4`。

---

### Task 1: Shared presentation and answer-scale contracts

**Files:**
- Create: `packages/core/src/decisionStyle/presentation.ts`
- Create: `packages/core/src/decisionStyle/answerScale.ts`
- Create: `packages/core/src/__tests__/decisionStylePresentation.test.ts`
- Modify: `packages/core/src/decisionStyle/index.ts`

**Interfaces:**
- Produces: `DecisionPersonalityPresentation`, `allDecisionPersonalityPresentations()`, `decisionPersonalityPresentationByCode(code)`, `DECISION_STYLE_SCALE_VALUES`, `decisionStyleScaleAccessibilityLabel(question, value)`, `upsertDecisionStyleAnswer(detail, questionId, value)`.
- Consumes: existing `DecisionStyleCode`, `DecisionStyleQuestion`, `DecisionStyleAnswerValue`, `DecisionStyleLocalDetail`.

- [ ] **Step 1: Write the failing shared-contract test**

```ts
import { describe, expect, it } from "vitest";
import {
  DECISION_STYLE_SCALE_VALUES,
  FULL_QUESTIONS,
  allDecisionPersonalityPresentations,
  allDecisionStyleTypes,
  decisionPersonalityPresentationByCode,
  decisionStyleScaleAccessibilityLabel,
  upsertDecisionStyleAnswer,
} from "../decisionStyle";

describe("decision personality presentation", () => {
  it("covers every approved code with unique complete social copy", () => {
    const presentations = allDecisionPersonalityPresentations();
    const codes = allDecisionStyleTypes().map((type) => type.code).sort();
    expect(presentations.map((item) => item.code).sort()).toEqual(codes);
    expect(new Set(presentations.map((item) => item.tagline)).size).toBe(16);
    for (const item of presentations) {
      expect(item.characterId).toBe(item.code);
      expect(item.label.length).toBeGreaterThan(3);
      expect(item.tagline.length).toBeGreaterThan(12);
      expect(item.highlight.length).toBeGreaterThan(12);
      expect(item.roast.length).toBeGreaterThan(12);
      expect(item.advice.length).toBeGreaterThan(8);
    }
    expect(decisionPersonalityPresentationByCode("FDBG")?.tagline).toBe(
      "你不是没耐心，只是觉得今天能解决的事，不该开三次会。",
    );
    expect(decisionPersonalityPresentationByCode("NOPE")).toBeUndefined();
  });

  it("exposes five stable values and concrete accessible labels", () => {
    const question = FULL_QUESTIONS[0];
    expect(DECISION_STYLE_SCALE_VALUES).toEqual([-2, -1, 0, 1, 2]);
    expect(decisionStyleScaleAccessibilityLabel(question, -2)).toBe(`强烈偏向：${question.left.label}`);
    expect(decisionStyleScaleAccessibilityLabel(question, -1)).toBe(`稍微偏向：${question.left.label}`);
    expect(decisionStyleScaleAccessibilityLabel(question, 0)).toBe("两边差不多");
    expect(decisionStyleScaleAccessibilityLabel(question, 1)).toBe(`稍微偏向：${question.right.label}`);
    expect(decisionStyleScaleAccessibilityLabel(question, 2)).toBe(`强烈偏向：${question.right.label}`);
  });

  it("replaces an answer instead of duplicating it", () => {
    const initial = { version: 2 as const, answers: [], tieBreaks: {} };
    const first = upsertDecisionStyleAnswer(initial, "tempo-1", -2);
    const replaced = upsertDecisionStyleAnswer(first, "tempo-1", 2);
    expect(replaced.answers).toEqual([{ questionId: "tempo-1", value: 2 }]);
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npx vitest run packages/core/src/__tests__/decisionStylePresentation.test.ts`

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement the five-value contract**

```ts
// packages/core/src/decisionStyle/answerScale.ts
import type { DecisionStyleAnswerValue, DecisionStyleQuestion } from "./questions";
import type { DecisionStyleLocalDetail } from "./scoring";

export const DECISION_STYLE_SCALE_VALUES = Object.freeze([-2, -1, 0, 1, 2] as const);

export function decisionStyleScaleAccessibilityLabel(
  question: DecisionStyleQuestion,
  value: DecisionStyleAnswerValue,
): string {
  if (value === 0) return "两边差不多";
  const label = value < 0 ? question.left.label : question.right.label;
  return `${Math.abs(value) === 2 ? "强烈偏向" : "稍微偏向"}：${label}`;
}

export function upsertDecisionStyleAnswer(
  detail: DecisionStyleLocalDetail,
  questionId: string,
  value: DecisionStyleAnswerValue,
): DecisionStyleLocalDetail {
  const found = detail.answers.some((answer) => answer.questionId === questionId);
  return {
    ...detail,
    answers: found
      ? detail.answers.map((answer) => answer.questionId === questionId ? { ...answer, value } : answer)
      : [...detail.answers, { questionId, value }],
  };
}
```

- [ ] **Step 4: Implement all 16 presentation records**

```ts
// packages/core/src/decisionStyle/presentation.ts
import type { DecisionStyleCode } from "./axes";

export interface DecisionPersonalityPresentation {
  readonly code: DecisionStyleCode;
  readonly label: string;
  readonly tagline: string;
  readonly highlight: string;
  readonly roast: string;
  readonly advice: string;
  readonly characterId: DecisionStyleCode;
}

const p = (
  code: DecisionStyleCode,
  label: string,
  tagline: string,
  highlight: string,
  roast: string,
  advice: string,
): DecisionPersonalityPresentation => Object.freeze({ code, label, tagline, highlight, roast, advice, characterId: code });

const PRESENTATIONS = Object.freeze([
  p("FDBG", "务实攻坚者", "你不是没耐心，只是觉得今天能解决的事，不该开三次会。", "目标一清楚，你通常是最先把事情推起来的人。", "推进太快时，别人和后手可能还没跟上。", "重要决定前，强制找一个人唱反调。"),
  p("FDBV", "信念开拓者", "路还没铺好，你已经凭直觉走出第一公里。", "没有现成答案时，你仍敢围绕真正重视的方向开路。", "一上头就容易把协作和成本都当成以后再说。", "给自己配一位现实合伙人，专门提醒投入边界。"),
  p("FDLG", "借势攀登者", "别人还在找梯子，你已经踩着现成台阶往上走了。", "你能快速发现可用资源，并把它们变成真实进展。", "机会太顺时，容易忘了这到底是不是你想去的地方。", "每到关键节点，先写下自己的选择标准。"),
  p("FDLV", "组织破局者", "你最擅长的不是适应规则，是边跑边把规则改得能用。", "你能在协作中推动改变，也敢为重要的事先迈一步。", "一旦认定值得，容易把自己的恢复空间也拿去填坑。", "先把改变拆成一个能够协商的小步骤。"),
  p("FWBG", "多线经营者", "你的备选方案不是 B 计划，是从 B 排到 G。", "你能同时捕捉多种机会，并保持行动和回报的弹性。", "每条线都舍不得关，最后注意力可能先宣布破产。", "每周删掉一条回报和投入都说不清的支线。"),
  p("FWBV", "自由开拓者", "别人怕选错，你更怕世界上还有一条路没走过。", "你愿意主动尝试新可能，也很少把自己困在单一路线里。", "新鲜感一来，昨天的长期主义就容易请假。", "每次探索都设一个继续、暂停或收束日期。"),
  p("FWLG", "机会整合者", "你的人生不像单线程，更像同时开着十二个合作窗口。", "你擅长把不同机会、资源和人连接成新的路径。", "外面的机会太热闹时，自己的优先级容易被静音。", "比较机会前，先写下三个不可让步的条件。"),
  p("FWLV", "跨界理想家", "你不是想得太多，是每个可能性都刚好有点意思。", "你能在多元连接里看到意义，并把不同视角放到一起。", "一直保持开放，也可能让最重要的事迟迟没有落点。", "只选一个本月必须做出的可见成果。"),
  p("SDBG", "稳健匠人", "你不是慢，你只是拒绝拿长期质量给短期速度交作业。", "你能在可控节奏里持续深耕，把保障和质量一起守住。", "等到完全有把握，低成本试错的窗口可能已经关了。", "保留主线，同时安排一个可逆的小实验。"),
  p("SDBV", "长期创造者", "别人靠截止日期推进，你靠心里那件真正重要的事。", "你能为重要方向耐心积累，并长期保持内在一致。", "太忠于最初方向时，环境变了你也可能假装没看见。", "固定邀请外部反馈，检查坚持是否仍有价值。"),
  p("SDLG", "深耕积累者", "你不追每一阵风，但很会把一块地种到别人追不上。", "你善于借助稳定资源，把一条主线做出可靠积累。", "熟悉路径太舒服时，新选择很难挤进日程。", "定期盘点可迁移能力，并主动建立一个新连接。"),
  p("SDLV", "价值深耕者", "你愿意把重要的事做很久，也愿意把身边的人一起带稳。", "你能在长期协作中持续投入，并形成让人放心的贡献。", "太会照顾整体，自己的表达和边界常被排到最后。", "明确提出一项你想推动的改变和需要的支持。"),
  p("SWBG", "稳健多面手", "你从不把鸡蛋放一个篮子，偶尔连篮子也准备了备份。", "你能在多个方向之间留下余量，不轻易让自己失去退路。", "为了不押错，可能每条路都只走到刚刚认识你。", "从现有方向中挑一条，连续投入四周再判断。"),
  p("SWBV", "自在探索者", "你看起来不着急，其实一直在悄悄试探世界的边界。", "你能用自己的节奏探索多种可能，同时保护内在认同。", "选择一直留着，也可能意味着最想做的事一直没开始。", "给最在意的一条线安排一次真实行动。"),
  p("SWLG", "稳健多栖者", "别人做选择题，你擅长把题目改成多选并留好退路。", "你善于利用现有连接维持多种选择和安全余量。", "外部安排越完整，自己的优先级越容易变成代办。", "把所有连接分成真正支持你和只消耗注意力两类。"),
  p("SWLV", "从容连接者", "你总能看到每个人的立场，唯独自己的决定容易晚一点出现。", "你能在多元协作中保持从容，也很少轻易忽略他人。", "顾全太多方时，明确表态会被你无限延期。", "先独立写下个人优先级，再进入协商。"),
] satisfies readonly DecisionPersonalityPresentation[]);

export function allDecisionPersonalityPresentations(): readonly DecisionPersonalityPresentation[] {
  return PRESENTATIONS;
}

export function decisionPersonalityPresentationByCode(code: string): DecisionPersonalityPresentation | undefined {
  return PRESENTATIONS.find((item) => item.code === code);
}
```

- [ ] **Step 5: Export the new files and verify GREEN**

Add to `packages/core/src/decisionStyle/index.ts`:

```ts
export * from "./answerScale";
export * from "./presentation";
```

Run: `npx vitest run packages/core/src/__tests__/decisionStylePresentation.test.ts packages/core/src/__tests__/decisionStyle.test.ts`

Expected: PASS, 0 failures.

- [ ] **Step 6: Commit Task 1**

```bash
git add packages/core/src/decisionStyle/answerScale.ts packages/core/src/decisionStyle/presentation.ts packages/core/src/decisionStyle/index.ts packages/core/src/__tests__/decisionStylePresentation.test.ts
git commit -m "feat: add decision personality presentation model"
```

### Task 2: Produce and register the 16-character art system

**Files:**
- Create: `public/decision-style/characters/*.png`
- Create: `mobile/assets/decision-style/characters/*.png`
- Create: `src/lib/__tests__/decisionStyleCharacterAssets.test.ts`
- Create: `src/components/decision-style/DecisionStyleCharacter.tsx`
- Create: `mobile/src/components/DecisionStyleCharacter.tsx`

**Interfaces:**
- Consumes: `DecisionStyleCode`, `decisionPersonalityPresentationByCode(code)`.
- Produces: Web `<DecisionStyleCharacter code size className />`; mobile `<DecisionStyleCharacter code size />`; identical `{CODE}.png` files in both asset roots.

- [ ] **Step 1: Write the failing binary asset contract test**

```ts
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allDecisionPersonalityPresentations } from "@/domain/decisionStyle";

const roots = [
  join(process.cwd(), "public", "decision-style", "characters"),
  join(process.cwd(), "mobile", "assets", "decision-style", "characters"),
];

function pngInfo(buffer: Buffer) {
  return {
    signature: buffer.subarray(0, 8).toString("hex"),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
    hash: createHash("sha256").update(buffer).digest("hex"),
  };
}

describe("decision personality character assets", () => {
  it("ships matching square transparent PNGs for all 16 codes", async () => {
    for (const item of allDecisionPersonalityPresentations()) {
      const copies = await Promise.all(roots.map((root) => readFile(join(root, `${item.characterId}.png`))));
      const [web, mobile] = copies.map(pngInfo);
      expect(web.signature).toBe("89504e470d0a1a0a");
      expect(web.width).toBe(web.height);
      expect(web.width).toBeGreaterThanOrEqual(1024);
      expect([4, 6]).toContain(web.colorType);
      expect(mobile.hash).toBe(web.hash);
    }
  });
});
```

- [ ] **Step 2: Run the asset test and verify RED**

Run: `npx vitest run src/lib/__tests__/decisionStyleCharacterAssets.test.ts`

Expected: FAIL with missing `FDBG.png`.

- [ ] **Step 3: Generate the style anchor with the imagegen skill**

Generate `FDBG.png` first and approve it as the style reference. Use this exact shared direction:

```text
Modern editorial full-body character illustration for a mature Chinese productivity and life-planning app. Warm off-white paper feel, low-saturation burnt orange, charcoal, sand and muted teal, confident clean ink outlines, subtle grain, expressive geometric proportions, friendly adult character, no text, no letters, no logo, no UI, no frame, no gradient, no photorealism, no 3D toy look, no childish chibi style. Single centered character, strong silhouette readable at thumbnail size, transparent background, square canvas.

FDBG 务实攻坚者: stepping forward decisively, rolled sleeves, holding a concise checklist in one hand and a compact practical tool in the other, one grounded anchor block near the feet, focused expression, motion directed toward one clear target.
```

- [ ] **Step 4: Generate the remaining 15 assets using FDBG as the style reference**

Use the same shared direction and one exact brief per code:

| Code | Character brief |
|---|---|
| FDBV | Striding into an unmarked path with a compass and small torch, self-directed posture, one meaningful distant light, minimal support structure. |
| FDLG | Climbing an existing scaffold with a compact action plan, using a visible platform efficiently, one clear target flag above. |
| FDLV | Moving through a collaborative structure while adjusting its blueprint, one hand inviting others forward, a meaningful beacon ahead. |
| FWBG | Moving quickly while sorting several opportunity cards and resource tokens into a practical belt, multiple paths but controlled energy. |
| FWBV | Light backpack, compass, several branching trails and sparks, active curious stride, no fixed rail or platform. |
| FWLG | Connecting several floating opportunity nodes through an existing bridge and network, quick integrator posture, many usable links. |
| FWLV | Crossing a bridge between different idea islands, carrying a bright beacon, multiple meaningful symbols orbiting calmly. |
| SDBG | Stable grounded stance at a workbench-like abstract surface, carefully aligning a blueprint and durable blocks, small anchor nearby. |
| SDBV | Patiently tending a growing luminous structure from seed to tall form, personal tools, one long-term meaningful light. |
| SDLG | Building a deep stack of durable blocks along an existing ladder, organized archive shapes, calm concentrated posture. |
| SDLV | Tending a shared long-term beacon inside a supportive structure, steady collaborative posture, one clearly protected value symbol. |
| SWBG | Calmly balancing several baskets and paths under a practical umbrella-like structure, backup anchor and visible safety margin. |
| SWBV | Standing at a trail junction with a telescope and small lantern, relaxed exploratory posture, several possibilities with ample space. |
| SWLG | Moving carefully across a network of stable stepping stones, several supported routes, organized external connections. |
| SWLV | Calm figure linking several people-like abstract nodes around a shared lantern, many perspectives visible, own compass held close. |

Save every approved square transparent PNG to both asset roots with an uppercase filename matching the code.

- [ ] **Step 5: Run the asset contract until GREEN**

Run: `npx vitest run src/lib/__tests__/decisionStyleCharacterAssets.test.ts`

Expected: PASS for all 16 files; each pair has the same SHA-256 hash.

- [ ] **Step 6: Add the Web character component**

```tsx
/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import type { DecisionStyleCode } from "@/domain/decisionStyle";

export function DecisionStyleCharacter({
  code,
  size = 280,
  className,
}: {
  code: DecisionStyleCode;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div aria-label={`${code} 人格角色`} className={className} style={{ width: size, height: size, borderRadius: "42% 58% 48% 52%", background: "var(--accent-soft)" }} />;
  }
  return (
    <img
      src={`/decision-style/characters/${code}.png`}
      alt={`${code} 人格角色`}
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
```

- [ ] **Step 7: Add the mobile static registry**

```tsx
import React from "react";
import { Image, StyleSheet, View } from "react-native";
import type { DecisionStyleCode } from "@lifeplanner/core/decisionStyle";
import { colors } from "../theme";

const SOURCES = {
  FDBG: require("../../assets/decision-style/characters/FDBG.png"),
  FDBV: require("../../assets/decision-style/characters/FDBV.png"),
  FDLG: require("../../assets/decision-style/characters/FDLG.png"),
  FDLV: require("../../assets/decision-style/characters/FDLV.png"),
  FWBG: require("../../assets/decision-style/characters/FWBG.png"),
  FWBV: require("../../assets/decision-style/characters/FWBV.png"),
  FWLG: require("../../assets/decision-style/characters/FWLG.png"),
  FWLV: require("../../assets/decision-style/characters/FWLV.png"),
  SDBG: require("../../assets/decision-style/characters/SDBG.png"),
  SDBV: require("../../assets/decision-style/characters/SDBV.png"),
  SDLG: require("../../assets/decision-style/characters/SDLG.png"),
  SDLV: require("../../assets/decision-style/characters/SDLV.png"),
  SWBG: require("../../assets/decision-style/characters/SWBG.png"),
  SWBV: require("../../assets/decision-style/characters/SWBV.png"),
  SWLG: require("../../assets/decision-style/characters/SWLG.png"),
  SWLV: require("../../assets/decision-style/characters/SWLV.png"),
} satisfies Record<DecisionStyleCode, number>;

export function DecisionStyleCharacter({ code, size = 220 }: { code: DecisionStyleCode; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return <View accessibilityLabel={`${code} 人格角色`} style={[styles.fallback, { width: size, height: size }]} />;
  return <Image source={SOURCES[code]} accessibilityLabel={`${code} 人格角色`} resizeMode="contain" onError={() => setFailed(true)} style={{ width: size, height: size }} />;
}

const styles = StyleSheet.create({
  fallback: { borderRadius: 72, backgroundColor: colors.accentSoft },
});
```

- [ ] **Step 8: Verify registries and commit Task 2**

Run: `npx tsc --noEmit`

Run from `mobile`: `npx tsc --noEmit`

Expected: both commands exit 0.

```bash
git add public/decision-style/characters mobile/assets/decision-style/characters src/lib/__tests__/decisionStyleCharacterAssets.test.ts src/components/decision-style/DecisionStyleCharacter.tsx mobile/src/components/DecisionStyleCharacter.tsx
git commit -m "feat: add decision personality character system"
```

### Task 3: Replace the Web form with the bipolar five-dot test

**Files:**
- Create: `src/components/decision-style/DecisionStyleScale.tsx`
- Modify: `src/components/decision-style/DecisionStyleTest.tsx`
- Modify: `src/components/decision-style/__tests__/DecisionStyleTest.test.tsx`

**Interfaces:**
- Consumes: Task 1 scale helpers and existing full question inventory.
- Produces: `DecisionStyleScale({ question, value, disabled, onChange })`; test flow auto-advances after exactly 200ms.

- [ ] **Step 1: Rewrite the component tests for auto-advance and rapid-tap locking**

Add this helper and test; update existing loops to call `chooseAndAdvance` instead of clicking “下一题”:

```tsx
import { act } from "@testing-library/react";
import { decisionStyleScaleAccessibilityLabel } from "@/domain/decisionStyle";

function chooseAndAdvance(questionIndex: number, value: -2 | -1 | 0 | 1 | 2) {
  fireEvent.click(screen.getByRole("button", {
    name: decisionStyleScaleAccessibilityLabel(FULL_QUESTIONS[questionIndex], value),
  }));
  act(() => vi.advanceTimersByTime(200));
}

function chooseTieAndFinish(label: string) {
  fireEvent.click(screen.getByRole("radio", { name: label }));
  act(() => vi.advanceTimersByTime(200));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

it("auto-advances once, ignores a second rapid choice, and preserves back edits", () => {
  render(<DecisionStyleTest onContinueToTree={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "开始测试" }));
  const first = FULL_QUESTIONS[0];
  fireEvent.click(screen.getByRole("button", { name: decisionStyleScaleAccessibilityLabel(first, -2) }));
  fireEvent.click(screen.getByRole("button", { name: decisionStyleScaleAccessibilityLabel(first, 2) }));
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByText("02 / 28")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "上一题" }));
  expect(screen.getByRole("button", { name: decisionStyleScaleAccessibilityLabel(first, -2) })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: decisionStyleScaleAccessibilityLabel(first, 2) })).toHaveAttribute("aria-pressed", "false");
});
```

- [ ] **Step 2: Run the Web test and verify RED**

Run: `npx vitest run src/components/decision-style/__tests__/DecisionStyleTest.test.tsx`

Expected: FAIL because the five-dot buttons and auto-advance do not exist.

- [ ] **Step 3: Implement the Web scale component**

```tsx
import {
  DECISION_STYLE_SCALE_VALUES,
  decisionStyleScaleAccessibilityLabel,
  type DecisionStyleAnswerValue,
  type DecisionStyleQuestion,
} from "@/domain/decisionStyle";

export function DecisionStyleScale({
  question,
  value,
  disabled = false,
  onChange,
}: {
  question: DecisionStyleQuestion;
  value?: DecisionStyleAnswerValue;
  disabled?: boolean;
  onChange: (value: DecisionStyleAnswerValue) => void;
}) {
  return (
    <fieldset className="space-y-6" disabled={disabled}>
      <legend className="sr-only">{question.prompt}</legend>
      <div className="grid grid-cols-2 gap-5 text-base font-medium leading-6 text-[var(--fg)]">
        <p>{question.left.label}</p>
        <p className="text-right">{question.right.label}</p>
      </div>
      <div className="relative flex items-center justify-between gap-2 px-1 before:absolute before:left-6 before:right-6 before:top-1/2 before:h-px before:bg-[var(--line)]">
        {DECISION_STYLE_SCALE_VALUES.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-label={decisionStyleScaleAccessibilityLabel(question, option)}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(option)}
              className={`relative z-10 grid size-11 place-items-center rounded-full border transition duration-200 motion-reduce:transition-none ${selected ? "scale-110 border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]"}`}
            >
              <span className={`rounded-full ${selected ? "size-3 bg-white" : "size-2 bg-[var(--fg-faint)]"}`} />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 4: Replace Web question navigation with one locked 200ms transition**

In `DecisionStyleTest.tsx`, remove `intensityOptions`, import `DecisionStyleScale` and `upsertDecisionStyleAnswer`, add a timer ref, and pass the exact next detail into completion:

```tsx
const advanceTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);

useEffect(() => () => {
  if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
}, []);

async function finish(detail = draftState.detail) {
  const next = scoreDecisionStyle("full", detail.answers, detail.tieBreaks);
  if (!next.code) {
    setDraftState({ stage: "tieBreakers", detail });
    return;
  }

  const summary: DecisionStyleSummary = {
    version: 2,
    source: "full",
    code: next.code,
    scores: next.scores,
    completedAt: new Date().toISOString(),
  };

  void trackDecisionStyleEvent("style_complete", { source: inviteToken ? "shared" : "direct" });
  saveDecisionStyleDetail(detail);
  clearDecisionStyleDraft();
  setCompareError(null);

  if (tree) {
    if (applyDecisionStyleSummary) applyDecisionStyleSummary(summary);
    else persistDecisionStyleSummary(summary, tree);
  } else if (!inviteToken) {
    saveDecisionStyleSummaryHandoff(summary);
  }

  if (inviteToken) {
    try {
      const signed = await requestDecisionStyleShareLink(summary);
      onInviteCleared?.();
      onCompareReady?.(`/compare/${inviteToken}/${signed.token}`);
      return;
    } catch {
      setCompareError("对比暂时不可用，请稍后重试。");
    }
  }

  setCompletedSummary(summary);
  setCompletedEvidence(next.evidence);
  setDraftState({ stage: "result", detail });
}

function chooseAnswer(value: DecisionStyleAnswerValue) {
  if (advanceTimer.current) return;
  const nextDetail = upsertDecisionStyleAnswer(draftState.detail, activeQuestion.id, value);
  persist(nextDetail, "questions");
  advanceTimer.current = window.setTimeout(() => {
    advanceTimer.current = null;
    if (questionIndex === FULL_QUESTIONS.length - 1) void finish(nextDetail);
    else setQuestionIndex((current) => current + 1);
  }, 200);
}
```

Render the question header and scale as:

```tsx
<div className="flex items-center gap-4">
  <Button type="button" variant="ghost" className="min-h-11" disabled={questionIndex === 0} onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}>
    上一题
  </Button>
  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/8" aria-hidden="true">
    <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${((questionIndex + 1) / FULL_QUESTIONS.length) * 100}%` }} />
  </div>
  <span className="text-sm tabular-nums text-[var(--fg-dim)]">{String(questionIndex + 1).padStart(2, "0")} / {FULL_QUESTIONS.length}</span>
</div>
<h2 className="text-2xl font-semibold text-[var(--fg)]">{activeQuestion.prompt}</h2>
<DecisionStyleScale question={activeQuestion} value={selectedValue} disabled={advanceTimer.current !== null} onChange={chooseAnswer} />
```

Remove the question-stage “下一题/查看结果” button. Rename the tie-break heading to “加赛题” and use this handler:

```tsx
function chooseTie(axis: DecisionStyleAxis, pole: "a" | "b") {
  if (advanceTimer.current) return;
  const nextDetail = updateTieBreak(draftState.detail, axis, pole);
  persist(nextDetail, "tieBreakers");
  advanceTimer.current = window.setTimeout(() => {
    advanceTimer.current = null;
    void finish(nextDetail);
  }, 200);
}
```

Update every tie-break test to call `chooseTieAndFinish("先试一次再调整")` and remove clicks on the deleted “查看结果” button.

- [ ] **Step 5: Update the intro and verify Web GREEN**

Use these exact strings:

```tsx
<div className="text-xs tracking-[0.18em] text-[var(--fg-faint)]">决策人格测试</div>
<h1 className="text-3xl font-semibold text-[var(--fg)]">28 道选择题，看看你做重大决定时像哪种人</h1>
<p className="text-sm leading-6 text-[var(--fg-dim)]">按最近真实发生的选择回答。原始答案只保存在本设备；结果描述当前倾向，不是固定人格或心理诊断。</p>
```

Run: `npx vitest run src/components/decision-style/__tests__/DecisionStyleTest.test.tsx`

Run: `npx tsc --noEmit`

Expected: both pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/components/decision-style/DecisionStyleScale.tsx src/components/decision-style/DecisionStyleTest.tsx src/components/decision-style/__tests__/DecisionStyleTest.test.tsx
git commit -m "feat: redesign web decision personality test"
```

### Task 4: Build the matching native five-dot test

**Files:**
- Create: `mobile/src/components/DecisionStyleScale.tsx`
- Modify: `mobile/src/components/DecisionStyleQuickTest.tsx`

**Interfaces:**
- Consumes: Task 1 scale helpers, existing AsyncStorage draft functions.
- Produces: native five-dot scale with 44pt targets, 200ms locked auto-advance, back navigation, and “加赛题”.

- [ ] **Step 1: Add a failing source-independent flow case to the shared test**

Extend Task 1's test to prove a returned answer remains replaceable after later answers:

```ts
it("preserves answer order while editing an earlier answer", () => {
  const initial = { version: 2 as const, answers: [], tieBreaks: {} };
  const first = upsertDecisionStyleAnswer(initial, "tempo-1", -2);
  const second = upsertDecisionStyleAnswer(first, "focus-1", 1);
  const edited = upsertDecisionStyleAnswer(second, "tempo-1", 2);
  expect(edited.answers).toEqual([
    { questionId: "tempo-1", value: 2 },
    { questionId: "focus-1", value: 1 },
  ]);
});
```

Run: `npx vitest run packages/core/src/__tests__/decisionStylePresentation.test.ts`

Expected: PASS with the Task 1 implementation; this pins the logic before native UI changes.

- [ ] **Step 2: Implement the native scale**

```tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  DECISION_STYLE_SCALE_VALUES,
  decisionStyleScaleAccessibilityLabel,
  type DecisionStyleAnswerValue,
  type DecisionStyleQuestion,
} from "@lifeplanner/core/decisionStyle";
import { colors } from "../theme";

export function DecisionStyleScale({ question, value, disabled, onChange }: {
  question: DecisionStyleQuestion;
  value?: DecisionStyleAnswerValue;
  disabled: boolean;
  onChange: (value: DecisionStyleAnswerValue) => void;
}) {
  return (
    <View>
      <View style={styles.ends}>
        <Text style={styles.endText}>{question.left.label}</Text>
        <Text style={[styles.endText, styles.endRight]}>{question.right.label}</Text>
      </View>
      <View style={styles.scale}>
        <View pointerEvents="none" style={styles.line} />
        {DECISION_STYLE_SCALE_VALUES.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={decisionStyleScaleAccessibilityLabel(question, option)}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option)}
              style={({ pressed }) => [styles.target, selected && styles.targetSelected, pressed && !disabled && styles.pressed]}
            >
              <View style={[styles.dot, selected && styles.dotSelected]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ends: { flexDirection: "row", justifyContent: "space-between", gap: 20, marginBottom: 18 },
  endText: { flex: 1, color: colors.fg, fontSize: 16, lineHeight: 23, fontWeight: "600" },
  endRight: { textAlign: "right" },
  scale: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  line: { position: "absolute", left: 22, right: 22, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  target: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  targetSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.fgMuted },
  dotSelected: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff" },
  pressed: { transform: [{ scale: 0.96 }] },
});
```

- [ ] **Step 3: Replace the native options and add locked auto-advance**

In `DecisionStyleQuickTest.tsx`, delete `options()`, import `DecisionStyleScale` and `upsertDecisionStyleAnswer`, and add:

```tsx
const advanceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => () => {
  if (advanceTimer.current) clearTimeout(advanceTimer.current);
}, []);

const finish = async (nextDetail: DecisionStyleLocalDetail) => {
  const result = scoreDecisionStyle("quick", nextDetail.answers, nextDetail.tieBreaks);
  if (!result.code) {
    setStage("ties");
    return;
  }
  setBusy(true);
  try {
    await saveDecisionStyleDetail(nextDetail);
    const nextSummary: DecisionStyleSummary = {
      version: 2,
      source: "quick",
      code: result.code,
      scores: result.scores,
      completedAt: new Date().toISOString(),
    };
    void trackAppDecisionStyleEvent("style_complete");
    setSummary(nextSummary);
    setStage("result");
  } finally {
    setBusy(false);
  }
};

const chooseAnswer = (value: DecisionStyleAnswerValue) => {
  if (advanceTimer.current) return;
  const question = QUICK_QUESTIONS[index];
  const next = upsertDecisionStyleAnswer(detail, question.id, value);
  save(next);
  advanceTimer.current = setTimeout(() => {
    advanceTimer.current = null;
    if (index === QUICK_QUESTIONS.length - 1) void finish(next);
    else setIndex((current) => current + 1);
  }, 200);
};
```

Render `DecisionStyleScale` and a header containing a back `Pressable`, thin progress track, and `03 / 12`. Remove “下一题/完成快测”. Disable back while the timer is locked. Rename tie UI to “加赛题”; selecting its option saves and auto-finishes after 200ms.

- [ ] **Step 4: Update the native intro copy**

Use these exact strings:

```tsx
<Text style={styles.eyebrow}>决策人格测试</Text>
<Text style={styles.title}>12 道选择题，看看你做重大决定时像哪种人</Text>
<Muted>按最近真实发生的选择回答。原始答案只保存在本机；结果描述当前倾向，不是固定人格或心理诊断。</Muted>
```

- [ ] **Step 5: Verify and commit Task 4**

Run: `npx vitest run packages/core/src/__tests__/decisionStylePresentation.test.ts`

Run from `mobile`: `npx tsc --noEmit`

Expected: both pass.

```bash
git add packages/core/src/__tests__/decisionStylePresentation.test.ts mobile/src/components/DecisionStyleScale.tsx mobile/src/components/DecisionStyleQuickTest.tsx
git commit -m "feat: redesign native decision personality test"
```

### Task 5: Make identity and character the result-page priority

**Files:**
- Create: `src/components/decision-style/DecisionPersonalityHero.tsx`
- Modify: `src/components/decision-style/DecisionStyleResult.tsx`
- Modify: `src/components/decision-style/DecisionStyleAxisBars.tsx`
- Modify: `src/components/decision-style/__tests__/DecisionStyleResult.test.tsx`
- Create: `mobile/src/components/DecisionPersonalityCard.tsx`
- Modify: `mobile/src/components/DecisionStyleQuickTest.tsx`
- Modify: `mobile/src/screens/MeScreen.tsx`

**Interfaces:**
- Consumes: Task 1 presentation data and Task 2 character components.
- Produces: Web `DecisionPersonalityHero`; native `DecisionPersonalityCard`; details hidden behind explicit disclosure.

- [ ] **Step 1: Rewrite the Web result priority test and verify RED**

Add assertions before the existing share-action tests:

```tsx
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

it("renders identity first and keeps numeric axes in a disclosure", () => {
  render(<DecisionStyleResult summary={summary} evidence={evidence} onContinue={vi.fn()} onRestart={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "FDBG" })).toBeInTheDocument();
  expect(screen.getByText("务实攻坚者")).toBeInTheDocument();
  expect(screen.getByText("你不是没耐心，只是觉得今天能解决的事，不该开三次会。")).toBeInTheDocument();
  expect(screen.getByText("目标一清楚，你通常是最先把事情推起来的人。")).toBeInTheDocument();
  expect(screen.getByText("推进太快时，别人和后手可能还没跟上。")).toBeInTheDocument();
  expect(screen.queryByText(/76 \/ 100/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "看看我为什么是这个类型" }));
  expect(screen.getByText(/76 \/ 100/)).toBeInTheDocument();
  expect(screen.getByText("本地结果依据")).toBeInTheDocument();
});
```

Run: `npx vitest run src/components/decision-style/__tests__/DecisionStyleResult.test.tsx`

Expected: FAIL because the new hero and disclosure do not exist.

- [ ] **Step 2: Implement the Web hero**

```tsx
"use client";

import { useEffect, useState } from "react";
import { decisionPersonalityPresentationByCode, type DecisionStyleSummary } from "@/domain/decisionStyle";
import { DecisionStyleCharacter } from "./DecisionStyleCharacter";

export function DecisionPersonalityHero({ summary, reveal = true }: { summary: DecisionStyleSummary; reveal?: boolean }) {
  const presentation = decisionPersonalityPresentationByCode(summary.code);
  const [revealed, setRevealed] = useState(!reveal);

  useEffect(() => {
    if (!reveal || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }
    const timer = window.setTimeout(() => setRevealed(true), 450);
    return () => window.clearTimeout(timer);
  }, [reveal]);

  if (!presentation) return null;
  if (!revealed) {
    return (
      <section aria-label="正在揭晓你的决策人格" className="grid min-h-[420px] place-items-center overflow-hidden rounded-[2rem] bg-[#f4eadf]">
        <div className="opacity-35 grayscale"><DecisionStyleCharacter code={summary.code} size={300} /></div>
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-[2rem] bg-[#f4eadf] px-6 pb-7 pt-6 text-[#251f1a] sm:px-9">
      <div className="text-xs tracking-[0.2em] text-[#7b6c60]">你的决策人格</div>
      <div className="mt-3 grid items-center gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-6xl font-black tracking-[-0.06em] sm:text-7xl">{summary.code}</h1>
          <p className="mt-1 text-xl font-semibold">{presentation.label}</p>
          <p className="mt-5 max-w-xl text-xl font-medium leading-8">{presentation.tagline}</p>
        </div>
        <DecisionStyleCharacter code={summary.code} size={280} className="mx-auto" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/65 p-4"><div className="text-xs text-[#8b5a3c]">你的高光</div><p className="mt-2 leading-6">{presentation.highlight}</p></div>
        <div className="rounded-2xl bg-[#2d2925] p-4 text-[#fffaf4]"><div className="text-xs text-[#d9b99d]">容易翻车</div><p className="mt-2 leading-6">{presentation.roast}</p></div>
      </div>
      <p className="mt-4 text-sm text-[#695c52]">给你的提醒：{presentation.advice}</p>
    </section>
  );
}
```

- [ ] **Step 3: Refactor Web result actions and details**

Use local `detailsOpen` state. Render `DecisionPersonalityHero` first, then primary “分享我的人格”, secondary disclosure button, and only when open render `DecisionStyleAxisBars`, local evidence, and the disclaimer. Keep copy, PNG, continue-tree and restart actions inside the expanded actions/details region so the first viewport is not a five-button stack.

The disclosure control must be:

```tsx
<Button type="button" variant="subtle" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>
  {detailsOpen ? "收起人格详情" : "看看我为什么是这个类型"}
</Button>
```

- [ ] **Step 4: Implement the native result card**

```tsx
import React from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import { decisionPersonalityPresentationByCode, type DecisionStyleSummary } from "@lifeplanner/core/decisionStyle";
import { colors, radii } from "../theme";
import { DecisionStyleCharacter } from "./DecisionStyleCharacter";

export function DecisionPersonalityCard({ summary, compact = false, reveal = false }: { summary: DecisionStyleSummary; compact?: boolean; reveal?: boolean }) {
  const item = decisionPersonalityPresentationByCode(summary.code);
  const [revealed, setRevealed] = React.useState(!reveal);

  React.useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active) return;
      if (reduced || !reveal) setRevealed(true);
      else timer = setTimeout(() => setRevealed(true), 450);
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [reveal]);

  if (!item) return null;
  if (!revealed) {
    return <View accessibilityLabel="正在揭晓你的决策人格" style={styles.card}><View style={{ opacity: 0.35, alignItems: "center" }}><DecisionStyleCharacter code={summary.code} size={220} /></View></View>;
  }
  return (
    <View style={[styles.card, compact && styles.compact]}>
      <Text style={styles.eyebrow}>你的决策人格</Text>
      <View style={styles.heroRow}>
        <View style={styles.copy}>
          <Text style={styles.code}>{summary.code}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
        <DecisionStyleCharacter code={summary.code} size={compact ? 124 : 190} />
      </View>
      <Text style={styles.tagline}>{item.tagline}</Text>
      {!compact ? (
        <>
          <View style={styles.lightPanel}><Text style={styles.panelLabel}>你的高光</Text><Text style={styles.panelText}>{item.highlight}</Text></View>
          <View style={styles.darkPanel}><Text style={styles.darkLabel}>容易翻车</Text><Text style={styles.darkText}>{item.roast}</Text></View>
          <Text style={styles.advice}>给你的提醒：{item.advice}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, backgroundColor: "#f4eadf", padding: 20, overflow: "hidden" },
  compact: { padding: 16 },
  eyebrow: { color: "#7b6c60", fontSize: 12, letterSpacing: 1.4 },
  heroRow: { flexDirection: "row", alignItems: "center" },
  copy: { flex: 1 },
  code: { color: "#251f1a", fontSize: 52, fontWeight: "900", letterSpacing: -3 },
  label: { color: "#251f1a", fontSize: 20, fontWeight: "700", marginTop: 2 },
  tagline: { color: "#251f1a", fontSize: 18, lineHeight: 27, fontWeight: "600", marginBottom: 14 },
  lightPanel: { borderRadius: radii.md, backgroundColor: "rgba(255,255,255,0.72)", padding: 14, marginTop: 10 },
  darkPanel: { borderRadius: radii.md, backgroundColor: "#2d2925", padding: 14, marginTop: 10 },
  panelLabel: { color: colors.accent, fontSize: 12, marginBottom: 6 },
  panelText: { color: "#251f1a", fontSize: 15, lineHeight: 22 },
  darkLabel: { color: "#d9b99d", fontSize: 12, marginBottom: 6 },
  darkText: { color: "#fffaf4", fontSize: 15, lineHeight: 22 },
  advice: { color: "#695c52", fontSize: 14, lineHeight: 21, marginTop: 14 },
});
```

- [ ] **Step 5: Wire the native result and Me screen**

Use the full card in the quick-test `result` stage:

```tsx
if (stage === "result" && summary) {
  return (
    <TestFrame embedded={embedded}>
      <DecisionPersonalityCard summary={summary} reveal />
      <View style={styles.resultActions}>
        <Button label="继续填写资料" onPress={() => onComplete(summary)} />
      </View>
      <Muted style={styles.disclaimer}>当前自报倾向，不是固定人格或心理诊断。</Muted>
    </TestFrame>
  );
}
```

In `MeScreen`, import `AXES` and add `styleDetailsOpen` state. Replace the old raw-score card body with:

```tsx
<DecisionPersonalityCard summary={p.decisionStyle} compact />
<Button
  label={sharingStyle ? "准备分享中…" : "分享我的人格"}
  loading={sharingStyle}
  onPress={() => void handleStyleShare()}
/>
<Button
  label={styleDetailsOpen ? "收起人格详情" : "查看人格详情"}
  kind="ghost"
  onPress={() => setStyleDetailsOpen((open) => !open)}
/>
{styleDetailsOpen ? (
  <View style={styles.styleScoreRow}>
    {AXES.map((axis) => (
      <Text key={axis.key} style={styles.styleScore}>
        {axis.a.label} / {axis.b.label} · {p.decisionStyle!.scores[axis.key]}
      </Text>
    ))}
  </View>
) : null}
<Button label="重新测试" kind="ghost" onPress={() => setStyleRetake(true)} />
```

Never render the keys `tempo`, `focus`, `engine`, or `drive` directly.

Add these native styles:

```ts
resultActions: { marginTop: 16 },
disclaimer: { marginTop: 12, textAlign: "center" },
```

- [ ] **Step 6: Verify and commit Task 5**

Run: `npx vitest run src/components/decision-style/__tests__/DecisionStyleResult.test.tsx`

Run: `npx tsc --noEmit`

Run from `mobile`: `npx tsc --noEmit`

Expected: all pass.

```bash
git add src/components/decision-style/DecisionPersonalityHero.tsx src/components/decision-style/DecisionStyleResult.tsx src/components/decision-style/DecisionStyleAxisBars.tsx src/components/decision-style/__tests__/DecisionStyleResult.test.tsx mobile/src/components/DecisionPersonalityCard.tsx mobile/src/components/DecisionStyleQuickTest.tsx mobile/src/screens/MeScreen.tsx
git commit -m "feat: add decision personality result experience"
```

### Task 6: Generate portrait PNG, independent OG, and QR

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/decisionStyleShareAssets.server.ts`
- Create: `src/components/decision-style/DecisionStyleShareArtwork.tsx`
- Modify: `src/app/style/[code]/[token]/card.png/route.ts`
- Modify: `src/app/style/[code]/[token]/opengraph-image.tsx`
- Modify: `src/app/style/[code]/[token]/page.test.tsx`
- Modify: `src/lib/decisionStyleShareClient.ts`
- Modify: `src/lib/__tests__/decisionStyleShareClient.test.ts`
- Modify: `src/components/decision-style/DecisionStyleResult.tsx`
- Modify: `src/components/decision-style/__tests__/DecisionStyleResult.test.tsx`
- Create: `mobile/src/lib/decisionStyleShareResponse.ts`
- Create: `mobile/src/lib/__tests__/decisionStyleShareResponse.test.ts`
- Modify: `mobile/src/lib/decisionStyleShare.ts`

**Interfaces:**
- Consumes: verified public payload, Task 1 presentation, Task 2 Web PNG.
- Produces: `PORTRAIT_SIZE`, `OG_SIZE`, `DecisionStyleShareArtwork({ payload, characterSrc, variant, qrSrc })`, `loadDecisionStyleCharacterDataUrl(code)`, `decisionStyleQrDataUrl(url)`.

- [ ] **Step 1: Install the audited QR dependency**

Run: `npm install qrcode-generator@2.0.4`

Expected: package and lockfile list exactly version 2.0.4. The package includes TypeScript declarations and zero runtime dependencies; no external QR service receives signed URLs.

- [ ] **Step 2: Extend image-route tests and verify RED**

Add imports and assertions:

```ts
import { OG_SIZE, PORTRAIT_SIZE } from "@/components/decision-style/DecisionStyleShareArtwork";
import { decisionStyleQrDataUrl } from "@/lib/decisionStyleShareAssets.server";

it("uses separate portrait and OG dimensions and generates a local QR data URL", async () => {
  expect(PORTRAIT_SIZE).toEqual({ width: 1080, height: 1350 });
  expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
  expect(decisionStyleQrDataUrl("https://lifeplanner.test/style/FDBG/token")).toMatch(/^data:image\/svg\+xml;base64,/);
});
```

Update card markup expectations to include the tagline and “我是 FDBG，你是什么？”, and ensure OG and portrait `ImageResponse` routes still return `image/png` for valid tokens and 404 for invalid tokens.

Run: `npx vitest run src/app/style/[code]/[token]/page.test.tsx`

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement server-side character and QR data URLs**

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import qrcode from "qrcode-generator";
import { decisionPersonalityPresentationByCode } from "@/domain/decisionStyle";

export async function loadDecisionStyleCharacterDataUrl(code: string): Promise<string> {
  const item = decisionPersonalityPresentationByCode(code);
  if (!item) throw new Error("Unknown decision personality code");
  try {
    const data = await readFile(join(process.cwd(), "public", "decision-style", "characters", `${item.characterId}.png`));
    return `data:image/png;base64,${data.toString("base64")}`;
  } catch {
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="240" fill="#FBE4D5"/><circle cx="512" cy="390" r="150" fill="#C2410C"/><path d="M252 862c28-190 134-286 260-286s232 96 260 286" fill="#2D2925"/></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(fallback, "utf8").toString("base64")}`;
  }
}

export function decisionStyleQrDataUrl(url: string): string {
  const qr = qrcode(0, "M");
  qr.addData(url, "Byte");
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 6, margin: 12, scalable: true });
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
```

- [ ] **Step 4: Build one Satori-safe artwork component with two explicit variants**

```tsx
/* eslint-disable @next/next/no-img-element */
import { decisionPersonalityPresentationByCode, type DecisionStylePublicPayload } from "@/domain/decisionStyle";

export const PORTRAIT_SIZE = { width: 1080, height: 1350 } as const;
export const OG_SIZE = { width: 1200, height: 630 } as const;

export function DecisionStyleShareArtwork({ payload, characterSrc, variant, qrSrc }: {
  payload: DecisionStylePublicPayload;
  characterSrc: string;
  variant: "portrait" | "og";
  qrSrc?: string;
}) {
  const item = decisionPersonalityPresentationByCode(payload.code);
  if (!item) return null;
  const portrait = variant === "portrait";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: portrait ? "column" : "row", position: "relative", overflow: "hidden", background: "#f4eadf", color: "#251f1a", padding: portrait ? 64 : 52, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", zIndex: 2 }}>
        <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: "#7b6c60" }}>LIFEPLANNER · 决策人格</div>
        <div style={{ display: "flex", marginTop: portrait ? 48 : 28, fontSize: portrait ? 112 : 92, lineHeight: 0.9, fontWeight: 900, letterSpacing: -7 }}>{payload.code}</div>
        <div style={{ display: "flex", marginTop: 14, fontSize: portrait ? 38 : 30, fontWeight: 700 }}>{item.label}</div>
        <div style={{ display: "flex", marginTop: 30, maxWidth: portrait ? 820 : 610, fontSize: portrait ? 34 : 28, lineHeight: 1.45, fontWeight: 600 }}>{item.tagline}</div>
        {portrait ? (
          <div style={{ display: "flex", marginTop: 34, gap: 18 }}>
            <div style={{ display: "flex", flex: 1, flexDirection: "column", borderRadius: 24, background: "rgba(255,255,255,0.72)", padding: 24 }}><div style={{ display: "flex", color: "#9a4c25", fontSize: 18 }}>你的高光</div><div style={{ display: "flex", marginTop: 10, fontSize: 24, lineHeight: 1.45 }}>{item.highlight}</div></div>
            <div style={{ display: "flex", flex: 1, flexDirection: "column", borderRadius: 24, background: "#2d2925", color: "#fffaf4", padding: 24 }}><div style={{ display: "flex", color: "#d9b99d", fontSize: 18 }}>容易翻车</div><div style={{ display: "flex", marginTop: 10, fontSize: 24, lineHeight: 1.45 }}>{item.roast}</div></div>
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", fontSize: portrait ? 26 : 22, fontWeight: 700 }}>
          <div style={{ display: "flex" }}>我是 {payload.code}，你是什么？</div>
          {portrait && qrSrc ? <img src={qrSrc} width={150} height={150} alt="测试入口二维码" /> : null}
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 15, color: "#7b6c60" }}>当前自报倾向，不是固定人格或心理诊断。</div>
      </div>
      <img src={characterSrc} alt="" width={portrait ? 540 : 470} height={portrait ? 540 : 470} style={{ position: portrait ? "absolute" : "relative", right: portrait ? 10 : 0, top: portrait ? 140 : 25, objectFit: "contain", opacity: 1 }} />
    </div>
  );
}
```

- [ ] **Step 5: Split portrait and OG routes**

For `card.png/route.ts`, derive the signed result URL from the request and pass both data URLs:

```ts
export async function GET(request: Request, { params }: { params: Promise<unknown> }) {
  const payload = await resolveDecisionStyleSharePayload(params as Promise<{ code: string; token: string }>);
  if (!payload) return new Response("Not found", { status: 404 });
  const resultUrl = request.url.replace(/\/card\.png(?:\?.*)?$/, "");
  const [characterSrc, qrSrc] = await Promise.all([
    loadDecisionStyleCharacterDataUrl(payload.code),
    decisionStyleQrDataUrl(resultUrl),
  ]);
  return new ImageResponse(<DecisionStyleShareArtwork payload={payload} characterSrc={characterSrc} qrSrc={qrSrc} variant="portrait" />, {
    ...PORTRAIT_SIZE,
    headers: { "content-type": "image/png" },
  });
}
```

For `opengraph-image.tsx`, keep `params` as a Promise per Next 16, load only the character, render `variant="og"`, and export `size = OG_SIZE` and `contentType = "image/png"`.

- [ ] **Step 6: Update share copy and file names**

Change the Web share signature to require the real result code:

```ts
import type { DecisionStyleCode } from "@/domain/decisionStyle";

export async function shareDecisionStyleLink(
  url: string,
  code: DecisionStyleCode,
  {
    navigatorLike = globalThis.navigator,
    copyText,
  }: ShareDecisionStyleLinkOptions = {},
): Promise<"shared" | "copied"> {
  if (!isDecisionStyleNativeShareAvailable(navigatorLike)) {
    await copyDecisionStyleLink(url, { copyText });
    return "copied";
  }

await navigatorLike.share({
  title: "我的决策人格",
  text: `我是 ${code}。测测你的四字母决策人格，再看看我们哪里最不一样。`,
  url,
});
  return "shared";
}
```

Change the Web download filename to `decision-personality-card.png`. Update `DecisionStyleResult` to call `shareDecisionStyleLink(signed.url, summary.code)`. Update the client and result tests to expect the exact code argument and dynamic text.

Mobile image dialog title: `分享我的决策人格`. Mobile link fallback:

```ts
await Share.share({ message: `我是 ${summary.code}。你是什么？${signed.url}` });
```

The signing API currently returns `{ token, path }`, so do not cast it to `{ url, pngUrl }`. Add this pure parser:

```ts
export interface SignedStyleShare {
  token: string;
  url: string;
  pngUrl: string;
}

export function resolveSignedStyleShareResponse(
  value: unknown,
  baseUrl: string,
  code: string,
): SignedStyleShare | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.token !== "string" || typeof body.path !== "string") return null;
  if (body.path !== `/style/${code}/${body.token}`) return null;
  const url = new URL(body.path, baseUrl).toString();
  return { token: body.token, url, pngUrl: `${url}/card.png` };
}
```

Write `mobile/src/lib/__tests__/decisionStyleShareResponse.test.ts` first:

```ts
import { describe, expect, it } from "vitest";
import { resolveSignedStyleShareResponse } from "../decisionStyleShareResponse";

describe("resolveSignedStyleShareResponse", () => {
  it("builds trusted absolute result and PNG URLs", () => {
    expect(resolveSignedStyleShareResponse(
      { token: "signed", path: "/style/FDBG/signed" },
      "https://lifeplanner.test",
      "FDBG",
    )).toEqual({
      token: "signed",
      url: "https://lifeplanner.test/style/FDBG/signed",
      pngUrl: "https://lifeplanner.test/style/FDBG/signed/card.png",
    });
  });

  it("rejects malformed and code-mismatched paths", () => {
    expect(resolveSignedStyleShareResponse({ token: "signed", path: "/style/SDBG/signed" }, "https://lifeplanner.test", "FDBG")).toBeNull();
    expect(resolveSignedStyleShareResponse({ url: "https://evil.test" }, "https://lifeplanner.test", "FDBG")).toBeNull();
  });
});
```

In `requestSignedShare`, parse `await response.json()` with this helper and throw `share-token-failed` when it returns null.

- [ ] **Step 7: Verify and commit Task 6**

Run: `npx vitest run src/app/style/[code]/[token]/page.test.tsx src/lib/__tests__/decisionStyleShareClient.test.ts mobile/src/lib/__tests__/decisionStyleShareResponse.test.ts`

Run: `npx tsc --noEmit`

Run from `mobile`: `npx tsc --noEmit`

Run: `npm run build`

Expected: all exit 0; build produces dynamic portrait and OG routes without unsupported CSS errors.

```bash
git add package.json package-lock.json src/lib/decisionStyleShareAssets.server.ts src/components/decision-style/DecisionStyleShareArtwork.tsx src/app/style/[code]/[token]/card.png/route.ts src/app/style/[code]/[token]/opengraph-image.tsx src/app/style/[code]/[token]/page.test.tsx src/lib/decisionStyleShareClient.ts src/lib/__tests__/decisionStyleShareClient.test.ts src/components/decision-style/DecisionStyleResult.tsx src/components/decision-style/__tests__/DecisionStyleResult.test.tsx mobile/src/lib/decisionStyleShareResponse.ts mobile/src/lib/__tests__/decisionStyleShareResponse.test.ts mobile/src/lib/decisionStyleShare.ts
git commit -m "feat: redesign decision personality share artwork"
```

### Task 7: Redesign public results and deterministic friend comparison

**Files:**
- Create: `packages/core/src/decisionStyle/comparison.ts`
- Modify: `packages/core/src/decisionStyle/index.ts`
- Modify: `packages/core/src/__tests__/decisionStylePresentation.test.ts`
- Modify: `src/app/style/[code]/[token]/page.tsx`
- Modify: `src/app/style/[code]/[token]/page.test.tsx`
- Modify: `src/app/compare/[left]/[right]/page.tsx`
- Modify: `src/app/compare/[left]/[right]/page.test.tsx`
- Delete: `src/components/decision-style/DecisionStyleShareCard.tsx`

**Interfaces:**
- Consumes: two verified `DecisionStylePublicPayload` objects and Task 1 presentation.
- Produces: `decisionPersonalityRelationshipLine(leftCode, rightCode, axis)` and public pages that foreground characters, identity and one relation sentence.

- [ ] **Step 1: Write relationship-copy tests and verify RED**

```ts
import { decisionPersonalityRelationshipLine } from "../decisionStyle";

it("creates directional but non-judgmental friend comparison lines", () => {
  expect(decisionPersonalityRelationshipLine("FDBG", "SDBV", "tempo")).toBe("你负责踩油门，TA 负责确认前面有没有路。");
  expect(decisionPersonalityRelationshipLine("SDBV", "FDBG", "tempo")).toBe("TA 负责踩油门，你负责确认前面有没有路。");
  expect(decisionPersonalityRelationshipLine("FDBG", "FDBV", "focus")).toBe("你们都习惯把一件重要的事先做深。" );
});
```

Run: `npx vitest run packages/core/src/__tests__/decisionStylePresentation.test.ts`

Expected: FAIL because the relationship helper does not exist.

- [ ] **Step 2: Implement deterministic relationship copy**

```ts
import { AXIS_KEYS, type DecisionStyleAxis, type DecisionStyleCode } from "./axes";

const A_LETTERS = ["F", "D", "B", "G"] as const;

const DIFFERENT: Record<DecisionStyleAxis, readonly [string, string]> = {
  tempo: ["你负责踩油门，TA 负责确认前面有没有路。", "TA 负责踩油门，你负责确认前面有没有路。"],
  focus: ["你负责把一件事挖深，TA 负责确认还有哪些路。", "TA 负责把一件事挖深，你负责确认还有哪些路。"],
  engine: ["你习惯自己握方向盘，TA 更擅长借力把路走宽。", "TA 习惯自己握方向盘，你更擅长借力把路走宽。"],
  drive: ["你先确认结果站得住，TA 先确认这件事值得做。", "TA 先确认结果站得住，你先确认这件事值得做。"],
};

const SAME: Record<DecisionStyleAxis, readonly [string, string]> = {
  tempo: ["你们都不爱空想，聊完往往已经开始动了。", "你们都会多看一眼，决定通常不靠冲动。"],
  focus: ["你们都习惯把一件重要的事先做深。", "你们都能同时看见不止一条路。"],
  engine: ["你们都喜欢把关键方向握在自己手里。", "你们都很会借助现有结构把事情做大。"],
  drive: ["你们都会先确认结果能不能站得住。", "你们都会先确认这件事到底值不值得。"],
};

export function decisionPersonalityRelationshipLine(left: DecisionStyleCode, right: DecisionStyleCode, axis: DecisionStyleAxis): string {
  const index = AXIS_KEYS.indexOf(axis);
  const leftLetter = left[index];
  const rightLetter = right[index];
  if (leftLetter === rightLetter) return SAME[axis][leftLetter === A_LETTERS[index] ? 0 : 1];
  return DIFFERENT[axis][leftLetter === A_LETTERS[index] ? 0 : 1];
}
```

Export it from `index.ts`.

- [ ] **Step 3: Redesign the verified public result page**

Import `DecisionStyleCharacter` and `decisionPersonalityPresentationByCode`. Keep `DecisionStyleAnalyticsBeacon`, verified-token fallback and the signed invite token, then replace the old share-card embed with:

```tsx
const presentation = decisionPersonalityPresentationByCode(payload.code);
if (!presentation) return <SafeRetestEntry />;

return (
  <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "32px 16px 48px", background: "#f4eadf", color: "#251f1a" }}>
    <div style={{ width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", gap: 20, fontFamily: "sans-serif" }}>
      <DecisionStyleAnalyticsBeacon event="style_share_open" source="shared" />
      <section style={{ display: "flex", flexDirection: "column", borderRadius: 32, background: "#fffdf9", padding: 32, overflow: "hidden" }}>
        <div style={{ fontSize: 13, letterSpacing: 2, color: "#7b6c60" }}>TA 的决策人格</div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div style={{ display: "flex", flex: "1 1 360px", flexDirection: "column" }}>
            <h1 style={{ margin: "20px 0 0", fontSize: 72, lineHeight: 0.95, letterSpacing: -4 }}>{payload.code}</h1>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700 }}>{presentation.label}</div>
            <p style={{ margin: "24px 0 0", fontSize: 24, lineHeight: 1.5, fontWeight: 600 }}>{presentation.tagline}</p>
          </div>
          <DecisionStyleCharacter code={payload.code} size={320} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 20 }}>
          <div style={{ flex: "1 1 280px", borderRadius: 20, background: "#f4eadf", padding: 20 }}><strong>TA 的高光</strong><p style={{ lineHeight: 1.6 }}>{presentation.highlight}</p></div>
          <div style={{ flex: "1 1 280px", borderRadius: 20, background: "#2d2925", color: "#fffaf4", padding: 20 }}><strong>容易翻车</strong><p style={{ lineHeight: 1.6 }}>{presentation.roast}</p></div>
        </div>
        <p style={{ margin: "20px 0 0", color: "#695c52" }}>当前自报倾向，不是固定人格或心理诊断。公开结果不包含原始答案。</p>
      </section>
      <a href={`/test?invite=${encodeURIComponent(token)}`} style={{ display: "inline-flex", minHeight: 48, alignItems: "center", justifyContent: "center", alignSelf: "flex-start", borderRadius: 14, background: "#c2410c", color: "white", fontWeight: 700, padding: "0 24px", textDecoration: "none" }}>
        测测我是什么，和 TA 对比
      </a>
    </div>
  </main>
);
```

Do not show QR on the page itself. Delete `DecisionStyleShareCard.tsx` after removing this final import.

Update metadata to:

```ts
return {
  title: `${payload.code} · ${presentation?.label ?? "决策人格"} | Life Planner`,
  description: presentation?.tagline ?? "测测你的四字母决策人格。",
};
```

- [ ] **Step 4: Redesign the comparison page**

Keep existing closest/widest deterministic calculations. Import `DecisionStyleCharacter`, `decisionPersonalityPresentationByCode`, and `decisionPersonalityRelationshipLine`. Replace the existing first section with:

```tsx
<section style={{ display: "flex", flexDirection: "column", gap: 20, borderRadius: 28, background: "#fffdf9", padding: 28 }}>
  <div style={{ fontSize: 13, letterSpacing: 2, color: "#7b6c60" }}>朋友决策人格对照</div>
  <h1 style={{ margin: 0, fontSize: 36 }}>你们做决定，像两套不同的操作系统</h1>
  <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
    {([compare.left, compare.right] as const).map((payload, index) => {
      const item = decisionPersonalityPresentationByCode(payload.code)!;
      return (
        <article key={`${payload.code}-${index}`} style={{ display: "flex", flex: "1 1 300px", alignItems: "center", borderRadius: 22, background: "#f4eadf", padding: 18 }}>
          <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
            <div style={{ color: "#7b6c60", fontSize: 12 }}>{index === 0 ? "你" : "TA"}</div>
            <div style={{ marginTop: 6, fontSize: 34, fontWeight: 900 }}>{payload.code}</div>
            <div style={{ marginTop: 4, fontWeight: 700 }}>{item.label}</div>
          </div>
          <DecisionStyleCharacter code={payload.code} size={150} />
        </article>
      );
    })}
  </div>
  <p style={{ margin: 0, borderRadius: 20, background: "#2d2925", color: "#fffaf4", padding: 22, fontSize: 22, lineHeight: 1.5 }}>
    {decisionPersonalityRelationshipLine(compare.left.code, compare.right.code, furthest)}
  </p>
</section>
```

Below it retain closest axis and largest-difference axis details. Remove debug-like sentences such as “按固定轴顺序稳定判定” from user-visible copy; keep tie-order behavior in tests.

- [ ] **Step 5: Update page tests and verify GREEN**

Public page assertions must include code, label, tagline, “测完和 TA 比”, and exclude local evidence. Compare tests must include both codes, both labels, the exact relationship line, closest/difference labels, and still exclude compatibility scores and forbidden claims.

Run: `npx vitest run packages/core/src/__tests__/decisionStylePresentation.test.ts src/app/style/[code]/[token]/page.test.tsx src/app/compare/[left]/[right]/page.test.tsx`

Run: `npx tsc --noEmit`

Expected: all pass.

- [ ] **Step 6: Commit Task 7**

```bash
git add packages/core/src/decisionStyle/comparison.ts packages/core/src/decisionStyle/index.ts packages/core/src/__tests__/decisionStylePresentation.test.ts src/app/style/[code]/[token]/page.tsx src/app/style/[code]/[token]/page.test.tsx src/app/compare/[left]/[right]/page.tsx src/app/compare/[left]/[right]/page.test.tsx src/components/decision-style/DecisionStyleShareCard.tsx
git commit -m "feat: add social decision personality comparison"
```

### Task 8: Full verification, visual QA, and iOS OTA

**Files:**
- Modify only files required by failures found in this task.
- Do not fold unrelated existing worktree changes into fixes or commits.

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces: verified Web production build, verified mobile TypeScript/Expo configuration, visual evidence, and iOS production OTA for runtime `1.1.0`.

- [ ] **Step 1: Run focused decision-personality tests**

Run:

```bash
npx vitest run packages/core/src/__tests__/decisionStyle.test.ts packages/core/src/__tests__/decisionStylePresentation.test.ts packages/core/src/__tests__/decisionStyleShareToken.test.ts src/lib/__tests__/decisionStyleCharacterAssets.test.ts src/components/decision-style/__tests__/DecisionStyleTest.test.tsx src/components/decision-style/__tests__/DecisionStyleResult.test.tsx src/lib/__tests__/decisionStyleShareClient.test.ts src/app/style/[code]/[token]/page.test.tsx src/app/compare/[left]/[right]/page.test.tsx
```

Expected: 0 failed tests.

- [ ] **Step 2: Run the complete Web gate**

Run separately and require exit 0 from every command:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

- [ ] **Step 3: Run the mobile gate**

From `mobile`:

```bash
npx tsc --noEmit
npx expo-doctor
```

Expected: TypeScript exits 0. Expo Doctor has no decision-personality, Metro symlink, or duplicate React warning; document any unrelated pre-existing SDK patch warning rather than hiding it.

- [ ] **Step 4: Perform browser visual QA at exact sizes**

Use the project `restart-dev` skill, then the Playwright/browser verification skill. Capture and inspect:

- `/test` at 390×844 and 1440×1000: intro, question 1, selected state, question 2,加赛题, result collapsed, result expanded.
- One valid `/style/FDBG/{token}` public page at 390×844 and desktop.
- One valid `/compare/{left}/{right}` page at 390×844 and desktop.
- `/style/FDBG/{token}/card.png`: verify 1080×1350, readable QR quiet zone, no text clipping.
- OG endpoint: verify 1200×630, no portrait crop, no unsupported Satori layout.

Reject the build if any code/name/tagline is clipped, character overlaps required copy, five dots are under 44px, or internal axis keys appear.

- [ ] **Step 5: Verify native behavior on the available TestFlight device**

Manual checklist:

```text
[ ] All five dots accept taps across their full 48pt targets
[ ] A single tap advances exactly one question after visible feedback
[ ] Two rapid taps cannot skip a question or replace the first selection
[ ] Back returns to the previous selected value
[ ] Last question reaches add-on tie question or result without a Next button
[ ] Result shows code, Chinese label, character, tagline, highlight, roast and advice
[ ] Me screen compact card never prints tempo/focus/engine/drive
[ ] Dynamic Type Large does not clip the code or CTA
[ ] VoiceOver reads both endpoint statements and every scale choice
[ ] Reduce Motion skips the reveal transition
[ ] Shared portrait PNG is readable and QR opens the signed result page
[ ] Offline/PNG failure falls back to the signed text link
```

- [ ] **Step 6: Resolve verification failures at their owning task**

Run `git diff --check` and `git status --short`. If verification exposed a defect, return to the task that owns the affected file, add a focused failing regression test, make the smallest fix, rerun that task's exact verification commands, and amend that task before continuing. If no defect exists, create no extra commit.

- [ ] **Step 7: Gate OTA on the deployed Web share service**

The App downloads its PNG from `https://life-planer-opal.vercel.app`, so the Web production deployment must contain Task 6 before OTA. After the existing Vercel production workflow deploys the feature commits, run:

```powershell
$origin = 'https://life-planer-opal.vercel.app'
$payload = @{ version = 2; source = 'quick'; code = 'FDBG'; scores = @{ tempo = 76; focus = 61; engine = 58; drive = 84 } } | ConvertTo-Json -Depth 4
$share = Invoke-RestMethod -Method Post -Uri "$origin/api/style-share-token" -ContentType 'application/json' -Body $payload
$env:CARD_URL = "$origin$($share.path)/card.png"
node -e "fetch(process.env.CARD_URL).then(async r => { if (!r.ok) throw new Error(String(r.status)); const b = Buffer.from(await r.arrayBuffer()); const w = b.readUInt32BE(16); const h = b.readUInt32BE(20); console.log(JSON.stringify({w,h,type:r.headers.get('content-type')})); if (w !== 1080 || h !== 1350) process.exit(1); })"
```

Expected: `{"w":1080,"h":1350,"type":"image/png"}` and exit 0. If the route still returns 1200×630 or any non-200 response, stop; do not publish the OTA against the old server.

- [ ] **Step 8: Publish the iOS production OTA**

Confirm `mobile/app.json` still reports app/runtime version `1.1.0` and no native dependency or plugin changed after the last TestFlight binary. Then run from `mobile`:

```powershell
$env:CI='1'
npx eas-cli update --channel production --environment production --platform ios --message "Redesign decision personality test and share cards"
```

Expected: exit 0 with branch `production`, runtime `1.1.0`, platform `ios`, and a new Update Group ID. Record the EAS dashboard URL in the handoff.

- [ ] **Step 9: Final repository audit**

Run:

```bash
git log -10 --oneline
git status --short
git diff --check
```

Expected: all feature commits are visible; unrelated pre-existing worktree changes remain untouched; no whitespace errors exist in feature files.
