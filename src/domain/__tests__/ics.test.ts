import { describe, it, expect } from "vitest";
import { parseIcs } from "@/domain/ics";

// 用 \r\n 拼真实 ICS（RFC 5545 行用 CRLF），验证 unfold/解析对换行不敏感。
const crlf = (lines: string[]) => lines.join("\r\n");

describe("parseIcs — 折叠行（folded line）", () => {
  it("以空格开头的续行拼回上一行（长 SUMMARY 被折叠）", () => {
    const text = crlf([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:fold-1",
      "SUMMARY:这是一个非常非常长的标",
      " 题需要折叠成两行",
      "DTSTART;VALUE=DATE:20260623",
      "END:VEVENT",
      "END:VCALENDAR",
    ]);
    const ev = parseIcs(text);
    expect(ev).toHaveLength(1);
    expect(ev[0].title).toBe("这是一个非常非常长的标题需要折叠成两行");
  });
});

describe("parseIcs — 全天事件（all-day）", () => {
  it("DTSTART;VALUE=DATE → allDay，仅有日期无时刻", () => {
    const text = crlf([
      "BEGIN:VEVENT",
      "UID:allday-1",
      "SUMMARY:生日",
      "DTSTART;VALUE=DATE:20260623",
      "DTEND;VALUE=DATE:20260624",
      "END:VEVENT",
    ]);
    const [e] = parseIcs(text);
    expect(e.allDay).toBe(true);
    expect(e.date).toBe("2026-06-23");
    expect(e.startTime).toBeUndefined();
    expect(e.endTime).toBeUndefined();
  });
});

describe("parseIcs — 定时事件（timed：Z 与 TZID）", () => {
  it("UTC（带 Z）按墙上时钟取，不换时区", () => {
    const text = crlf([
      "BEGIN:VEVENT",
      "UID:timed-z",
      "SUMMARY:开会",
      "DTSTART:20260623T140000Z",
      "DTEND:20260623T150000Z",
      "END:VEVENT",
    ]);
    const [e] = parseIcs(text);
    expect(e.allDay).toBe(false);
    expect(e.date).toBe("2026-06-23");
    expect(e.startTime).toBe("14:00");
    expect(e.endTime).toBe("15:00");
  });

  it("TZID 同样按字符串里的墙上时钟取", () => {
    const text = crlf([
      "BEGIN:VEVENT",
      "UID:timed-tzid",
      "SUMMARY:健身",
      "DTSTART;TZID=Asia/Shanghai:20260623T070000",
      "DTEND;TZID=Asia/Shanghai:20260623T080000",
      "END:VEVENT",
    ]);
    const [e] = parseIcs(text);
    expect(e.startTime).toBe("07:00");
    expect(e.endTime).toBe("08:00");
    expect(e.date).toBe("2026-06-23");
  });
});

describe("parseIcs — 多个 VEVENT", () => {
  it("逐块解析出多个事件", () => {
    const text = crlf([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:a",
      "SUMMARY:A",
      "DTSTART;VALUE=DATE:20260601",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:b",
      "SUMMARY:B",
      "DTSTART:20260602T090000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ]);
    const ev = parseIcs(text);
    expect(ev.map((e) => e.id)).toEqual(["a", "b"]);
    expect(ev[0].allDay).toBe(true);
    expect(ev[1].startTime).toBe("09:00");
  });
});

describe("parseIcs — 缺 SUMMARY / UID 兜底", () => {
  it("缺 SUMMARY → 占位标题；缺 UID → 由 hashSeed 确定性生成且稳定", () => {
    const block = crlf([
      "BEGIN:VEVENT",
      "DTSTART:20260623T140000Z",
      "END:VEVENT",
    ]);
    const a = parseIcs(block);
    const b = parseIcs(block);
    expect(a).toHaveLength(1);
    expect(a[0].title).toBe("(no title)");
    expect(a[0].id).toMatch(/^ics-/);
    expect(a[0].id).toBe(b[0].id); // 确定性：同输入同 id
  });
});

describe("parseIcs — malformed 块被跳过", () => {
  it("无 DTSTART 的块跳过，正常块仍解析", () => {
    const text = crlf([
      "BEGIN:VEVENT",
      "SUMMARY:坏块没有开始时间",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:ok",
      "SUMMARY:好块",
      "DTSTART;VALUE=DATE:20260623",
      "END:VEVENT",
    ]);
    const ev = parseIcs(text);
    expect(ev).toHaveLength(1);
    expect(ev[0].id).toBe("ok");
  });

  it("空文本 / 非字符串 → 空数组", () => {
    expect(parseIcs("")).toEqual([]);
    // @ts-expect-error 故意传非字符串验证防御
    expect(parseIcs(null)).toEqual([]);
  });
});

describe("parseIcs — RRULE 不展开", () => {
  it("带 RRULE 的事件只收录基准一次", () => {
    const text = crlf([
      "BEGIN:VEVENT",
      "UID:weekly",
      "SUMMARY:每周例会",
      "DTSTART:20260623T100000Z",
      "RRULE:FREQ=WEEKLY;COUNT=10",
      "END:VEVENT",
    ]);
    const ev = parseIcs(text);
    expect(ev).toHaveLength(1);
    expect(ev[0].id).toBe("weekly");
  });
});
