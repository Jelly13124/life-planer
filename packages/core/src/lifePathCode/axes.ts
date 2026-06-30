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
