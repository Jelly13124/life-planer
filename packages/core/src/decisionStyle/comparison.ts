import { AXIS_KEYS, type DecisionStyleAxis, type DecisionStyleCode } from "./axes";

const A_LETTERS = ["F", "D", "B", "G"] as const;

const DIFFERENT: Record<DecisionStyleAxis, readonly [string, string]> = {
  tempo: [
    "你负责踩油门，TA 负责确认前面有没有路。",
    "TA 负责踩油门，你负责确认前面有没有路。",
  ],
  focus: [
    "你负责把一件事挖深，TA 负责确认还有哪些路。",
    "TA 负责把一件事挖深，你负责确认还有哪些路。",
  ],
  engine: [
    "你习惯自己握方向盘，TA 更擅长借力把路走宽。",
    "TA 习惯自己握方向盘，你更擅长借力把路走宽。",
  ],
  drive: [
    "你先确认结果站得住，TA 先确认这件事值得做。",
    "TA 先确认结果站得住，你先确认这件事值得做。",
  ],
};

const SAME: Record<DecisionStyleAxis, readonly [string, string]> = {
  tempo: [
    "你们都不爱空想，聊完往往已经开始动了。",
    "你们都会多看一眼，决定通常不靠冲动。",
  ],
  focus: [
    "你们都习惯把一件重要的事先做深。",
    "你们都能同时看见不止一条路。",
  ],
  engine: [
    "你们都喜欢把关键方向握在自己手里。",
    "你们都很会借助现有结构把事情做大。",
  ],
  drive: [
    "你们都会先确认结果能不能站得住。",
    "你们都会先确认这件事到底值不值得。",
  ],
};

export function decisionPersonalityRelationshipLine(
  left: DecisionStyleCode,
  right: DecisionStyleCode,
  axis: DecisionStyleAxis,
): string {
  const index = AXIS_KEYS.indexOf(axis);
  const leftLetter = left[index];
  const rightLetter = right[index];
  if (leftLetter === rightLetter) {
    return SAME[axis][leftLetter === A_LETTERS[index] ? 0 : 1];
  }
  return DIFFERENT[axis][leftLetter === A_LETTERS[index] ? 0 : 1];
}
