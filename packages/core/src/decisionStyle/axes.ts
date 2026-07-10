export type DecisionStyleAxis = "tempo" | "focus" | "engine" | "drive";
export type DecisionStylePole = "a" | "b";
export type DecisionStyleLetter = "F" | "S" | "D" | "W" | "B" | "L" | "G" | "V";
export type DecisionStyleCode = `${"F" | "S"}${"D" | "W"}${"B" | "L"}${"G" | "V"}`;

export interface DecisionStyleAxisDefinition {
  key: DecisionStyleAxis;
  a: { letter: DecisionStyleLetter; label: string };
  b: { letter: DecisionStyleLetter; label: string };
}

export const AXIS_KEYS: DecisionStyleAxis[] = ["tempo", "focus", "engine", "drive"];

export const AXES: DecisionStyleAxisDefinition[] = [
  { key: "tempo", a: { letter: "F", label: "先试再调" }, b: { letter: "S", label: "先验证再动" } },
  { key: "focus", a: { letter: "D", label: "集中深耕" }, b: { letter: "W", label: "多线探索" } },
  { key: "engine", a: { letter: "B", label: "自主掌控" }, b: { letter: "L", label: "平台借势" } },
  { key: "drive", a: { letter: "G", label: "保障回报" }, b: { letter: "V", label: "意义实现" } },
];

export function letterFor(axis: DecisionStyleAxis, pole: DecisionStylePole): DecisionStyleLetter {
  const definition = AXES.find((item) => item.key === axis)!;
  return definition[pole].letter;
}
