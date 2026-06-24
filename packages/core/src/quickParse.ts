import { addDays } from "./daily";
import { weekdayOf } from "./calendar";

// ───────────────────────────────────────────────────────────────────────────
// quickParse —— 快速捕捉的本地自然语言解析（纯函数）。
// 把一行中英混写（如「跑步 明天 7点 #健康」「喝水 每天」）拆成结构化字段，
// 并从标题里剥掉所有被识别的 token，剩下的 = 干净标题。
// 确定性：不用 Date.now/Math.random；今天由 today 注入（本地日 YYYY-MM-DD）。
// 日差走 daily.addDays + calendar.weekdayOf（UTC 解析，与日历/排程口径一致）。
// ───────────────────────────────────────────────────────────────────────────

export interface QuickParse {
  text: string; // 剥掉所有 token 后的干净标题（已 trim）
  kind: "task" | "habit"; // 有重复 token → habit，否则 task
  scheduledDate?: string; // 排到的本地日 YYYY-MM-DD
  startTime?: string; // 本地时刻 HH:MM 24h（零填充）
  repeat?: "daily" | "weekly";
  repeatWeekday?: number; // 仅 weekly：0=周日…6=周六
  tags: string[]; // #标签（不含 #）
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// 中文「一二三四五六日/天」→ 0..6（周日=0）。"日"/"天" 都指周日。
const CN_WD: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0,
};

// 从 today 出发，找「下一个该星期几」的日期；includeToday=false 时若今天正好是该天则跳到下周。
function nextWeekday(today: string, wd: number, includeToday: boolean): string {
  const cur = weekdayOf(today);
  let delta = (wd - cur + 7) % 7;
  if (delta === 0 && !includeToday) delta = 7;
  return addDays(today, delta);
}

// 把识别到的 token 从工作串里抹掉（替换为空格，保留分词边界）。
function strip(s: string, token: string): string {
  return s.replace(token, " ");
}

