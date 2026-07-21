"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/state/AppContext";
import { Card } from "../ui/Card";
import { AreaIcon } from "../lib/areaMeta";
import { IconCalendar, IconChart, IconCheckCircle, IconPencil, IconRepeat, IconSparkle, IconTree } from "../ui/icons";
import { GOAL_AREA_LABELS, GOAL_AREAS, type Goal, type GoalArea, type GoalKind } from "@/domain/types";
import { goalProgress } from "@/domain/goals";
import type { PlanShortResult } from "@/domain/planShort";
import { fetchGoalDecomposition, type GoalDecomposition } from "@/lib/goalClient";
import { AddChip, IconButton, InlineTextAdd, ItemGroups, MetricEditor, MetricRow, ProgressBar } from "./PlanPrimitives";

const AREA_COLORS: Record<GoalArea, string> = {
  career: "var(--c-sky)",
  wealth: "var(--c-amber)",
  relationships: "var(--c-rose)",
  health: "var(--c-emerald)",
  growth: "var(--accent)",
  other: "var(--fg-faint)",
};
const WEEKDAY_KEYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;
const WEEKDAY_TAIL = ["日", "一", "二", "三", "四", "五", "六"] as const;
type TFn = (zh: string, vars?: Record<string, string | number>) => string;

function monthDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}月${d}日`;
}

interface GoalDraft {
  area: GoalArea;
  title: string;
  why: string;
  startDate: string;
  endDate: string;
}

export function GoalForm({
  initial,
  t,
  onCancel,
  onSubmit,
  submitLabel,
  showBranchOption,
}: {
  initial?: Partial<GoalDraft>;
  t: TFn;
  onCancel: () => void;
  onSubmit: (draft: GoalDraft, withBranch: boolean) => void;
  submitLabel: string;
  showBranchOption?: boolean;
}) {
  const [area, setArea] = useState<GoalArea>(initial?.area ?? "career");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [why, setWhy] = useState(initial?.why ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [withBranch, setWithBranch] = useState(false);

  const inputCls =
    "w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]";

  return (
    <Card pad="md" className="space-y-3 border-[var(--accent)]/40">
      {/* 领域（6 桶：5 个人生面 + 其他） */}
      <div className="flex flex-wrap gap-1.5">
        {GOAL_AREAS.map((a) => {
          const active = area === a;
          const color = AREA_COLORS[a];
          return (
            <button
              key={a}
              type="button"
              onClick={() => setArea(a)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition"
              style={
                active
                  ? { borderColor: color, color, background: `color-mix(in srgb, ${color} 15%, transparent)` }
                  : { borderColor: "var(--line)", color: "var(--fg-dim)" }
              }
            >
              <AreaIcon area={a} className="h-3.5 w-3.5" color={active ? color : "currentColor"} />
              {t(GOAL_AREA_LABELS[a])}
            </button>
          );
        })}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("长期目标标题（如 成为产品负责人）")}
        className={inputCls}
        autoFocus
      />
      <textarea
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        placeholder={t("为什么想做到它？（可选）")}
        rows={2}
        className={`${inputCls} resize-none`}
      />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5 text-[var(--fg-faint)]">
          {t("开始")}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)] [color-scheme:light]"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[var(--fg-faint)]">
          {t("结束")}
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)] [color-scheme:light]"
          />
        </label>
      </div>

      {showBranchOption && (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--fg-dim)]">
          <input
            type="checkbox"
            checked={withBranch}
            onChange={(e) => setWithBranch(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          <IconTree className="h-3.5 w-3.5 flex-shrink-0" />
          {t("成长为人生树的一条分支（AI 推演这条路的未来）")}
        </label>
      )}

      <div className="flex justify-end gap-2 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-xs text-[var(--fg-faint)] transition hover:text-[var(--fg)]"
        >
          {t("取消")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!title.trim()) return;
            onSubmit({ area, title: title.trim(), why: why.trim(), startDate, endDate }, withBranch);
          }}
          className="rounded-full border border-[var(--accent)]/60 bg-[var(--accent)]/10 px-3 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
        >
          {submitLabel}
        </button>
      </div>
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 统一「建立目标」表单：顶部 长期/短期 类型切换 + 共用字段（标题/why/领域）。
//   长期目标：无起始日期；保留「成长为人生树分支」选项（仅长期上树）。
//   短期目标：起止日期，startDate 默认今天（today 由上层注入，render 内不取 new Date）。
// 提交时按当前类型回调；不复用 GoalForm（编辑路径保持原样）。
// ───────────────────────────────────────────────────────────────────────────
export function CreateGoalForm({
  t,
  today,
  onCancel,
  onSubmitLong,
  onSubmitShort,
}: {
  t: TFn;
  today: string;
  onCancel: () => void;
  onSubmitLong: (
    draft: { area: GoalArea; title: string; why: string; endDate: string },
    withBranch: boolean,
  ) => void;
  onSubmitShort: (draft: {
    area: GoalArea;
    title: string;
    why: string;
    startDate: string;
    endDate: string;
  }) => void;
}) {
  const [kind, setKind] = useState<GoalKind>("long");
  const [area, setArea] = useState<GoalArea>("career");
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [startDate, setStartDate] = useState(today); // 短期目标默认今天
  const [endDate, setEndDate] = useState("");
  const [withBranch, setWithBranch] = useState(false);

  const inputCls =
    "w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]";

  function submit() {
    if (!title.trim()) return;
    if (kind === "long") {
      onSubmitLong({ area, title: title.trim(), why: why.trim(), endDate }, withBranch);
    } else {
      onSubmitShort({ area, title: title.trim(), why: why.trim(), startDate, endDate });
    }
  }

  return (
    <Card pad="md" className="space-y-3 border-[var(--accent)]/40">
      {/* 类型切换（segmented control）：长期目标 / 短期目标 */}
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
          {t("类型")}
        </div>
        <div role="radiogroup" aria-label={t("类型")} className="inline-flex rounded-full border border-[var(--line)] p-0.5">
          {(["long", "short"] as const).map((k) => {
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setKind(k)}
                className={`rounded-full px-4 py-1 text-xs transition ${
                  active
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "text-[var(--fg-dim)] hover:text-[var(--fg)]"
                }`}
              >
                {k === "long" ? t("长期目标") : t("短期目标")}
              </button>
            );
          })}
        </div>
      </div>

      {/* 领域（6 桶：5 个人生面 + 其他） */}
      <div className="flex flex-wrap gap-1.5">
        {GOAL_AREAS.map((a) => {
          const active = area === a;
          const color = AREA_COLORS[a];
          return (
            <button
              key={a}
              type="button"
              onClick={() => setArea(a)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition"
              style={
                active
                  ? { borderColor: color, color, background: `color-mix(in srgb, ${color} 15%, transparent)` }
                  : { borderColor: "var(--line)", color: "var(--fg-dim)" }
              }
            >
              <AreaIcon area={a} className="h-3.5 w-3.5" color={active ? color : "currentColor"} />
              {t(GOAL_AREA_LABELS[a])}
            </button>
          );
        })}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
        placeholder={
          kind === "long"
            ? t("长期目标标题（如 成为产品负责人）")
            : t("短期目标标题（如 这周运动 10 小时）")
        }
        aria-label={kind === "long" ? t("长期目标标题") : t("短期目标标题")}
        className={inputCls}
        autoFocus
      />
      <textarea
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        placeholder={t("为什么想做到它？（可选）")}
        rows={2}
        className={`${inputCls} resize-none`}
      />

      {/* 长期目标无起始日期；短期目标显示起止日期（起始默认今天） */}
      {kind === "short" && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-[var(--fg-faint)]">
            {t("开始")}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)] [color-scheme:light]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[var(--fg-faint)]">
            {t("结束")}
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)] [color-scheme:light]"
            />
          </label>
        </div>
      )}

      {/* 成长为分支：仅长期目标 */}
      {kind === "long" && (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--fg-dim)]">
          <input
            type="checkbox"
            checked={withBranch}
            onChange={(e) => setWithBranch(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          <IconTree className="h-3.5 w-3.5 flex-shrink-0" />
          {t("成长为人生树的一条分支（AI 推演这条路的未来）")}
        </label>
      )}

      <div className="flex justify-end gap-2 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-xs text-[var(--fg-faint)] transition hover:text-[var(--fg)]"
        >
          {t("取消")}
        </button>
        <button
          type="button"
          onClick={submit}
          className="rounded-full border border-[var(--accent)]/60 bg-[var(--accent)]/10 px-3 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
        >
          {t("建立目标")}
        </button>
      </div>
    </Card>
  );
}

// 目标标签行：chips + ＋标签。
function GoalTagRow({ goal, t }: { goal: Goal; t: TFn }) {
  const { addGoalTagById, removeGoalTagById } = useApp();
  const [newTag, setNewTag] = useState("");
  const tags = goal.tags ?? [];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] text-[var(--accent)]"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeGoalTagById(goal.id, tag)}
            className="ml-0.5 opacity-60 transition hover:opacity-100"
            aria-label={`${t("移除标签")} ${tag}`}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        value={newTag}
        onChange={(e) => setNewTag(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing && newTag.trim()) {
            addGoalTagById(goal.id, newTag.trim());
            setNewTag("");
          }
        }}
        placeholder={t("＋标签")}
        className="w-16 rounded-full border border-[var(--line)] bg-transparent px-2 py-0.5 text-[10px] text-[var(--fg-dim)] outline-none transition focus:border-[var(--accent)] focus:text-[var(--fg)] placeholder:text-[var(--fg-faint)]"
      />
    </div>
  );
}

// 起止时间范围展示 + 编辑（行内 toggle）。
function DateRange({ goal, t }: { goal: Goal; t: TFn }) {
  const { updateGoal } = useApp();
  const [open, setOpen] = useState(false);
  const fmt = (s?: string) => s || "—";

  if (open) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5 text-[var(--fg-faint)]">
          {t("开始")}
          <input
            type="date"
            value={goal.startDate ?? ""}
            onChange={(e) => updateGoal(goal.id, { startDate: e.target.value || undefined })}
            className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-0.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)] [color-scheme:light]"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[var(--fg-faint)]">
          {t("结束")}
          <input
            type="date"
            value={goal.endDate ?? ""}
            onChange={(e) => updateGoal(goal.id, { endDate: e.target.value || undefined })}
            className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-0.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)] [color-scheme:light]"
          />
        </label>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-[var(--accent)] transition hover:underline"
        >
          {t("完成")}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-faint)] transition hover:text-[var(--fg-dim)]"
    >
      <IconCalendar className="h-3.5 w-3.5" />
      {goal.startDate || goal.endDate ? `${fmt(goal.startDate)} → ${fmt(goal.endDate)}` : t("设置时间范围")}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// AI 拆成短期目标 预览面板：把 fetchGoalDecomposition 的结果按 指标/任务/习惯/短期目标
// 分组展示，每条带勾选框（默认勾选）。「全部添加」只把勾选的折进目标（applyGoalDecomposition，
// 纯新增、可删除）；「忽略」丢弃面板。不勾选的不会进规划。
// ───────────────────────────────────────────────────────────────────────────
function CheckRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-black/[0.03]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1 text-sm text-[var(--fg)]">{children}</span>
    </label>
  );
}

function GroupHeader({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
      <span aria-hidden="true" className="inline-flex">{icon}</span>
      {label}
    </div>
  );
}

function DecomposePanel({
  goalId,
  dec,
  t,
  onApplied,
  onIgnore,
}: {
  goalId: string;
  dec: GoalDecomposition;
  t: TFn;
  onApplied: () => void;
  onIgnore: () => void;
}) {
  const { applyGoalDecomposition } = useApp();
  // 勾选状态：用稳定 key（m{i} / t{i} / h{i} / sg{i} / sg{i}-m{j} …），默认全勾。
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    dec.metrics.forEach((_, i) => (init[`m${i}`] = true));
    dec.tasks.forEach((_, i) => (init[`t${i}`] = true));
    dec.habits.forEach((_, i) => (init[`h${i}`] = true));
    dec.subgoals.forEach((sg, i) => {
      init[`sg${i}`] = true;
      sg.metrics.forEach((_, j) => (init[`sg${i}-m${j}`] = true));
      sg.tasks.forEach((_, j) => (init[`sg${i}-t${j}`] = true));
      sg.habits.forEach((_, j) => (init[`sg${i}-h${j}`] = true));
    });
    return init;
  });
  const on = (k: string) => checked[k] ?? false;
  const toggle = (k: string) => setChecked((c) => ({ ...c, [k]: !c[k] }));

  const habitLabel = (h: GoalDecomposition["habits"][number]) =>
    h.repeat === "daily"
      ? t("每日")
      : h.repeatWeekday != null
        ? `${t("每周")} · ${t(WEEKDAY_KEYS[h.repeatWeekday])}`
        : t("每周");
  const metricLabel = (m: GoalDecomposition["metrics"][number]) =>
    `${m.label} · ${m.target}${m.unit}`;

  // 收集勾选项 → 过滤后的 GoalDecomposition（短期目标本体未勾则整组跳过）。
  function applyChecked() {
    const filtered: GoalDecomposition = {
      metrics: dec.metrics.filter((_, i) => on(`m${i}`)),
      tasks: dec.tasks.filter((_, i) => on(`t${i}`)),
      habits: dec.habits.filter((_, i) => on(`h${i}`)),
      subgoals: dec.subgoals
        .map((sg, i) => ({ sg, i }))
        .filter(({ i }) => on(`sg${i}`))
        .map(({ sg, i }) => ({
          title: sg.title,
          metrics: sg.metrics.filter((_, j) => on(`sg${i}-m${j}`)),
          tasks: sg.tasks.filter((_, j) => on(`sg${i}-t${j}`)),
          habits: sg.habits.filter((_, j) => on(`sg${i}-h${j}`)),
        })),
    };
    const nothing =
      !filtered.metrics.length &&
      !filtered.tasks.length &&
      !filtered.habits.length &&
      !filtered.subgoals.length;
    if (nothing) {
      onApplied();
      return;
    }
    applyGoalDecomposition(goalId, filtered);
    onApplied();
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/[0.05] p-3">
      <div className="text-xs leading-relaxed text-[var(--fg-dim)]">
        {t("AI 拆好了这些建议。勾掉不要的，点「全部添加」才会进规划——只会新增，随时能删。")}
      </div>

      {/* 指标 */}
      {dec.metrics.length > 0 && (
        <div className="space-y-0.5">
          <GroupHeader icon={<IconChart className="h-3 w-3" />} label={t("指标")} />
          {dec.metrics.map((m, i) => (
            <CheckRow key={`m${i}`} checked={on(`m${i}`)} onToggle={() => toggle(`m${i}`)}>
              {metricLabel(m)}
            </CheckRow>
          ))}
        </div>
      )}

      {/* 任务 */}
      {dec.tasks.length > 0 && (
        <div className="space-y-0.5">
          <GroupHeader icon={<IconCheckCircle className="h-3 w-3" />} label={t("任务")} />
          {dec.tasks.map((task, i) => (
            <CheckRow key={`t${i}`} checked={on(`t${i}`)} onToggle={() => toggle(`t${i}`)}>
              {task.text}
            </CheckRow>
          ))}
        </div>
      )}

      {/* 习惯 */}
      {dec.habits.length > 0 && (
        <div className="space-y-0.5">
          <GroupHeader icon={<IconRepeat className="h-3 w-3" />} label={t("习惯")} />
          {dec.habits.map((h, i) => (
            <CheckRow key={`h${i}`} checked={on(`h${i}`)} onToggle={() => toggle(`h${i}`)}>
              {h.text}
              <span className="ml-1.5 rounded-full border border-[var(--accent)]/30 px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                {habitLabel(h)}
              </span>
            </CheckRow>
          ))}
        </div>
      )}

      {/* 短期目标（含其指标/任务/习惯） */}
      {dec.subgoals.length > 0 && (
        <div className="space-y-2">
          <GroupHeader icon="↳" label={t("短期目标")} />
          {dec.subgoals.map((sg, i) => (
            <div
              key={`sg${i}`}
              className="rounded-lg border border-[var(--line)] bg-black/[0.02] p-2"
            >
              <CheckRow checked={on(`sg${i}`)} onToggle={() => toggle(`sg${i}`)}>
                <span className="font-medium">{sg.title}</span>
              </CheckRow>
              {on(`sg${i}`) && (
                <div className="ml-5 mt-1 space-y-0.5 border-l border-[var(--line)] pl-2">
                  {sg.metrics.map((m, j) => (
                    <CheckRow
                      key={`sg${i}-m${j}`}
                      checked={on(`sg${i}-m${j}`)}
                      onToggle={() => toggle(`sg${i}-m${j}`)}
                    >
                      <span className="inline-flex items-center gap-1.5 text-[var(--fg-dim)]">
                        <IconChart className="h-3 w-3 flex-shrink-0" />
                        {metricLabel(m)}
                      </span>
                    </CheckRow>
                  ))}
                  {sg.tasks.map((task, j) => (
                    <CheckRow
                      key={`sg${i}-t${j}`}
                      checked={on(`sg${i}-t${j}`)}
                      onToggle={() => toggle(`sg${i}-t${j}`)}
                    >
                      <span className="inline-flex items-center gap-1.5 text-[var(--fg-dim)]">
                        <IconCheckCircle className="h-3 w-3 flex-shrink-0" />
                        {task.text}
                      </span>
                    </CheckRow>
                  ))}
                  {sg.habits.map((h, j) => (
                    <CheckRow
                      key={`sg${i}-h${j}`}
                      checked={on(`sg${i}-h${j}`)}
                      onToggle={() => toggle(`sg${i}-h${j}`)}
                    >
                      <span className="inline-flex items-center gap-1.5 text-[var(--fg-dim)]">
                        <IconRepeat className="h-3 w-3 flex-shrink-0" />
                        {h.text}
                        <span className="ml-1.5 text-[var(--fg-faint)]">{habitLabel(h)}</span>
                      </span>
                    </CheckRow>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 底部：全部添加 / 忽略 */}
      <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] pt-2.5">
        <button
          type="button"
          onClick={onIgnore}
          className="rounded-full px-3 py-1.5 text-xs text-[var(--fg-faint)] transition hover:text-[var(--fg)]"
        >
          {t("忽略")}
        </button>
        <button
          type="button"
          onClick={applyChecked}
          className="rounded-full border border-[var(--accent)]/60 bg-[var(--accent)]/10 px-3 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
        >
          {t("全部添加")}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 短期目标卡 ShortGoalCard：标题（行内可改）+ 自己的进度条 + 起止时间 +
// 自己的三组（指标/任务/习惯）+ 删除。嵌在长期目标卡内。短期目标不上树，无「成长为分支」。
// ───────────────────────────────────────────────────────────────────────────
export function ShortGoalCard({
  short,
  progress,
  t,
  focused,
  onFocused,
}: {
  short: Goal;
  progress: number;
  t: TFn;
  focused?: boolean;
  onFocused?: () => void;
}) {
  const { updateGoal, removeGoalById, completeGoalById, planShortGoal, applyShortPlan } = useApp();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(short.title);
  const cardRef = useRef<HTMLDivElement>(null);
  const color = AREA_COLORS[short.area];
  const done = short.status === "done";

  // 「AI 规划这一段」：planning（loading）/ preview（方案预览）/ empty（这段没有可排的项）。
  const [planning, setPlanning] = useState(false);
  const [preview, setPreview] = useState<PlanShortResult | null>(null);
  const [noneToPlan, setNoneToPlan] = useState(false);

  // 是否值得显示 AI 按钮：有时间窗（短期目标常有起/止）且有未排期任务或每周习惯。
  const hasWindow = !!(short.startDate || short.endDate);
  const unscheduledTasks = (short.tasks ?? []).filter((tk) => !tk.repeat && !tk.scheduledDate && !tk.done);
  const weeklyHabits = (short.tasks ?? []).filter((h) => h.repeat === "weekly");
  const canPlan = hasWindow && (unscheduledTasks.length > 0 || weeklyHabits.length > 0);

  // 预览里需要的任务/习惯文本（按 id 查），用于「任务X → 6月25日」「习惯Y → 每周三」。
  const taskTextById = (id: string) => (short.tasks ?? []).find((tk) => tk.id === id)?.text ?? id;
  const habitTextById = (id: string) => (short.tasks ?? []).find((h) => h.id === id)?.text ?? id;

  async function runPlan() {
    if (planning) return;
    setNoneToPlan(false);
    setPlanning(true);
    try {
      const plan = await planShortGoal(short.id);
      if (!plan || (!Object.keys(plan.taskDates).length && !Object.keys(plan.habitWeekdays).length)) {
        setNoneToPlan(true);
      } else {
        setPreview(plan);
      }
    } catch {
      setNoneToPlan(true);
    } finally {
      setPlanning(false);
    }
  }

  // 从「收藏」「全部任务」等处跳来聚焦本短期目标：居中滚入，然后清掉聚焦标记。
  useEffect(() => {
    if (!focused) return;
    cardRef.current?.scrollIntoView({ block: "center" });
    onFocused?.();
  }, [focused, onFocused]);

  function commitTitle() {
    const v = titleDraft.trim();
    if (v && v !== short.title) updateGoal(short.id, { title: v });
    else setTitleDraft(short.title);
    setEditingTitle(false);
  }

  return (
    <div
      ref={cardRef}
      className={`rounded-xl border border-[var(--line)] bg-black/[0.02] p-3 ${
        done ? "opacity-70" : ""
      } ${focused ? "ring-1 ring-[var(--accent)]/60" : ""}`}
    >
      {/* 标题行 */}
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden="true" className="text-xs text-[var(--fg-dim)]">↳</span>
        {editingTitle ? (
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) commitTitle();
              else if (e.key === "Escape") {
                setTitleDraft(short.title);
                setEditingTitle(false);
              }
            }}
            onBlur={commitTitle}
            aria-label={t("短期目标标题")}
            className="min-w-0 flex-1 rounded-lg border border-[var(--accent)]/50 bg-[var(--bg-2)] px-2 py-1 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(short.title);
              setEditingTitle(true);
            }}
            aria-label={t("编辑短期目标标题")}
            title={t("编辑")}
            className={`min-w-0 flex-1 truncate text-left text-sm font-medium transition hover:text-[var(--accent)] ${
              done ? "text-[var(--fg-dim)] line-through" : "text-[var(--fg)]"
            }`}
          >
            {short.title}
          </button>
        )}
        {done && (
          <span className="flex-shrink-0 rounded-full border border-[var(--c-emerald)]/40 bg-[var(--c-emerald)]/10 px-2 py-0.5 text-[10px] text-[var(--c-emerald)]">
            {t("已达成")}
          </span>
        )}
        <IconButton label={t("编辑短期目标标题")} onClick={() => { setTitleDraft(short.title); setEditingTitle(true); }}>
          <IconPencil className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          label={t("删除短期目标")}
          danger
          onClick={() => {
            if (confirm(t("删除这个短期目标？它名下的任务、习惯、指标都会一起删除。"))) {
              removeGoalById(short.id);
            }
          }}
        >
          ✕
        </IconButton>
      </div>

      {/* 短期目标自己的进度条 */}
      <div className="mb-2 flex items-center gap-2">
        <ProgressBar value={progress} color={color} />
        <span className="flex-shrink-0 text-[11px] tabular-nums text-[var(--fg-faint)]">
          {t("进度 {pct}%", { pct: Math.round(progress * 100) })}
        </span>
      </div>

      {/* 起止时间（短期目标时间盒） */}
      <div className="mb-3">
        <DateRange goal={short} t={t} />
      </div>

      {/* 短期目标自己的 指标/任务/习惯 */}
      <ItemGroups
        goalId={short.id}
        metrics={short.metrics ?? []}
        tasks={(short.tasks ?? []).filter((tk) => !tk.repeat)}
        habits={(short.tasks ?? []).filter((tk) => tk.repeat)}
        t={t}
        habitHint
      />

      {/* AI 规划这一段：在时间窗内按合理频率排未排期任务 + 给每周习惯定星期几（预览→应用）。 */}
      {!done && canPlan && (
        <div className="mt-3">
          {!preview && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runPlan}
                disabled={planning}
                aria-label={t("AI 规划这一段")}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-3 py-1 text-[11px] text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:opacity-60"
              >
                {!planning && <IconSparkle className="h-3.5 w-3.5" />}
                {planning ? t("正在规划…") : t("AI 规划这一段")}
              </button>
              {noneToPlan && (
                <span className="text-[11px] text-[var(--fg-faint)]">{t("这段没有可排的任务")}</span>
              )}
            </div>
          )}

          {preview && (
            <div className="space-y-2.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/[0.05] p-3">
              <div className="text-xs leading-relaxed text-[var(--fg-dim)]">
                {t("AI 把这段铺成了下面的安排。应用后任务会排到对应日期、每周习惯会定到对应星期几。")}
              </div>

              {/* 任务 → 日期 */}
              {Object.entries(preview.taskDates).length > 0 && (
                <div className="space-y-1">
                  {Object.entries(preview.taskDates).map(([id, date]) => (
                    <div
                      key={id}
                      className="flex items-center gap-1.5 text-sm text-[var(--fg)]"
                    >
                      <IconCalendar className="h-3.5 w-3.5 flex-shrink-0 text-[var(--fg-faint)]" />
                      <span className="min-w-0 truncate">
                        {t("{text} → {date}", { text: taskTextById(id), date: monthDay(date) })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 每周习惯 → 星期几 */}
              {Object.entries(preview.habitWeekdays).length > 0 && (
                <div className="space-y-1">
                  {Object.entries(preview.habitWeekdays).map(([id, wd]) => (
                    <div
                      key={id}
                      className="flex items-center gap-1.5 text-sm text-[var(--fg)]"
                    >
                      <IconRepeat className="h-3.5 w-3.5 flex-shrink-0 text-[var(--fg-faint)]" />
                      <span className="min-w-0 truncate">
                        {t("{text} → {wd}", {
                          text: habitTextById(id),
                          // 用整条「每周X」键（zh→「每周三」；en→「Weekly (Wed)」），避免拼接出「每周周三」。
                          wd: t(`每周${WEEKDAY_TAIL[((wd % 7) + 7) % 7]}`),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] pt-2.5">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-full px-3 py-1.5 text-xs text-[var(--fg-faint)] transition hover:text-[var(--fg)]"
                >
                  {t("取消")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    applyShortPlan(preview);
                    setPreview(null);
                  }}
                  className="rounded-full border border-[var(--accent)]/60 bg-[var(--accent)]/10 px-3 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
                >
                  {t("应用")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 标记达成 */}
      {!done && (
        <div className="mt-3 border-t border-[var(--line)] pt-2.5">
          <button
            type="button"
            onClick={() => completeGoalById(short.id)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c-emerald)]/50 px-3 py-1 text-[11px] text-[var(--c-emerald)] transition hover:bg-[var(--c-emerald)]/10"
          >
            <IconCheckCircle className="h-3.5 w-3.5" />
            {t("标记达成")}
          </button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 长期目标卡 LongGoalCard：可折叠。头部 = 标题/why/进度（旗下综合）/时间范围/领域/⭐/标签/状态。
// 展开体 = 目标级指标 + 「AI 拆成短期目标」+ 短期目标列表 + ＋短期目标。
// 仅长期目标显示「成长为分支」。
// ───────────────────────────────────────────────────────────────────────────
export function LongGoalCard({
  goal,
  shorts,
  t,
  focusGoalId,
  onFocused,
}: {
  goal: Goal;
  shorts: Goal[];
  t: TFn;
  focusGoalId: string | null;
  onFocused: () => void;
}) {
  const {
    tree,
    openPath,
    updateGoal,
    removeGoalById,
    completeGoalById,
    addShortGoal,
    addLongGoalWithBranch,
    toggleGoalFavorite,
  } = useApp();
  // 聚焦跳转时强制展开（默认也是展开）；用 prop 直接驱动初值，避免在 effect 里同步 setState。
  const [expanded, setExpanded] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  const focusedSelf = focusGoalId === goal.id;
  // 聚焦本卡或旗下任一短期目标 → 展开 + 滚入。
  const focusedChild = !!focusGoalId && shorts.some((s) => s.id === focusGoalId);

  useEffect(() => {
    if (!focusedSelf) return;
    cardRef.current?.scrollIntoView({ block: "center" });
    onFocused();
  }, [focusedSelf, onFocused]);

  const [editing, setEditing] = useState(false);
  const [addingShort, setAddingShort] = useState(false);
  // AI 拆成短期目标：loading / 结果 / 出错（即便有兜底也兜不住时）。
  const [decomposing, setDecomposing] = useState(false);
  const [decomposition, setDecomposition] = useState<GoalDecomposition | null>(null);
  const [decomposeError, setDecomposeError] = useState(false);

  async function runDecompose() {
    if (decomposing) return;
    setDecomposeError(false);
    setDecomposing(true);
    try {
      const dec = await fetchGoalDecomposition(goal);
      setDecomposition(dec);
    } catch {
      setDecomposeError(true);
    } finally {
      setDecomposing(false);
    }
  }

  const color = AREA_COLORS[goal.area];
  // 长期目标进度 = 旗下综合（goalProgress 对 long 做 roll-up）。tree 不会为空（PlanScreen 已守卫）。
  const progress = useMemo(() => (tree ? goalProgress(tree, goal) : 0), [tree, goal]);
  const done = goal.status === "done";

  if (editing) {
    return (
      <GoalForm
        initial={{
          area: goal.area,
          title: goal.title,
          why: goal.why,
          startDate: goal.startDate ?? "",
          endDate: goal.endDate ?? "",
        }}
        t={t}
        submitLabel={t("保存")}
        onCancel={() => setEditing(false)}
        onSubmit={(d) => {
          updateGoal(goal.id, {
            area: d.area,
            title: d.title,
            why: d.why,
            startDate: d.startDate || undefined,
            endDate: d.endDate || undefined,
          });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <Card
      ref={cardRef}
      pad="md"
      className={`${done ? "opacity-70" : ""} ${focusedSelf ? "ring-1 ring-[var(--accent)]/60" : ""}`}
    >
      {/* 头部 */}
      <div className="flex items-start gap-2">
        {/* 编辑：卡片头部最左角，切换行内 GoalForm 编辑 */}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={t("编辑")}
          title={t("编辑")}
          className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[var(--fg-faint)] transition hover:bg-black/[0.04] hover:text-[var(--fg)]"
        >
          <IconPencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? t("收起") : t("展开")}
          aria-expanded={expanded}
          className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-xs text-[var(--fg-faint)] transition hover:text-[var(--fg)]"
        >
          {expanded ? "▾" : "▸"}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[var(--fg-faint)]">
              {t("长期目标")}
            </span>
            <span
              className={`min-w-0 text-base font-bold ${done ? "text-[var(--fg-dim)] line-through" : "text-[var(--fg)]"}`}
            >
              {goal.title}
            </span>
            {done && (
              <span className="flex-shrink-0 rounded-full border border-[var(--c-emerald)]/40 bg-[var(--c-emerald)]/10 px-2 py-0.5 text-[10px] text-[var(--c-emerald)]">
                {t("已达成")}
              </span>
            )}
          </div>
          {goal.why && (
            <div className="mt-1 text-xs leading-relaxed text-[var(--fg-dim)]">{goal.why}</div>
          )}
        </div>
        {/* 收藏（star）：填充=已收藏。进侧边栏「收藏」组。 */}
        <button
          type="button"
          onClick={() => toggleGoalFavorite(goal.id)}
          aria-label={goal.favorite ? t("取消收藏") : t("收藏")}
          aria-pressed={!!goal.favorite}
          title={goal.favorite ? t("取消收藏") : t("收藏")}
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[13px] transition hover:bg-black/[0.04] ${
            goal.favorite ? "text-[var(--c-amber)]" : "text-[var(--fg-faint)] hover:text-[var(--fg)]"
          }`}
        >
          {goal.favorite ? "★" : "☆"}
        </button>
        <span
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
          style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
        >
          <AreaIcon area={goal.area} className="h-3 w-3" color="currentColor" />
          {t(GOAL_AREA_LABELS[goal.area])}
        </span>
      </div>

      {/* 进度条（旗下综合） */}
      <div className="mt-3 flex items-center gap-2">
        <ProgressBar value={progress} color={color} />
        <span className="flex-shrink-0 text-xs tabular-nums text-[var(--fg-faint)]">
          {t("进度 {pct}%", { pct: Math.round(progress * 100) })}
        </span>
      </div>

      {/* 时间范围 + 标签 */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <DateRange goal={goal} t={t} />
      </div>
      <div className="mt-2">
        <GoalTagRow goal={goal} t={t} />
      </div>

      {/* 在树上看（仅有分支的长期目标） */}
      {goal.pathId && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => goal.pathId && openPath(goal.pathId)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/50 px-3 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
          >
            <IconChart className="h-3.5 w-3.5" />
            {t("在树上看这条路")}
          </button>
        </div>
      )}

      {/* 展开体 */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-[var(--line)] pt-3">
          {/* 目标级 指标（长期目标可有自己的直挂指标） */}
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
              {t("目标级指标")}
            </div>
            <GoalLevelMetrics goal={goal} t={t} />
          </div>

          {/* AI 拆成短期目标：按钮 → 预览面板（勾选后才落地为短期目标） */}
          {!decomposition && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runDecompose}
                disabled={decomposing}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-3 py-1 text-[11px] text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:opacity-60"
              >
                {!decomposing && <IconSparkle className="h-3.5 w-3.5" />}
                {decomposing ? t("AI 正在拆解…") : t("AI 拆成短期目标")}
              </button>
              {decomposeError && (
                <span className="text-[11px] text-[var(--c-rose)]">{t("稍后再试")}</span>
              )}
            </div>
          )}
          {decomposition && (
            <DecomposePanel
              goalId={goal.id}
              dec={decomposition}
              t={t}
              onApplied={() => setDecomposition(null)}
              onIgnore={() => setDecomposition(null)}
            />
          )}

          {/* 短期目标列表 */}
          {(shorts.length > 0 || focusedChild) && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
                {t("短期目标")}
              </div>
              {shorts.map((s) => (
                <ShortGoalCard
                  key={s.id}
                  short={s}
                  progress={tree ? goalProgress(tree, s) : 0}
                  t={t}
                  focused={focusGoalId === s.id}
                  onFocused={onFocused}
                />
              ))}
            </div>
          )}

          {/* ＋短期目标 */}
          {addingShort ? (
            <InlineTextAdd
              placeholder={t("短期目标（如 三个月内通过产品面试）")}
              onAdd={(title) => addShortGoal(goal.id, { title })}
              onCancel={() => setAddingShort(false)}
            />
          ) : (
            <AddChip label={t("＋ 短期目标")} onClick={() => setAddingShort(true)} />
          )}
        </div>
      )}

      {/* 底部操作 */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3 text-xs">
        {!done && (
          <button
            type="button"
            onClick={() => completeGoalById(goal.id)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c-emerald)]/50 px-3 py-1 text-[var(--c-emerald)] transition hover:bg-[var(--c-emerald)]/10"
          >
            <IconCheckCircle className="h-3.5 w-3.5" />
            {t("标记达成")}
          </button>
        )}
        {/* 仅长期目标可成长为人生树分支 */}
        {!goal.pathId && (
          <button
            type="button"
            onClick={() =>
              addLongGoalWithBranch({
                area: goal.area,
                title: goal.title,
                why: goal.why,
                startDate: goal.startDate,
                endDate: goal.endDate,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/50 px-3 py-1 text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
          >
            <IconTree className="h-3.5 w-3.5" />
            {t("成长为分支")}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(t("确定移除这个长期目标？它的短期目标、任务、习惯、指标都会一起删除；关联的人生树分支也会被剪掉。"))) {
              removeGoalById(goal.id);
            }
          }}
          className="ml-auto rounded-full border border-[var(--line)] px-3 py-1 text-[var(--fg-faint)] transition hover:text-[var(--c-rose)]"
        >
          {t("移除")}
        </button>
      </div>
    </Card>
  );
}

// 目标级指标小区块：列出长期目标自己的指标 + ＋指标。
function GoalLevelMetrics({ goal, t }: { goal: Goal; t: TFn }) {
  const { setMetric } = useApp();
  const [adding, setAdding] = useState(false);
  const metrics = goal.metrics ?? [];
  return (
    <div className="space-y-1.5">
      {metrics.map((m) => (
        <MetricRow key={m.id} metric={m} ownerId={goal.id} t={t} />
      ))}
      {adding ? (
        <MetricEditor
          t={t}
          onCancel={() => setAdding(false)}
          onSave={(m) => {
            setMetric(goal.id, m);
            setAdding(false);
          }}
        />
      ) : (
        <AddChip label={t("＋ 指标")} onClick={() => setAdding(true)} />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// PlanScreen：领域分组 → 长期目标卡（旗下短期目标 → 指标/任务/习惯），全层级 CRUD。
// ───────────────────────────────────────────────────────────────────────────
