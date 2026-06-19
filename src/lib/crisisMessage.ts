import { CRISIS_RESOURCES } from "@/domain/safety";

type TFn = (zh: string, vars?: Record<string, string | number>) => string;

// 组装一段克制、关怀、非临床的回应文本（含求助资源），用于聊天里温和拦截。
export function crisisCareText(t: TFn): string {
  const head = t(
    "听起来你正在经历很难熬的时刻，我很在意你。比起聊未来，现在更重要的是你的安全。",
  );
  const intro = t("可以联系：");
  const lines = CRISIS_RESOURCES.map((r) => `· ${r.label}：${r.contact}`).join("\n");
  const tail = t("如果你愿意，我随时在这里。");
  return `${head}\n\n${intro}\n${lines}\n\n${tail}`;
}
