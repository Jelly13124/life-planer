import { describe, it, expect } from "vitest";
import { parseQuickInput } from "@/domain/quickParse";

// today 锚定在 2026-06-18（周四：UTC 解析 getUTCDay → 4）。所有期望都相对它算。
const T = "2026-06-18"; // 周四

describe("parseQuickInput — 相对日期", () => {
  it("今天 → today，并从标题剥掉", () => {
    const r = parseQuickInput("买菜 今天", T);
    expect(r.kind).toBe("task");
    expect(r.scheduledDate).toBe("2026-06-18");
    expect(r.text).toBe("买菜");
  });
  it("明天 → +1", () => {
    expect(parseQuickInput("跑步 明天", T).scheduledDate).toBe("2026-06-19");
  });
  it("后天 → +2", () => {
    expect(parseQuickInput("开会 后天", T).scheduledDate).toBe("2026-06-20");
  });
  it("大后天 → +3（且不会被 后天 抢先匹配）", () => {
    const r = parseQuickInput("旅行 大后天", T);
    expect(r.scheduledDate).toBe("2026-06-21");
    expect(r.text).toBe("旅行");
  });
});

describe("parseQuickInput — 星期几", () => {
  // 今天周四(4)。周五(5) = 明天 2026-06-19；周一(1) = 下周一 2026-06-22。
  it("周五 → 本周内的下一个周五", () => {
    expect(parseQuickInput("交报告 周五", T).scheduledDate).toBe("2026-06-19");
  });
  it("周一 → 跨周到下个周一", () => {
    expect(parseQuickInput("例会 周一", T).scheduledDate).toBe("2026-06-22");
  });
  it("周四（即今天）→ 跳到下周四，不取今天", () => {
    expect(parseQuickInput("复盘 周四", T).scheduledDate).toBe("2026-06-25");
  });
  it("星期日 → 下一个周日", () => {
    expect(parseQuickInput("休息 星期日", T).scheduledDate).toBe("2026-06-21");
  });
  it("下周三 → 在「下一个周三」基础上再加一周", () => {
    // 下一个周三 = 2026-06-24；下周三 = 再 +7 = 2026-07-01。
    expect(parseQuickInput("面试 下周三", T).scheduledDate).toBe("2026-07-01");
  });
});

describe("parseQuickInput — 绝对日期", () => {
  it("M月D日 → 当年那天", () => {
    const r = parseQuickInput("缴费 7月1日", T);
    expect(r.scheduledDate).toBe("2026-07-01");
    expect(r.text).toBe("缴费");
  });
  it("M/D → 当年那天", () => {
    expect(parseQuickInput("体检 12/25", T).scheduledDate).toBe("2026-12-25");
  });
  it("ISO YYYY-MM-DD → 原样那天", () => {
    expect(parseQuickInput("签证 2027-03-08", T).scheduledDate).toBe("2027-03-08");
  });
});

describe("parseQuickInput — 时间", () => {
  it("HH:MM → 24h 零填充", () => {
    const r = parseQuickInput("开会 14:30", T);
    expect(r.startTime).toBe("14:30");
    expect(r.text).toBe("开会");
  });
  it("H:MM 单位数小时 → 零填充", () => {
    expect(parseQuickInput("起床 7:05", T).startTime).toBe("07:05");
  });
  it("H点 → HH:00", () => {
    const r = parseQuickInput("跑步 7点", T);
    expect(r.startTime).toBe("07:00");
    expect(r.text).toBe("跑步");
  });
  it("H点MM → HH:MM", () => {
    expect(parseQuickInput("起床 7点30", T).startTime).toBe("07:30");
  });
  it("下午H → +12", () => {
    expect(parseQuickInput("约会 下午3", T).startTime).toBe("15:00");
  });
  it("晚上8点 → 20:00", () => {
    expect(parseQuickInput("看书 晚上8点", T).startTime).toBe("20:00");
  });
  it("上午9点 → 09:00（不 +12）", () => {
    expect(parseQuickInput("晨会 上午9点", T).startTime).toBe("09:00");
  });
});

