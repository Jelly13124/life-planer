import {
  LIFE_AREAS,
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

function fillTemplate(s: string, name: string, age: number): string {
  return s.replaceAll("{name}", name).replaceAll("{age}", String(age));
}

function moodFor(composite: number): Mood {
  if (composite >= 62) return "high";
  if (composite >= 42) return "mid";
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
  const spread = 42; // bias=1 时大约 +42 的长期变化
  const target = clamp(start + bias * spread);
  const points: MetricPoint[] = [];
  for (let y = 0; y <= horizon; y++) {
    const frac = y / horizon;
    // 缓动（先快后慢），让轨迹自然
    const eased = frac * (2 - frac);
    const drift = start + (target - start) * eased;
    const noise = (rng() - 0.5) * volatility * 22;
    points.push({ age: startAge + y, value: Math.round(clamp(drift + noise)) });
  }
  return points;
}

function compositeAt(metrics: Record<LifeArea, MetricPoint[]>, age: number): number {
  let sum = 0;
  for (const area of LIFE_AREAS) {
    const series = metrics[area];
    const pt = series.find((p) => p.age === age) ?? series[series.length - 1];
    sum += pt.value;
  }
  return Math.round(sum / LIFE_AREAS.length);
}

// 在 [startAge+1, startAge+horizon] 内取 3-5 个递增的节点年龄。
function pickNodeAges(
  startAge: number,
  horizon: number,
  rng: () => number,
): number[] {
  const count = 3 + Math.floor(rng() * 3); // 3..5
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

    // 各领域轨迹
    const metrics = {} as Record<LifeArea, MetricPoint[]>;
    for (const area of LIFE_AREAS) {
      const start = clamp(profile.areas[area] ?? 50);
      metrics[area] = buildAreaSeries(
        start,
        archetype.areaBias[area],
        archetype.volatility,
        startAge,
        horizonYears,
        rng,
      );
    }

    const endValue = compositeAt(metrics, startAge + horizonYears);

    // 节点
    const nodeAges = pickNodeAges(startAge, horizonYears, rng);
    const usedTitles = new Set<string>();
    const nodes: PathNode[] = nodeAges.map((age) => {
      const mood = moodFor(compositeAt(metrics, age));
      const pool = archetype.nodes[mood];
      // 尽量不重复标题
      let tpl = rngPick(rng, pool);
      for (let tries = 0; tries < pool.length && usedTitles.has(tpl.title); tries++) {
        tpl = rngPick(rng, pool);
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
