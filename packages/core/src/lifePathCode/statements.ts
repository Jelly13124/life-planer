import type { Axis, Letter } from "./axes";

export interface QuizStatement {
  id: string;
  axis: Axis;
  text: string;
  pole: Letter; // 同意（符合）时偏向的极
}

// 28 条，每轴 7 条，混合 keying（同一轴里既有 A 极也有 B 极的陈述），降低"一律同意"偏差。
export const STATEMENTS: QuizStatement[] = [
  { id: "t1", axis: "tempo", pole: "F", text: "看到一个不稳但可能爆发的机会，我会忍不住想冲进去。" },
  { id: "t2", axis: "tempo", pole: "S", text: "重大职业决定前，我一定要把风险想清楚才敢动。" },
  { id: "t3", axis: "tempo", pole: "F", text: "与其稳稳当当，我更怕错过一个大机会。" },
  { id: "t4", axis: "tempo", pole: "S", text: "稳定、可预期的工作让我更安心。" },
  { id: "t5", axis: "tempo", pole: "F", text: "我做事常常先干起来，边做边调整。" },
  { id: "t6", axis: "tempo", pole: "S", text: "没准备好之前，我不会轻易出手。" },
  { id: "t7", axis: "tempo", pole: "F", text: "为了更大的回报，我愿意承担别人觉得太冒险的选择。" },

  { id: "f1", axis: "focus", pole: "D", text: "我愿意十年磨一剑，把一件事做到顶尖。" },
  { id: "f2", axis: "focus", pole: "W", text: "我喜欢同时涉猎很多领域，什么都想试试。" },
  { id: "f3", axis: "focus", pole: "D", text: "成为某个领域的专家，比「什么都会一点」更吸引我。" },
  { id: "f4", axis: "focus", pole: "W", text: "只押一个方向会让我不安，我更想多线下注。" },
  { id: "f5", axis: "focus", pole: "D", text: "我做事喜欢往深里钻，而不是浅尝辄止。" },
  { id: "f6", axis: "focus", pole: "W", text: "跨界、什么都拿得起的人最让我欣赏。" },
  { id: "f7", axis: "focus", pole: "D", text: "把一项技能练到极致，是我的成就感来源。" },

  { id: "e1", axis: "engine", pole: "B", text: "理想状态是自己从零搭一个东西。" },
  { id: "e2", axis: "engine", pole: "L", text: "进一个好平台、借它的势往上走，更聪明。" },
  { id: "e3", axis: "engine", pole: "B", text: "我更愿意靠自己定义规则，而不是适应别人的规则。" },
  { id: "e4", axis: "engine", pole: "L", text: "背后有靠谱的组织/平台，我才更踏实。" },
  { id: "e5", axis: "engine", pole: "B", text: "手里有自己的盘子，比拿高薪更让我安心。" },
  { id: "e6", axis: "engine", pole: "L", text: "站在巨人肩上，比单打独斗走得更快。" },
  { id: "e7", axis: "engine", pole: "B", text: "哪怕更难，我也想做自己说了算的事。" },

  { id: "d1", axis: "drive", pole: "G", text: "选工作我首先看回报和保障。" },
  { id: "d2", axis: "drive", pole: "V", text: "一份工作有没有意义，比赚多少更重要。" },
  { id: "d3", axis: "drive", pole: "G", text: "我最怕的是晚景不安稳、没有保障。" },
  { id: "d4", axis: "drive", pole: "V", text: "我最怕的是一辈子没做成一件有意义的事。" },
  { id: "d5", axis: "drive", pole: "G", text: "钱和安全感是我职业的底线。" },
  { id: "d6", axis: "drive", pole: "V", text: "能不能实现自我，是我职业的底线。" },
  { id: "d7", axis: "drive", pole: "G", text: "只要够稳够安全，平淡一点我也能接受。" },
];
