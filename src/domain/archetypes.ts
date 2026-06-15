import type { CurveShape, LifeArea, Mood } from "./types";

export interface NodeTemplate {
  title: string;
  story: string; // 支持 {name} {age} 占位符
}

export interface Archetype {
  key: string;
  label: string;
  keywords: string[];
  curve: CurveShape;
  color: string; // 曲线颜色
  areaBias: Record<LifeArea, number>; // 各领域长期影响，-1..1
  volatility: number; // 波动强度 0..1
  summaries: string[]; // 一句话结局候选
  nodes: Record<Mood, NodeTemplate[]>; // 按心情分组的节点模板（每组 ≥3）
}

const T = (title: string, story: string): NodeTemplate => ({ title, story });

export const ARCHETYPES: Archetype[] = [
  {
    key: "startup",
    label: "创业",
    keywords: ["创业", "辞职", "自己干", "开公司", "做产品", "startup", "当老板"],
    curve: "dip-rise",
    color: "#fb7185",
    areaBias: { career: 0.8, wealth: 0.6, relationships: -0.2, health: -0.4, growth: 0.7 },
    volatility: 0.9,
    summaries: [
      "自己当老板，高风险高回报",
      "公司活下来了，{name} 成了真正的创始人",
      "几番起伏后，{name} 找到了自己的事业",
    ],
    nodes: {
      high: [
        T("拿到第一笔投资", "{age} 岁，{name} 的项目拿到了第一笔钱。那天晚上没睡着，不是因为焦虑，是因为兴奋。"),
        T("团队扩到十个人", "{name} 第一次以“老板”的身份给大家发年终奖，手有点抖。"),
        T("产品被市场认可", "{age} 岁，越来越多人开始用 {name} 做的东西，口碑慢慢起来了。"),
      ],
      mid: [
        T("辞掉稳定工作", "{age} 岁，{name} 交了辞职信。同事都说可惜，但 {name} 知道这是自己的选择。"),
        T("第一个客户", "产品上线大半年，终于有人愿意付钱。钱不多，但 {name} 把那张截图存了很久。"),
        T("找到合伙人", "{age} 岁，{name} 遇到了愿意一起冒险的人，孤独的创业有了同伴。"),
      ],
      low: [
        T("最难的一个月", "{age} 岁那年，账上的钱只够再撑两个月。{name} 学会了在崩溃和坚持之间走钢丝。"),
        T("第一次裁员", "不得不让一起打拼的人离开。{name} 那天才真正懂了“创始人”三个字的重量。"),
        T("产品没人买单", "{age} 岁，做了大半年的东西没什么人用，{name} 开始怀疑方向错了。"),
      ],
    },
  },
  {
    key: "jobhop",
    label: "跳槽",
    keywords: ["跳槽", "换工作", "换公司", "新东家", "offer", "升职", "大厂", "外企"],
    curve: "rise-gentle",
    color: "#a78bfa",
    areaBias: { career: 0.7, wealth: 0.6, relationships: 0.1, health: 0.0, growth: 0.4 },
    volatility: 0.4,
    summaries: [
      "技术骨干，薪资稳步翻倍",
      "{name} 在新平台上一路做到了管理岗",
      "换了赛道，反而走得更顺",
    ],
    nodes: {
      high: [
        T("升任团队负责人", "{age} 岁，{name} 第一次带团队。从只对代码负责，到对一群人负责。"),
        T("薪资翻倍", "新 offer 的数字让 {name} 愣了一下——原来自己值这个价。"),
        T("成为团队的顶梁柱", "{age} 岁，大家遇到难题第一个想到的就是 {name}。"),
      ],
      mid: [
        T("入职新公司", "{age} 岁，{name} 在新工位坐下，深吸一口气，重新证明自己。"),
        T("熬过适应期", "前三个月很煎熬，但 {name} 慢慢站稳了脚跟。"),
        T("接手核心项目", "{age} 岁，{name} 被分到了一个重要的项目，机会和压力一起来了。"),
      ],
      low: [
        T("水土不服", "{age} 岁，新环境和想象的不一样。{name} 一度怀疑当初是不是选错了。"),
        T("又开始投简历", "平台没那么理想，{name} 默默更新了简历，准备再跳一次。"),
        T("和新领导磨合不顺", "{age} 岁，理念不合的那段日子，{name} 上班像打仗。"),
      ],
    },
  },
  {
    key: "study",
    label: "深造",
    keywords: ["读研", "考研", "深造", "读博", "留学", "进修", "学历", "phd", "mba", "上学"],
    curve: "dip-rise",
    color: "#38bdf8",
    areaBias: { career: 0.5, wealth: -0.2, relationships: 0.0, health: -0.1, growth: 0.9 },
    volatility: 0.5,
    summaries: [
      "先慢后快，转向专家路线",
      "那几年的书没白读，{name} 换了一种人生",
      "学历打开了一扇原来够不到的门",
    ],
    nodes: {
      high: [
        T("发表第一篇成果", "{age} 岁，{name} 的名字第一次印在了一份正式的成果上。"),
        T("拿到心仪 offer", "毕业那年，{name} 拿到了几年前想都不敢想的机会。"),
        T("成了领域里的人", "{age} 岁，开始有人因为专业问题来请教 {name}。"),
      ],
      mid: [
        T("重新当学生", "{age} 岁，{name} 又坐回了教室。比同学大几岁，但眼神更定。"),
        T("边学边熬", "白天上课晚上做题，{name} 把生活过成了一场长跑。"),
        T("找到研究方向", "{age} 岁，{name} 终于摸到了自己真正想钻研的题目。"),
      ],
      low: [
        T("收入断档", "{age} 岁，看着同龄人涨薪买房，{name} 的账户却在缩水，心里发慌。"),
        T("自我怀疑", "课题卡住的那段时间，{name} 反复问自己：这值得吗？"),
        T("熬夜赶不完的进度", "{age} 岁，deadline 一个接一个，{name} 觉得身体被掏空。"),
      ],
    },
  },
  {
    key: "relocate",
    label: "搬迁",
    keywords: ["搬家", "搬到", "出国", "移民", "换城市", "去北京", "去上海", "去深圳", "回老家", "定居"],
    curve: "rise-gentle",
    color: "#34d399",
    areaBias: { career: 0.3, wealth: 0.2, relationships: -0.1, health: 0.2, growth: 0.5 },
    volatility: 0.6,
    summaries: [
      "换了座城市，也换了一种活法",
      "{name} 在新地方重新长出了根",
      "离开熟悉的一切，反而看清了自己想要什么",
    ],
    nodes: {
      high: [
        T("找到归属感", "{age} 岁，{name} 第一次把新城市叫做“家”。"),
        T("圈子重建", "陌生的城市里，{name} 慢慢有了能深夜打电话的朋友。"),
        T("在这里扎下根", "{age} 岁，{name} 在新城市有了稳定的工作和喜欢的角落。"),
      ],
      mid: [
        T("拖着行李出发", "{age} 岁，{name} 站在新城市的火车站，既兴奋又茫然。"),
        T("适应新节奏", "气候、口音、规矩都不一样，{name} 一点点把日子捋顺。"),
        T("第一次独自过节", "{age} 岁，{name} 在新城市过了第一个没有家人的节日。"),
      ],
      low: [
        T("孤独的夜晚", "{age} 岁，新城市再热闹，深夜还是只有 {name} 一个人。"),
        T("想家", "{name} 偶尔会怀疑，离开是不是一个太冲动的决定。"),
        T("处处碰壁", "{age} 岁，人生地不熟，{name} 连办点小事都要绕一大圈。"),
      ],
    },
  },
  {
    key: "family",
    label: "成家",
    keywords: ["结婚", "成家", "恋爱", "生孩子", "要孩子", "在一起", "对象", "家庭", "稳定下来"],
    curve: "rise-gentle",
    color: "#f59e0b",
    areaBias: { career: -0.1, wealth: -0.1, relationships: 0.9, health: 0.1, growth: 0.3 },
    volatility: 0.4,
    summaries: [
      "重心移向了家庭，心也更稳了",
      "{name} 有了想守护的人",
      "事业慢了一点，但人生丰满了很多",
    ],
    nodes: {
      high: [
        T("成为家长", "{age} 岁，{name} 第一次抱起自己的孩子，世界突然安静又辽阔。"),
        T("一起把日子过好", "{name} 和重要的人一起还完了第一笔大账，相视一笑。"),
        T("有了真正的家", "{age} 岁，忙碌一天后推开门有人等，{name} 觉得这就够了。"),
      ],
      mid: [
        T("决定共度", "{age} 岁，{name} 决定和一个人认真地走下去。"),
        T("学着平衡", "工作和家之间，{name} 笨拙却努力地找着平衡。"),
        T("一起攒钱攒梦", "{age} 岁，{name} 和家人开始一起规划往后的日子。"),
      ],
      low: [
        T("被生活磨", "{age} 岁，柴米油盐和加班把 {name} 拉扯得有点累。"),
        T("争吵之后", "一次大吵后，{name} 才意识到关系也需要经营。"),
        T("失去自己的时间", "{age} 岁，{name} 发现属于自己的空隙越来越少了。"),
      ],
    },
  },
  {
    key: "slowdown",
    label: "慢生活",
    keywords: ["躺平", "gap", "间隔年", "慢下来", "休息", "辞职旅行", "退休", "佛系", "放空", "调整"],
    curve: "decline",
    color: "#60a5fa",
    areaBias: { career: -0.4, wealth: -0.3, relationships: 0.3, health: 0.7, growth: 0.4 },
    volatility: 0.3,
    summaries: [
      "慢下来之后，{name} 重新找回了自己",
      "少赚了一些，却活得更像个人",
      "停下来的这段路，意外地重要",
    ],
    nodes: {
      high: [
        T("身体好了起来", "{age} 岁，{name} 终于睡了好觉，体检单也变干净了。"),
        T("想明白了", "放空的某一天，{name} 突然想清楚了接下来要什么。"),
        T("找回了热情", "{age} 岁，{name} 重新对一些事情心动了起来。"),
      ],
      mid: [
        T("按下暂停键", "{age} 岁，{name} 决定先停一停，不再跟所有人比速度。"),
        T("重拾旧爱好", "{name} 又拿起了搁置多年的爱好，手生，但开心。"),
        T("陪伴家人", "{age} 岁，{name} 终于有空好好陪一陪在意的人。"),
      ],
      low: [
        T("焦虑反扑", "{age} 岁，闲下来反而更慌，{name} 担心自己被时代落下。"),
        T("存款见底", "慢生活也要花钱，{name} 看着余额开始盘算什么时候回去。"),
        T("被人不理解", "{age} 岁，周围的人都说 {name} 在浪费时间，闲话不少。"),
      ],
    },
  },
  {
    key: "statusQuo",
    label: "维持现状",
    keywords: [],
    curve: "flat",
    color: "#7681a3",
    areaBias: { career: 0.1, wealth: 0.1, relationships: 0.1, health: -0.1, growth: 0.0 },
    volatility: 0.2,
    summaries: [
      "还是现在的样子，稳稳地往前",
      "没有大起大落，{name} 把日子过成了习惯",
      "一切照旧，平淡里也有平淡的好",
    ],
    nodes: {
      high: [
        T("水到渠成的小升迁", "{age} 岁，按部就班地，{name} 也迎来了一次小小的认可。"),
        T("攒下一笔钱", "没有惊喜，但 {name} 靠稳定攒下了第一笔像样的积蓄。"),
        T("生活有了小确幸", "{age} 岁，{name} 在重复的日子里找到了一些踏实的快乐。"),
      ],
      mid: [
        T("熟悉的一年", "{age} 岁，{name} 的生活和去年没太大不同，安稳也踏实。"),
        T("日复一日", "通勤、工作、回家，{name} 把重复过成了一种安全感。"),
        T("守着熟悉的一切", "{age} 岁，{name} 没做什么大改变，也没出什么大岔子。"),
      ],
      low: [
        T("有点麻木", "{age} 岁，{name} 偶尔会想：是不是也该改变点什么？"),
        T("错过的机会", "一个机会从眼前溜走，{name} 安慰自己：稳定也没什么不好。"),
        T("说不出的倦怠", "{age} 岁，日子没什么不好，{name} 却总觉得少了点什么。"),
      ],
    },
  },
  {
    key: "bold",
    label: "大胆一搏",
    keywords: [],
    curve: "rise-steep",
    color: "#e879f9",
    areaBias: { career: 0.5, wealth: 0.4, relationships: 0.0, health: -0.1, growth: 0.6 },
    volatility: 0.8,
    summaries: [
      "赌了一把，人生因此拐了个弯",
      "没人看好的选择，{name} 却走通了",
      "这一步迈得很大，好在落了地",
    ],
    nodes: {
      high: [
        T("赌对了", "{age} 岁，当初那个没人理解的决定，开始开花结果。"),
        T("被看见", "{name} 因为这步险棋，被更多人看见了。"),
        T("走出了自己的路", "{age} 岁，{name} 证明了那条少有人走的路也能走通。"),
      ],
      mid: [
        T("做了那个决定", "{age} 岁，{name} 不顾劝阻，选了那条少有人走的路。"),
        T("摸着石头过河", "没有先例可循，{name} 只能一边走一边修正。"),
        T("咬牙坚持", "{age} 岁，没看到结果的日子里，{name} 靠一股劲撑着。"),
      ],
      low: [
        T("代价不小", "{age} 岁，大胆是有代价的，{name} 为此付出了不少。"),
        T("被质疑", "周围的不看好像潮水，{name} 在里面咬牙站着。"),
        T("差点撑不住", "{age} 岁，{name} 一度觉得这一搏可能要赔上一切。"),
      ],
    },
  },
];

const ARCHETYPE_BY_KEY: Record<string, Archetype> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.key, a]),
);

export function getArchetype(key: string): Archetype {
  return ARCHETYPE_BY_KEY[key] ?? ARCHETYPE_BY_KEY["bold"];
}

// 按关键词把一个选择文本归类到原型；命中不到返回 bold。
export function classifyChoice(label: string): Archetype {
  const text = (label ?? "").toLowerCase().trim();
  if (!text) return getArchetype("bold");
  for (const arch of ARCHETYPES) {
    if (arch.keywords.length === 0) continue; // statusQuo / bold 不参与关键词匹配
    if (arch.keywords.some((k) => text.includes(k.toLowerCase()))) {
      return arch;
    }
  }
  return getArchetype("bold");
}
