// 月 / 年 日历视图（展示层）。数据走核心 calendar.monthGrid；密度/导航由 ScheduleScreen 注入。
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { monthGrid } from "@lifeplanner/core/calendar";
import { colors } from "../theme";

const pad2 = (n: number) => String(n).padStart(2, "0");
const firstOfMonth = (y: number, m: number): string => {
  // m 可能越界（0 或 13）→ 归一化年月
  const d = new Date(Date.UTC(y, m - 1, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`;
};
const WEEK = ["一", "二", "三", "四", "五", "六", "日"];

export function MonthView({
  year,
  month,
  today,
  viewDate,
  densityOf,
  onPickDay,
  onShiftMonth,
}: {
  year: number;
  month: number; // 1-based
  today: string;
  viewDate: string;
  densityOf: (date: string) => number;
  onPickDay: (date: string) => void;
  onShiftMonth: (firstOfMonthDate: string) => void;
}) {
  const cells = monthGrid(year, month);
  return (
    <View>
      <View style={styles.navRow}>
        <Pressable onPress={() => onShiftMonth(firstOfMonth(year, month - 1))} hitSlop={8}>
          <Text style={styles.navArrow}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>
          {year}年{month}月
        </Text>
        <Pressable onPress={() => onShiftMonth(firstOfMonth(year, month + 1))} hitSlop={8}>
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEK.map((w) => (
          <Text key={w} style={styles.weekCell}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map(({ date, inMonth }) => {
          const n = densityOf(date);
          const isToday = date === today;
          const isSel = date === viewDate;
          const day = Number(date.slice(8, 10));
          return (
            <Pressable
              key={date}
              onPress={() => onPickDay(date)}
              style={[styles.cell, isSel && styles.cellSel]}
            >
              <Text
                style={[
                  styles.cellNum,
                  !inMonth && styles.cellOut,
                  isToday && styles.cellToday,
                  isSel && { color: "#fff" },
                ]}
              >
                {day}
              </Text>
              {n > 0 ? (
                <View style={[styles.dot, isSel && { backgroundColor: "#fff" }]} />
              ) : (
                <View style={styles.dotPlaceholder} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function YearView({
  year,
  today,
  onPickMonth,
  onShiftYear,
}: {
  year: number;
  today: string;
  onPickMonth: (firstOfMonthDate: string) => void;
  onShiftYear: (firstOfMonthDate: string) => void;
}) {
  const curY = Number(today.slice(0, 4));
  const curM = Number(today.slice(5, 7));
  return (
    <View>
      <View style={styles.navRow}>
        <Pressable onPress={() => onShiftYear(firstOfMonth(year - 1, 1))} hitSlop={8}>
          <Text style={styles.navArrow}>‹</Text>
        </Pressable>
        <Text style={styles.navTitle}>{year}</Text>
        <Pressable onPress={() => onShiftYear(firstOfMonth(year + 1, 1))} hitSlop={8}>
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      </View>
      <View style={styles.yearGrid}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const isCur = year === curY && m === curM;
          return (
            <Pressable
              key={m}
              onPress={() => onPickMonth(firstOfMonth(year, m))}
              style={[styles.monthCard, isCur && styles.monthCardCur]}
            >
              <Text style={[styles.monthCardText, isCur && { color: colors.accent }]}>{m}月</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginBottom: 12,
  },
  navArrow: { fontSize: 24, color: colors.fgMuted, paddingHorizontal: 8 },
  navTitle: { fontSize: 17, fontWeight: "700", color: colors.fg, minWidth: 96, textAlign: "center" },
  weekRow: { flexDirection: "row", marginBottom: 6 },
  weekCell: { flex: 1, textAlign: "center", fontSize: 12, color: colors.fgMuted },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  cellSel: { backgroundColor: colors.accent },
  cellNum: { fontSize: 15, color: colors.fg },
  cellOut: { color: colors.line },
  cellToday: { color: colors.accent, fontWeight: "700" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent, marginTop: 3 },
  dotPlaceholder: { width: 5, height: 5, marginTop: 3 },
  yearGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  monthCard: {
    width: `${(100 - 6) / 3}%`,
    aspectRatio: 1.6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  monthCardCur: { borderColor: colors.accent, borderWidth: 1.5 },
  monthCardText: { fontSize: 16, fontWeight: "600", color: colors.fg },
});
