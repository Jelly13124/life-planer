// ─────────────────────────────────────────────────────────────────────────────
// safety — 高置信度危机信号检测（保守设计，纯函数，无 IO）。
//
// 设计原则：
//  · 极度保守：只收录多字、无歧义的短语；刻意排除"死"/"想死"/"累死"/"笑死"
//    等高频夸张口语，也不包含"要我命"/"杀时间"等习语。
//  · detectCrisisSignal 是纯函数：deterministic，无副作用，无网络/IO。
//  · 不含医疗建议：CRISIS_RESOURCES 只提供求助热线等展示文本。
// ─────────────────────────────────────────────────────────────────────────────

export interface CrisisResource {
  /** 展示标签，如 "中国大陆 · 心理援助热线" */
  label: string;
  /** 联系方式文本，如电话号码或简短说明 */
  contact: string;
}

/**
 * 危机求助资源（仅展示用，不含医疗诊断或治疗建议）。
 * 数据来自公开发布的公益热线；建议结合最新官方渠道核实。
 */
export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    label: "北京心理危机研究与干预中心",
    contact: "010-82951332",
  },
  {
    label: "全国心理援助热线（24小时）",
    contact: "400-161-9995",
  },
  {
    label: "希望24热线",
    contact: "400-161-9995",
  },
  {
    label: "紧急情况",
    contact: "请立即联系当地急救（120）或可信赖的人",
  },
];

// ─── 高置信度危机信号短语列表 ─────────────────────────────────────────────
//
// 中文：通过 String.prototype.includes 逐字匹配（保留大小写，中文无大小写之分）。
//   只收录多字、语义明确的短语，避免误伤"笑死""累死""想死（口语夸张）""活（活法）"等。
//
// 英文：先 toLowerCase()，再 substring includes 匹配。
//   不含 "dead", "dying", "kill" 独词，避免误伤 "I'm dead tired" / "killing me (deadline)"。

const ZH_PHRASES: readonly string[] = [
  "自杀",
  "不想活了",
  "不想活下去",
  "活不下去",
  "结束自己的生命",
  "结束生命",
  "轻生",
  "了结自己",
];

const EN_PHRASES_LOWER: readonly string[] = [
  "suicide",
  "suicidal",
  "kill myself",
  "killing myself",
  "end my life",
  "ending my life",
  "want to die",
  "wanna die",
  "don't want to live",
  "dont want to live",
  "self-harm",
  "hurt myself",
  "cut myself",
];

/**
 * 对单段文本执行危机信号检测。
 * 纯函数：deterministic，无副作用。
 *
 * @param text - 任意字符串（空字符串 / 空白返回 false）
 * @returns true 当且仅当文本包含高置信度危机信号短语
 */
export function detectCrisisSignal(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // 中文短语：原文 includes（中文无大小写）
  for (const phrase of ZH_PHRASES) {
    if (trimmed.includes(phrase)) return true;
  }

  // 英文短语：统一 toLowerCase 后 includes
  const lower = trimmed.toLowerCase();
  for (const phrase of EN_PHRASES_LOWER) {
    if (lower.includes(phrase)) return true;
  }

  return false;
}

/**
 * 对多段文本批量检测：任意一段命中即返回 true。
 * null / undefined / 空字符串 安全（自动跳过）。
 *
 * @param texts - 字符串数组，允许包含 null/undefined 元素
 */
export function anyCrisisSignal(texts: (string | undefined | null)[]): boolean {
  for (const t of texts) {
    if (t != null && t.length > 0 && detectCrisisSignal(t)) return true;
  }
  return false;
}
