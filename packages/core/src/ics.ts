// ───────────────────────────────────────────────────────────────────────────
// ics —— 只读 ICS（RFC 5545 iCalendar）解析的纯函数。把订阅链接 / 上传文件的文本
// 解析成一组 IcsEvent，叠加显示在月/日视图上（只读，不参与拖拽/AI 排程）。
//
// v1 取舍（刻意从简，够「看见真实日历」用）：
//   • 时区：DTSTART 带 Z（UTC）或 ;TZID=… 时，一律按字符串里的「墙上时钟」数字取，
//     不做任何时区换算。即 `:20260623T140000Z` 与 `;TZID=...:20260623T140000` 都按 14:00 取。
//     对大多数本地订阅够用；跨时区精确换算留到 v2。
//   • 重复：不展开 RRULE。带 RRULE 的事件只收录它的基准事件一次（不生成后续实例）。
//
// 纯/确定性：UID 缺失时用 hashSeed(title+dtstart) 兜底生成 id；不使用 Date.now/Math.random。
// ───────────────────────────────────────────────────────────────────────────

import { hashSeed } from "./seed";

export interface IcsEvent {
  id: string;
  title: string;
  date: string; // 本地日 YYYY-MM-DD（取字符串里的年月日）
  startTime?: string; // HH:MM（仅 timed 事件；按墙上时钟取，不换时区）
  endTime?: string; // HH:MM（DTEND；同上）
  allDay: boolean; // DTSTART;VALUE=DATE → true
}

// RFC 5545 行折叠：以空格/制表符开头的行是上一行的续行，去掉该前导空白后拼回上一行。
// 同时把 \r\n / \r 统一成 \n 再处理。
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

// 把一行 "NAME;PARAM=x;PARAM2=y:VALUE" 拆成 { name, params, value }。
// 注意：冒号分隔属性名/参数 与 值；但值里可能含冒号（如 URL），故只在第一个冒号处切。
function parseLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segs = head.split(";");
  const name = (segs[0] ?? "").toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < segs.length; i++) {
    const eq = segs[i].indexOf("=");
    if (eq === -1) continue;
    params[segs[i].slice(0, eq).toUpperCase()] = segs[i].slice(eq + 1);
  }
  return { name, params, value };
}

// 解析 DTSTART/DTEND 的值 → { date, time?, allDay }。
//   ;VALUE=DATE → "YYYYMMDD"（全天，无时刻）
//   ":YYYYMMDDTHHMMSSZ"（UTC）/ ";TZID=...:YYYYMMDDTHHMMSS" → 取墙上时钟数字，不换时区。
// 解析失败返回 null（调用方据此跳过该块）。
function parseDt(
  value: string,
  params: Record<string, string>,
): { date: string; time?: string; allDay: boolean } | null {
  const v = value.trim();
  const isDateOnly = params.VALUE === "DATE" || /^\d{8}$/.test(v);
  const dm = v.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!dm) return null;
  const date = `${dm[1]}-${dm[2]}-${dm[3]}`;
  if (isDateOnly) return { date, allDay: true };
  // 取时刻：…T HHMMSS（末尾可有 Z；忽略——按墙上时钟取，不换时区，见文件头取舍）。
  const tm = v.match(/T(\d{2})(\d{2})/);
  if (!tm) return { date, allDay: true }; // 有 T 但无法取时刻则退化为全天
  return { date, time: `${tm[1]}:${tm[2]}`, allDay: false };
}

// 把整段 ICS 文本解析成事件数组。malformed（无法取出有效 DTSTART）的块直接跳过。
export function parseIcs(text: string): IcsEvent[] {
  if (!text || typeof text !== "string") return [];
  const lines = unfold(text);
  const events: IcsEvent[] = [];

  let inEvent = false;
  let summary = "";
  let uid = "";
  let dtStart: { date: string; time?: string; allDay: boolean } | null = null;
  let dtStartRaw = "";
  let endTime: string | undefined;

  const reset = () => {
    summary = "";
    uid = "";
    dtStart = null;
    dtStartRaw = "";
    endTime = undefined;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      reset();
      continue;
    }
    if (trimmed === "END:VEVENT") {
      // 无有效 DTSTART → malformed，跳过。
      if (inEvent && dtStart) {
        const title = summary.trim() || "(no title)";
        const id = uid.trim() || `ics-${hashSeed(`${title}|${dtStartRaw}`)}`;
        events.push({
          id,
          title,
          date: dtStart.date,
          startTime: dtStart.allDay ? undefined : dtStart.time,
          endTime: dtStart.allDay ? undefined : endTime,
          allDay: dtStart.allDay,
        });
      }
      inEvent = false;
      reset();
      continue;
    }
    if (!inEvent) continue;

    const p = parseLine(line);
    if (!p) continue;
    switch (p.name) {
      case "SUMMARY":
        summary = unescapeText(p.value);
        break;
      case "UID":
        uid = p.value.trim();
        break;
      case "DTSTART":
        dtStartRaw = p.value;
        dtStart = parseDt(p.value, p.params);
        break;
      case "DTEND": {
        const e = parseDt(p.value, p.params);
        if (e && !e.allDay) endTime = e.time;
        break;
      }
      // RRULE 故意不处理：v1 不展开重复，仅收录基准事件一次（见文件头取舍）。
      default:
        break;
    }
  }

  return events;
}

// RFC 5545 文本转义还原：\\ \, \; \n \N（其余原样）。
function unescapeText(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