export function parseQuickInput(text: string, today: string): QuickParse {
  let work = ` ${text} `; // 两端留空格，方便整词替换
  const out: QuickParse = { text: "", kind: "task", tags: [] };

  // 1) 标签 #词（CJK / 字母 / 数字 / 下划线），可多个。先抽，避免与其它规则串台。
  const tags: string[] = [];
  work = work.replace(/#([\p{L}\p{N}_]+)/gu, (_m, tag: string) => {
    tags.push(tag);
    return " ";
  });
  out.tags = tags;

  // 2) 重复 → 习惯（先于「星期几」日期规则，避免「每周三」里的「三」被当作普通星期几）。
  //    每周X / 每星期X → weekly + weekday；每天/每日/daily → daily；每周/每星期/weekly（无 X）→ weekly 无 weekday。
  const weeklyWd = work.match(/每(?:周|星期)([一二三四五六日天])/);
  if (weeklyWd) {
    out.kind = "habit";
    out.repeat = "weekly";
    out.repeatWeekday = CN_WD[weeklyWd[1]];
    work = strip(work, weeklyWd[0]);
  } else if (/每天|每日|\bdaily\b/i.test(work)) {
    out.kind = "habit";
    out.repeat = "daily";
    work = work.replace(/每天|每日/, " ").replace(/\bdaily\b/i, " ");
  } else if (/每(?:周|星期)|\bweekly\b/i.test(work)) {
    out.kind = "habit";
    out.repeat = "weekly";
    work = work.replace(/每(?:周|星期)/, " ").replace(/\bweekly\b/i, " ");
  }

  // 3) 日期。相对 → 星期几 → 绝对，逐条尝试；命中即剥掉。仅在还没排重复时才设 scheduledDate
  //    （习惯按 repeat 显示，不落 scheduledDate；但仍剥掉日期 token 以净化标题）。
  const setDate = (d: string) => {
    if (out.repeat === undefined) out.scheduledDate = d;
  };

  // 3a) 相对日：大后天(+3) 必须在 后天(+2) 之前匹配，否则会被「后天」截断。
  if (/大后天/.test(work)) {
    setDate(addDays(today, 3));
    work = strip(work, "大后天");
  } else if (/后天|the day after tomorrow/i.test(work)) {
    setDate(addDays(today, 2));
    work = work.replace(/后天/, " ").replace(/the day after tomorrow/i, " ");
  } else if (/明天|tomorrow/i.test(work)) {
    setDate(addDays(today, 1));
    work = work.replace(/明天/, " ").replace(/tomorrow/i, " ");
  } else if (/今天|today/i.test(work)) {
    setDate(today);
    work = work.replace(/今天/, " ").replace(/today/i, " ");
  } else {
    // 3b) 星期几：下周X = 下一个X再 +7；周X / 星期X = 下一个X（今天正好是该天 → 跳下周）。
    const nextWk = work.match(/下(?:周|星期)([一二三四五六日天])/);
    const thisWk = work.match(/(?:周|星期)([一二三四五六日天])/);
    if (nextWk) {
      const base = nextWeekday(today, CN_WD[nextWk[1]], false);
      setDate(addDays(base, 7));
      work = strip(work, nextWk[0]);
    } else if (thisWk) {
      setDate(nextWeekday(today, CN_WD[thisWk[1]], false));
      work = strip(work, thisWk[0]);
    } else {
      // 3c) 绝对日：ISO YYYY-MM-DD → M月D日 → M/D。
      const iso = work.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      const cnMd = work.match(/(\d{1,2})月(\d{1,2})日?/);
      const slash = work.match(/(?<!\d)(\d{1,2})\/(\d{1,2})(?!\d)/);
      const year = Number(today.slice(0, 4));
      if (iso) {
        setDate(`${iso[1]}-${pad2(Number(iso[2]))}-${pad2(Number(iso[3]))}`);
        work = strip(work, iso[0]);
      } else if (cnMd) {
        setDate(`${year}-${pad2(Number(cnMd[1]))}-${pad2(Number(cnMd[2]))}`);
        work = strip(work, cnMd[0]);
      } else if (slash) {
        setDate(`${year}-${pad2(Number(slash[1]))}-${pad2(Number(slash[2]))}`);
        work = strip(work, slash[0]);
      }
    }
  }

  // 4) 时间。HH:MM → 中文「H点MM/H点」(可带 上午/早上/下午/晚上 前缀) → 纯「上午/下午 H」。
  const ampm = (m: string | undefined, h: number): number => {
    if (!m) return h;
    if (/下午|晚上/.test(m) && h < 12) return h + 12;
    return h; // 上午/早上：原样（不处理 12 → 0 的边角，MVP 够用）
  };
  const hhmm = work.match(/(?<!\d)(\d{1,2}):(\d{2})(?!\d)/);
  const cnTimeFull = work.match(/(上午|早上|下午|晚上)?\s*(\d{1,2})点(\d{1,2})/);
  const cnTimeHour = work.match(/(上午|早上|下午|晚上)?\s*(\d{1,2})点/);
  const cnBare = work.match(/(上午|早上|下午|晚上)\s*(\d{1,2})(?!\d)/);
  if (hhmm) {
    out.startTime = `${pad2(Number(hhmm[1]))}:${pad2(Number(hhmm[2]))}`;
    work = strip(work, hhmm[0]);
  } else if (cnTimeFull) {
    out.startTime = `${pad2(ampm(cnTimeFull[1], Number(cnTimeFull[2])))}:${pad2(Number(cnTimeFull[3]))}`;
    work = strip(work, cnTimeFull[0]);
  } else if (cnTimeHour) {
    out.startTime = `${pad2(ampm(cnTimeHour[1], Number(cnTimeHour[2])))}:00`;
    work = strip(work, cnTimeHour[0]);
  } else if (cnBare) {
    out.startTime = `${pad2(ampm(cnBare[1], Number(cnBare[2])))}:00`;
    work = strip(work, cnBare[0]);
  }

  // 5) 干净标题：折叠多余空白后 trim。
  out.text = work.replace(/\s+/g, " ").trim();
  return out;
}
