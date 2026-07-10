import type { DecisionStyleAxis, DecisionStylePole } from "./axes";

export type DecisionStyleAnswerValue = -2 | -1 | 0 | 1 | 2;
export type DecisionStyleSource = "quick" | "full";

export interface DecisionStyleQuestion {
  id: string;
  axis: DecisionStyleAxis;
  prompt: string;
  left: { pole: DecisionStylePole; label: string };
  right: { pole: DecisionStylePole; label: string };
  quick: boolean;
}

const question = (
  id: string, axis: DecisionStyleAxis, prompt: string,
  left: { pole: DecisionStylePole; label: string }, right: { pole: DecisionStylePole; label: string }, quick: boolean,
): DecisionStyleQuestion => ({ id, axis, prompt, left, right, quick });

export const FULL_QUESTIONS: DecisionStyleQuestion[] = [
  question("tempo-1", "tempo", "回想最近一次信息还不完整的职业机会，你通常会：", { pole: "a", label: "先做一个小范围尝试，再根据反馈调整" }, { pole: "b", label: "先补齐关键事实，再决定是否行动" }, true),
  question("tempo-2", "tempo", "最近需要推进一个陌生任务时，你更常见的起步方式是：", { pole: "b", label: "先列出要验证的问题和判断标准" }, { pole: "a", label: "先完成可执行的第一步，再暴露问题" }, true),
  question("tempo-3", "tempo", "面对一个有时效的合作邀约，你近几次更倾向于：", { pole: "a", label: "先约一次沟通或试合作，边做边判断" }, { pole: "b", label: "先确认边界、资源和风险，再回复" }, true),
  question("tempo-4", "tempo", "当你对新方向只有初步认识时，通常会：", { pole: "b", label: "先比较几种路径的证据和条件" }, { pole: "a", label: "先投入有限时间做一次实际体验" }, false),
  question("tempo-5", "tempo", "最近一次计划被临时变化打乱后，你更可能：", { pole: "a", label: "先换一个可行方案继续推进" }, { pole: "b", label: "先重新核对变化会带来的影响" }, false),
  question("tempo-6", "tempo", "为职业选择收集信息时，你更常：", { pole: "b", label: "先设定需要确认的依据，再开始搜集" }, { pole: "a", label: "先接触人和场景，再整理需要补的资料" }, false),
  question("tempo-7", "tempo", "遇到结果不确定但成本可控的机会时，你通常：", { pole: "a", label: "愿意先试一次，把结果当作新信息" }, { pole: "b", label: "倾向等到判断更清楚后再投入" }, false),

  question("focus-1", "focus", "回看最近三个月的业余投入，你更接近：", { pole: "a", label: "持续把大部分时间放在一个核心方向" }, { pole: "b", label: "同时保留几条值得探索的方向" }, true),
  question("focus-2", "focus", "当出现与主线不同的新机会时，你通常会：", { pole: "b", label: "留出窗口试探它是否能形成新路径" }, { pole: "a", label: "优先判断它能否加深当前主线" }, true),
  question("focus-3", "focus", "最近安排学习或作品积累时，你更常选择：", { pole: "a", label: "围绕一个主题连续积累" }, { pole: "b", label: "按不同主题轮换，保持多种连接" }, true),
  question("focus-4", "focus", "当你可投入的资源有限时，你更愿意：", { pole: "b", label: "分配一部分给新可能，避免只押一处" }, { pole: "a", label: "集中投入，争取把一个方向做扎实" }, false),
  question("focus-5", "focus", "朋友问你近来的职业重心，你更容易描述为：", { pole: "a", label: "正在沿一条清晰主线持续推进" }, { pole: "b", label: "在几种相互补充的尝试之间调整" }, false),
  question("focus-6", "focus", "面对新的技能需求时，你通常：", { pole: "b", label: "选择能打开不同可能性的组合来学" }, { pole: "a", label: "优先补强和现有方向最相关的一项" }, false),
  question("focus-7", "focus", "近几次做周计划时，你更常：", { pole: "a", label: "让多数任务服务于同一个长期目标" }, { pole: "b", label: "为不同目标各保留稳定的推进空间" }, false),

  question("engine-1", "engine", "最近需要把想法落地时，你更倾向于：", { pole: "a", label: "自己决定节奏和规则，再补齐所需资源" }, { pole: "b", label: "先接入已有团队、流程或网络" }, true),
  question("engine-2", "engine", "面对一个复杂项目，你更常：", { pole: "b", label: "利用已有分工和资源把事情推进" }, { pole: "a", label: "先搭建自己可控的做法和节奏" }, true),
  question("engine-3", "engine", "最近争取支持时，你更看重：", { pole: "a", label: "保留关键决策权和调整空间" }, { pole: "b", label: "获得成熟机制带来的协同和支持" }, true),
  question("engine-4", "engine", "当现成规则不完全适合时，你通常：", { pole: "b", label: "先理解规则内可以调用的资源" }, { pole: "a", label: "先设计一套自己能负责的替代办法" }, false),
  question("engine-5", "engine", "回顾最近一次合作分工，你更满意的是：", { pole: "a", label: "关键选择由自己持续掌握" }, { pole: "b", label: "各方各用所长，借力完成更大目标" }, false),
  question("engine-6", "engine", "开始一个新尝试时，你更可能：", { pole: "b", label: "先找合适的组织、社群或伙伴连接" }, { pole: "a", label: "先做出最小可控版本再向外扩展" }, false),
  question("engine-7", "engine", "需要长期推进一件事时，你更依赖：", { pole: "a", label: "自己设定边界、方法和优先级" }, { pole: "b", label: "成熟的平台能力和协作关系" }, false),

  question("drive-1", "drive", "最近一次职业取舍里，你优先保护的是：", { pole: "a", label: "回报、稳定性和可持续的保障" }, { pole: "b", label: "投入感、价值认同和想做成的事" }, true),
  question("drive-2", "drive", "两种选择都能胜任时，你更常被哪一面推动：", { pole: "b", label: "它是否让我觉得这件事值得长期投入" }, { pole: "a", label: "它是否让生活安排更有保障" }, true),
  question("drive-3", "drive", "回看最近一次拒绝机会的原因，更接近：", { pole: "a", label: "回报或稳定条件不够匹配" }, { pole: "b", label: "工作内容与自己在意的方向不够一致" }, true),
  question("drive-4", "drive", "需要为一个选择承担代价时，你更愿意为：", { pole: "b", label: "保住对重要事情的投入和表达" }, { pole: "a", label: "保住基本保障和可预期的回报" }, false),
  question("drive-5", "drive", "最近规划下一步时，你更常先问：", { pole: "a", label: "它能否支持我想维持的生活和责任" }, { pole: "b", label: "它是否靠近我真正想解决的问题" }, false),
  question("drive-6", "drive", "当一项工作有意义但条件一般时，你通常：", { pole: "b", label: "会认真评估是否值得为意义调整安排" }, { pole: "a", label: "会优先确认保障条件是否能够承受" }, false),
  question("drive-7", "drive", "回顾近几次重要决定，你更希望结果带来：", { pole: "a", label: "更稳妥的回报和安全余量" }, { pole: "b", label: "更强的认同感和实现感" }, false),
];

export const QUICK_QUESTIONS = FULL_QUESTIONS.filter((item) => item.quick);

export const TIE_BREAKERS: DecisionStyleQuestion[] = [
  question("tempo-tie", "tempo", "信息还不完整、成本也可控时，你这次更愿意：", { pole: "a", label: "先试一次再调整" }, { pole: "b", label: "先验证再行动" }, false),
  question("focus-tie", "focus", "接下来一个月，你更愿意把额外时间放在：", { pole: "a", label: "一个主线的深入推进" }, { pole: "b", label: "几条方向的并行探索" }, false),
  question("engine-tie", "engine", "需要启动新计划时，你这次更想优先：", { pole: "a", label: "自己掌控关键安排" }, { pole: "b", label: "借助已有平台和协作" }, false),
  question("drive-tie", "drive", "两种选择难分高下时，你这次更优先：", { pole: "a", label: "保障回报和稳定" }, { pole: "b", label: "实现意义和认同" }, false),
];