describe("parseQuickInput — 重复 → 习惯", () => {
  it("每天 → daily habit", () => {
    const r = parseQuickInput("喝水 每天", T);
    expect(r.kind).toBe("habit");
    expect(r.repeat).toBe("daily");
    expect(r.repeatWeekday).toBeUndefined();
    expect(r.text).toBe("喝水");
  });
  it("每日 → daily", () => {
    expect(parseQuickInput("冥想 每日", T).repeat).toBe("daily");
  });
  it("daily（英文）→ daily", () => {
    expect(parseQuickInput("water daily", T).repeat).toBe("daily");
  });
  it("每周三 → weekly + repeatWeekday=3", () => {
    const r = parseQuickInput("健身 每周三", T);
    expect(r.kind).toBe("habit");
    expect(r.repeat).toBe("weekly");
    expect(r.repeatWeekday).toBe(3);
    expect(r.text).toBe("健身");
  });
  it("每星期日 → weekly + repeatWeekday=0", () => {
    const r = parseQuickInput("打扫 每星期日", T);
    expect(r.repeat).toBe("weekly");
    expect(r.repeatWeekday).toBe(0);
  });
  it("weekly（英文，无指定星期）→ weekly + 无 weekday", () => {
    const r = parseQuickInput("review weekly", T);
    expect(r.repeat).toBe("weekly");
    expect(r.repeatWeekday).toBeUndefined();
  });
  it("重复习惯 + 时间：每天 7点 → daily + 07:00", () => {
    const r = parseQuickInput("跑步 每天 7点", T);
    expect(r.kind).toBe("habit");
    expect(r.repeat).toBe("daily");
    expect(r.startTime).toBe("07:00");
    expect(r.text).toBe("跑步");
  });
});

describe("parseQuickInput — 标签", () => {
  it("#词 → tags[]，并从标题剥掉", () => {
    const r = parseQuickInput("写方案 #工作 明天", T);
    expect(r.tags).toEqual(["工作"]);
    expect(r.scheduledDate).toBe("2026-06-19");
    expect(r.text).toBe("写方案");
  });
  it("多个标签（中英数字混合）", () => {
    const r = parseQuickInput("学习 #英语 #study2026", T);
    expect(r.tags).toEqual(["英语", "study2026"]);
    expect(r.text).toBe("学习");
  });
  it("无标签 → 空数组", () => {
    expect(parseQuickInput("散步", T).tags).toEqual([]);
  });
});

describe("parseQuickInput — 组合 / 纯文本 / 边界", () => {
  it("剥掉所有 token 后留下干净标题", () => {
    const r = parseQuickInput("和朋友吃饭 明天 下午6点 #社交", T);
    expect(r.text).toBe("和朋友吃饭");
    expect(r.scheduledDate).toBe("2026-06-19");
    expect(r.startTime).toBe("18:00");
    expect(r.tags).toEqual(["社交"]);
    expect(r.kind).toBe("task");
  });
  it("纯文本 → task，无日期无时间", () => {
    const r = parseQuickInput("随便记一笔", T);
    expect(r.kind).toBe("task");
    expect(r.scheduledDate).toBeUndefined();
    expect(r.startTime).toBeUndefined();
    expect(r.repeat).toBeUndefined();
    expect(r.text).toBe("随便记一笔");
  });
  it("空输入 → 空标题", () => {
    expect(parseQuickInput("   ", T).text).toBe("");
  });
  it("英文相对日：明天 tomorrow", () => {
    expect(parseQuickInput("call mom tomorrow", T).scheduledDate).toBe("2026-06-19");
  });
  it("确定性：同输入同 today → 同结果", () => {
    const a = parseQuickInput("跑步 每周三 7点 #健康", T);
    const b = parseQuickInput("跑步 每周三 7点 #健康", T);
    expect(a).toEqual(b);
  });
});
