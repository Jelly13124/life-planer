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
