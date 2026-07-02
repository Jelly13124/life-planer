import { AREA_LABELS, LIFE_AREAS, type LifeArea, type LifePath } from "./types";

export interface PathGoalDraft {
  area: LifeArea;
  title: string;
  why: string;
}

// 从一条路确定性派生 N 个「打基础」目标：按各领域指标净增（末-首）降序取前 N。
// 纯、无随机、无 Date —— AI 拆解失败/离线时的兜底。
export function localPathGoals(path: LifePath, count = 3): PathGoalDraft[] {
  const ranked = LIFE_AREAS.map((area) => {
    const s = path.metrics[area] ?? [];
    const first = s[0]?.value ?? 50;
    const last = s[s.length - 1]?.value ?? first;
    return { area, gain: last - first };
  }).sort((a, b) => b.gain - a.gain);

  const n = Math.max(1, Math.min(count, ranked.length));
  return ranked.slice(0, n).map(({ area }) => ({
    area,
    title: `${path.choiceLabel}·${AREA_LABELS[area]}打基础`,
    why: `为「${path.choiceLabel}」在${AREA_LABELS[area]}上先攒下底子。`,
  }));
}
