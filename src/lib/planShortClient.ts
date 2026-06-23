// 客户端安全：AI 规划短期目标这一段的网络封装。失败/离线一律回退到本地 localPlanShort，
// 永远 resolve 出一份 {taskDates,habitWeekdays}。镜像 scheduleClient.ts。
import { localPlanShort, type PlanShortInput, type PlanShortResult } from "@/domain/planShort";
import { currentLocale } from "@/i18n/locale";

export interface PlanShortPayload extends PlanShortInput {
  goal: { title: string; why?: string; startDate?: string; endDate?: string };
  dayStart: string;
  dayEnd: string;
}

export async function fetchPlanShort(payload: PlanShortPayload): Promise<PlanShortResult> {
  const local = (): PlanShortResult => localPlanShort(payload);
  try {
    const res = await fetch("/api/plan-short-goal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: payload.goal,
        today: payload.today,
        dayStart: payload.dayStart,
        dayEnd: payload.dayEnd,
        tasks: payload.tasks,
        habits: payload.habits,
        lang: currentLocale(),
      }),
    });
    if (!res.ok) return local();
    const data = (await res.json()) as Partial<PlanShortResult>;
    const taskDates =
      data.taskDates && typeof data.taskDates === "object" ? data.taskDates : {};
    const habitWeekdays =
      data.habitWeekdays && typeof data.habitWeekdays === "object" ? data.habitWeekdays : {};
    return { taskDates, habitWeekdays };
  } catch {
    return local();
  }
}
