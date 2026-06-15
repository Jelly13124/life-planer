import {
  LIFE_AREAS,
  type CurveShape,
  type LifeArea,
  type LifePath,
  type MetricPoint,
  type Mood,
  type PathNode,
} from "../types";
import { classifyChoice, getArchetype, type Archetype } from "../archetypes";
import { hashSeed, makeRng, rngPick } from "../seed";
import type { GenerateInput, PathGenerator } from "./types";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

const SPREAD = 50; // bias=1 时长期约 +50 的变化

// 单领域的去噪目标值（用于稳定的 endValue 计算）
function areaTarget(start: number, bias: number): number {
  return clamp(start + bias * SPREAD);
}

function fillTemplate(s: string, name: string, age: number): string {
  return s.replaceAll("{name}", name).replaceAll("{age}", String(age));
}

// 沿曲线形状的归一化"高度"(0..1)，让节点心情随路径自然起伏（早段/晚段不同）。
function shapeValue(curve: CurveShape, frac: number): number {
  switch (curve) {
    case "rise-steep":
      return Math.pow(frac, 1.7); // 先平后陡升
    case "rise-gentle":
      return frac;
    case "decline":
      return 1 - frac;
    case "flat":
      return 0.5;
    case "dip-rise":
      return frac < 0.45 ? 0.4 - (frac / 0.45) * 0.3 : 0.1 + ((frac - 0.45) / 0.55) * 0.9;
  }
}

function moodFromShape(v: number): Mood {
  if (v >= 0.66) return "high";
  if (v >= 0.38) return "mid";
  return "low";
}

// 为单个领域生成随年龄变化的轨迹：从起点漂移到目标，叠加确定性噪声。
function buildAreaSeries(
  start: number,
  bias: number,
  volatility: number,
  startAge: number,
  horizon: number,
  rng: () => number,
): MetricPoint[] {
  const target = areaTarget(start, bias);
  const points: MetricPoint[] = [];
  for (let y = 0; y <= horizon; y++) {
    const frac = y / horizon;
    // 缓动（先快后慢），让轨迹自然
    const eased = frac * (2 - frac);
    const drift = start + (target - start) * eased;
    const noise = (rng() - 0.5) * volatility * 18;
    points.push({ age: startAge + y, value: Math.round(clamp(drift + noise)) });
  }
  return points;
}

// 在 [startAge+1, startAge+horizon] 内取 3-4 个递增的节点年龄。
function pickNodeAges(
  startAge: number,
  horizon: number,
  rng: () => number,
): number[] {
  const count = 3 + Math.floor(rng() * 2); // 3..4
  const ages: number[] = [];
  for (let i = 0; i < count; i++) {
    const base = (i + 1) / (count + 1);
    const jitter = (rng() - 0.5) * (0.6 / (count + 1));
    let age = Math.round(startAge + clamp(base + jitter, 0.05, 0.95) * horizon);
    if (ages.length && age <= ages[ages.length - 1]) age = ages[ages.length - 1] + 1;
    ages.push(Math.min(age, startAge + horizon));
  }
  // 去重并保持递增
  return ages.filter((a, i) => i === 0 || a > ages[i - 1]);
}

export class LocalPathGenerator implements PathGenerator {
  generate(input: GenerateInput): LifePath {
    const { profile, kind, horizonYears, index } = input;
    const archetype: Archetype =
      kind === "status-quo" ? getArchetype("statusQuo") : classifyChoice(input.choiceLabel);

    const choiceLabel =
      kind === "status-quo" ? "维持现状" : input.choiceLabel.trim() || "一个新的选择";

    const seed = hashSeed(`${profile.name}|${choiceLabel}|${kind}|${index}`);
    const rng = makeRng(seed);
    const startAge = profile.age;

    // 各领域轨迹 + 去噪目标（目标用于稳定的 endValue，不受随机噪声影响）
    const metrics = {} as Record<LifeArea, MetricPoint[]>;
    let targetSum = 0;
    for (const area of LIFE_AREAS) {
      const start = clamp(profile.areas[area] ?? 50);
      targetSum += areaTarget(start, archetype.areaBias[area]);
      metrics[area] = buildAreaSeries(
        start,
        archetype.areaBias[area],
        archetype.volatility,
        startAge,
        horizonYears,
        rng,
      );
    }

    const endValue = Math.round(targetSum / LIFE_AREAS.length);

    // 节点：心情随曲线形状起伏（维持现状则按序轮换），减少同质重复
    const nodeAges = pickNodeAges(startAge, horizonYears, rng);
    const flatCycle: Mood[] = ["mid", "high", "mid", "low"];
    const usedTitles = new Set<string>();
    const nodes: PathNode[] = nodeAges.map((age, i) => {
      const frac = horizonYears > 0 ? (age - startAge) / horizonYears : 0.5;
      const mood: Mood =
        archetype.curve === "flat"
          ? flatCycle[i % flatCycle.length]
          : moodFromShape(shapeValue(archetype.curve, frac));
      const pool = archetype.nodes[mood];
      // 不重复标题：随机起手，若撞车则确定性地取第一个未用过的
      let tpl = rngPick(rng, pool);
      if (usedTitles.has(tpl.title)) {
        const unused = pool.find((t) => !usedTitles.has(t.title));
        if (unused) tpl = unused;
      }
      usedTitles.add(tpl.title);
      return {
        age,
        title: fillTemplate(tpl.title, profile.name, age),
        story: fillTemplate(tpl.story, profile.name, age),
        mood,
      };
    });

    const summary = fillTemplate(rngPick(rng, archetype.summaries), profile.name, startAge);

    return {
      id: `${kind}-${index}-${archetype.key}`,
      choiceLabel,
      kind,
      summary,
      color: archetype.color,
      curve: archetype.curve,
      endValue,
      nodes,
      metrics,
    };
  }
}

export const localGenerator = new LocalPathGenerator();
