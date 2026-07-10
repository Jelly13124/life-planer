export type DecisionStyleAxis = "tempo" | "focus" | "engine" | "drive";
export type DecisionStylePole = "a" | "b";
export type DecisionStyleLetter = "F" | "S" | "D" | "W" | "B" | "L" | "G" | "V";
export type DecisionStyleCode = `${"F" | "S"}${"D" | "W"}${"B" | "L"}${"G" | "V"}`;

export interface DecisionStyleAxisDefinition {
  readonly key: DecisionStyleAxis;
  readonly a: { readonly letter: DecisionStyleLetter; readonly label: string };
  readonly b: { readonly letter: DecisionStyleLetter; readonly label: string };
}

export const AXIS_KEYS: readonly DecisionStyleAxis[] = Object.freeze(["tempo", "focus", "engine", "drive"]);

const axis = (key: DecisionStyleAxis, a: DecisionStyleAxisDefinition["a"], b: DecisionStyleAxisDefinition["b"]): DecisionStyleAxisDefinition => Object.freeze({
  key,
  a: Object.freeze(a),
  b: Object.freeze(b),
});

export const AXES: readonly DecisionStyleAxisDefinition[] = Object.freeze([
  axis("tempo", { letter: "F", label: "先试再调" }, { letter: "S", label: "先验证再动" }),
  axis("focus", { letter: "D", label: "集中深耕" }, { letter: "W", label: "多线探索" }),
  axis("engine", { letter: "B", label: "自主掌控" }, { letter: "L", label: "平台借势" }),
  axis("drive", { letter: "G", label: "保障回报" }, { letter: "V", label: "意义实现" }),
]);

export function letterFor(axis: DecisionStyleAxis, pole: DecisionStylePole): DecisionStyleLetter {
  const definition = AXES.find((item) => item.key === axis)!;
  return definition[pole].letter;
}
