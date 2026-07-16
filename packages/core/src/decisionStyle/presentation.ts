import type { DecisionStyleCode } from "./axes";

export interface DecisionPersonalityPresentation {
  readonly code: DecisionStyleCode;
  readonly label: string;
  readonly tagline: string;
  readonly highlight: string;
  readonly roast: string;
  readonly advice: string;
  readonly characterId: DecisionStyleCode;
}

const p = (
  code: DecisionStyleCode,
  label: string,
  tagline: string,
  highlight: string,
  roast: string,
  advice: string,
): DecisionPersonalityPresentation => Object.freeze({ code, label, tagline, highlight, roast, advice, characterId: code });

const PRESENTATIONS = Object.freeze([
  p("FDBG", "务实攻坚者", "你不是没耐心，只是觉得今天能解决的事，不该开三次会。", "目标一清楚，你通常是最先把事情推起来的人。", "推进太快时，别人和后手可能还没跟上。", "重要决定前，强制找一个人唱反调。"),
  p("FDBV", "信念开拓者", "路还没铺好，你已经凭直觉走出第一公里。", "没有现成答案时，你仍敢围绕真正重视的方向开路。", "一上头就容易把协作和成本都当成以后再说。", "给自己配一位现实合伙人，专门提醒投入边界。"),
  p("FDLG", "借势攀登者", "别人还在找梯子，你已经踩着现成台阶往上走了。", "你能快速发现可用资源，并把它们变成真实进展。", "机会太顺时，容易忘了这到底是不是你想去的地方。", "每到关键节点，先写下自己的选择标准。"),
  p("FDLV", "组织破局者", "你最擅长的不是适应规则，是边跑边把规则改得能用。", "你能在协作中推动改变，也敢为重要的事先迈一步。", "一旦认定值得，容易把自己的恢复空间也拿去填坑。", "先把改变拆成一个能够协商的小步骤。"),
  p("FWBG", "多线经营者", "你的备选方案不是 B 计划，是从 B 排到 G。", "你能同时捕捉多种机会，并保持行动和回报的弹性。", "每条线都舍不得关，最后注意力可能先宣布破产。", "每周删掉一条回报和投入都说不清的支线。"),
  p("FWBV", "自由开拓者", "别人怕选错，你更怕世界上还有一条路没走过。", "你愿意主动尝试新可能，也很少把自己困在单一路线里。", "新鲜感一来，昨天的长期主义就容易请假。", "每次探索都设一个继续、暂停或收束日期。"),
  p("FWLG", "机会整合者", "你的人生不像单线程，更像同时开着十二个合作窗口。", "你擅长把不同机会、资源和人连接成新的路径。", "外面的机会太热闹时，自己的优先级容易被静音。", "比较机会前，先写下三个不可让步的条件。"),
  p("FWLV", "跨界理想家", "你不是想得太多，是每个可能性都刚好有点意思。", "你能在多元连接里看到意义，并把不同视角放到一起。", "一直保持开放，也可能让最重要的事迟迟没有落点。", "只选一个本月必须做出的可见成果。"),
  p("SDBG", "稳健匠人", "你不是慢，你只是拒绝拿长期质量给短期速度交作业。", "你能在可控节奏里持续深耕，把保障和质量一起守住。", "等到完全有把握，低成本试错的窗口可能已经关了。", "保留主线，同时安排一个可逆的小实验。"),
  p("SDBV", "长期创造者", "别人靠截止日期推进，你靠心里那件真正重要的事。", "你能为重要方向耐心积累，并长期保持内在一致。", "太忠于最初方向时，环境变了你也可能假装没看见。", "固定邀请外部反馈，检查坚持是否仍有价值。"),
  p("SDLG", "深耕积累者", "你不追每一阵风，但很会把一块地种到别人追不上。", "你善于借助稳定资源，把一条主线做出可靠积累。", "熟悉路径太舒服时，新选择很难挤进日程。", "定期盘点可迁移能力，并主动建立一个新连接。"),
  p("SDLV", "价值深耕者", "你愿意把重要的事做很久，也愿意把身边的人一起带稳。", "你能在长期协作中持续投入，并形成让人放心的贡献。", "太会照顾整体，自己的表达和边界常被排到最后。", "明确提出一项你想推动的改变和需要的支持。"),
  p("SWBG", "稳健多面手", "你从不把鸡蛋放一个篮子，偶尔连篮子也准备了备份。", "你能在多个方向之间留下余量，不轻易让自己失去退路。", "为了不押错，可能每条路都只走到刚刚认识你。", "从现有方向中挑一条，连续投入四周再判断。"),
  p("SWBV", "自在探索者", "你看起来不着急，其实一直在悄悄试探世界的边界。", "你能用自己的节奏探索多种可能，同时保护内在认同。", "选择一直留着，也可能意味着最想做的事一直没开始。", "给最在意的一条线安排一次真实行动。"),
  p("SWLG", "稳健多栖者", "别人做选择题，你擅长把题目改成多选并留好退路。", "你善于利用现有连接维持多种选择和安全余量。", "外部安排越完整，自己的优先级越容易变成代办。", "把所有连接分成真正支持你和只消耗注意力两类。"),
  p("SWLV", "从容连接者", "你总能看到每个人的立场，唯独自己的决定容易晚一点出现。", "你能在多元协作中保持从容，也很少轻易忽略他人。", "顾全太多方时，明确表态会被你无限延期。", "先独立写下个人优先级，再进入协商。"),
] satisfies readonly DecisionPersonalityPresentation[]);

export function allDecisionPersonalityPresentations(): readonly DecisionPersonalityPresentation[] {
  return PRESENTATIONS;
}

export function decisionPersonalityPresentationByCode(code: string): DecisionPersonalityPresentation | undefined {
  return PRESENTATIONS.find((item) => item.code === code);
}
