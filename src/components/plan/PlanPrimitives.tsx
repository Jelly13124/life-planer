"use client";

import { useState, type ReactNode } from "react";
import { useApp } from "@/state/AppContext";
import type { Metric, Task } from "@/domain/types";
import { IconChart, IconPencil, IconRepeat } from "../ui/icons";

const WEEKDAY_KEYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;
type TFn = (zh: string, vars?: Record<string, string | number>) => string;

export function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] text-[var(--fg-faint)] transition hover:bg-black/[0.04] ${
        danger ? "hover:text-[var(--c-rose)]" : "hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.round(value * 100)}%`, background: color ?? "var(--accent)" }}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 指标 Metric：标签 · current/target unit · 进度条 · −/＋ 微调 · 编辑 · 删除。
// ownerId = 目标 id（长期或短期皆可）。
// ───────────────────────────────────────────────────────────────────────────
export function MetricRow({
  metric,
  ownerId,
  t,
}: {
  metric: Metric;
  ownerId: string;
  t: TFn;
}) {
  const { bumpMetric, setMetric, removeMetric } = useApp();
  const [editing, setEditing] = useState(false);
  const pct = metric.target > 0 ? Math.max(0, Math.min(1, metric.current / metric.target)) : 0;

  if (editing) {
    return (
      <MetricEditor
        initial={metric}
        t={t}
        onCancel={() => setEditing(false)}
        onSave={(m) => {
          setMetric(ownerId, m);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-black/[0.02] px-3 py-2">
      <IconChart className="h-3.5 w-3.5 flex-shrink-0 text-[var(--fg-faint)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-sm text-[var(--fg)]">{metric.label}</span>
          <span className="flex-shrink-0 text-xs tabular-nums text-[var(--fg-dim)]">
            {metric.current}
            <span className="text-[var(--fg-faint)]"> / {metric.target}</span>
            {metric.unit && <span className="ml-0.5 text-[var(--fg-faint)]">{metric.unit}</span>}
          </span>
        </div>
        <div className="mt-1.5">
          <ProgressBar value={pct} />
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-0.5">
        <IconButton label={t("减少")} onClick={() => bumpMetric(metric.id, -1)}>
          −
        </IconButton>
        <IconButton label={t("增加")} onClick={() => bumpMetric(metric.id, 1)}>
          ＋
        </IconButton>
        <IconButton label={t("编辑指标")} onClick={() => setEditing(true)}>
          <IconPencil className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label={t("删除指标")} danger onClick={() => removeMetric(ownerId, metric.id)}>
          ✕
        </IconButton>
      </div>
    </div>
  );
}

// 指标编辑/新建表单：label / current / target / unit。
export function MetricEditor({
  initial,
  t,
  onSave,
  onCancel,
}: {
  initial?: Metric;
  t: TFn;
  onSave: (m: Metric) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [current, setCurrent] = useState(String(initial?.current ?? 0));
  const [target, setTarget] = useState(String(initial?.target ?? 100));
  const [unit, setUnit] = useState(initial?.unit ?? "");

  const inputCls =
    "rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]";

  function save() {
    if (!label.trim()) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      label: label.trim(),
      current: Number(current) || 0,
      target: Number(target) || 0,
      unit: unit.trim(),
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/[0.05] px-3 py-2.5">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t("指标名（如 存款 / 体脂）")}
        className={`w-full ${inputCls}`}
        autoFocus
      />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-[10px] text-[var(--fg-faint)]">
          {t("当前值")}
          <input
            type="number"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={`w-16 ${inputCls}`}
          />
        </label>
        <label className="flex items-center gap-1 text-[10px] text-[var(--fg-faint)]">
          {t("目标值")}
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className={`w-16 ${inputCls}`}
          />
        </label>
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder={t("单位")}
          className={`w-16 ${inputCls}`}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1 text-[11px] text-[var(--fg-faint)] transition hover:text-[var(--fg)]"
        >
          {t("取消")}
        </button>
        <button
          type="button"
          onClick={save}
          className="rounded-full border border-[var(--accent)]/50 px-3 py-1 text-[11px] text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
        >
          {t("保存")}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 任务 Task：勾选框（唯一的完成方式）+ 文本 + 删除。点击行不会切换完成。
// ───────────────────────────────────────────────────────────────────────────
export function TaskRow({ task, t }: { task: Task; t: TFn }) {
  const { toggleTodayAction, removeItemById } = useApp();
  return (
    <div className="flex items-center gap-2.5 px-1 py-1">
      {/* 仅这个勾选框切换完成，避免整行点击误标完成 */}
      <button
        type="button"
        onClick={() => toggleTodayAction(task.id)}
        aria-label={task.done ? t("标记未完成") : t("标记完成")}
        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] transition ${
          task.done
            ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]"
            : "border-[var(--line)] hover:border-[var(--accent)]"
        }`}
      >
        {task.done ? "✓" : ""}
      </button>
      <span
        className={`min-w-0 flex-1 text-sm ${
          task.done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"
        }`}
      >
        {task.text}
      </span>
      <IconButton label={t("删除任务")} danger onClick={() => removeItemById(task.id)}>
        ✕
      </IconButton>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 习惯 Habit：图标 + 文本 + 重复徽章（每日/每周+星期几）+ 删除。
// ───────────────────────────────────────────────────────────────────────────
export function HabitRow({ habit, t }: { habit: Task; t: TFn }) {
  const { removeItemById } = useApp();
  const repeatLabel =
    habit.repeat === "daily"
      ? t("每日")
      : habit.repeatWeekday != null
        ? `${t("每周")} · ${t(WEEKDAY_KEYS[habit.repeatWeekday])}`
        : t("每周");
  return (
    <div className="flex items-center gap-2.5 px-1 py-1">
      <IconRepeat className="h-3.5 w-3.5 flex-shrink-0 text-[var(--fg-faint)]" />
      <span className="min-w-0 flex-1 text-sm text-[var(--fg)]">{habit.text}</span>
      <span className="flex-shrink-0 rounded-full border border-[var(--accent)]/30 px-2 py-0.5 text-[10px] text-[var(--accent)]">
        {repeatLabel}
      </span>
      <IconButton label={t("删除习惯")} danger onClick={() => removeItemById(habit.id)}>
        ✕
      </IconButton>
    </div>
  );
}

// 习惯输入：文本 + 每日/每周切换 +（每周时）星期几。
export function HabitComposer({
  onAdd,
  t,
}: {
  onAdd: (text: string, repeat: "daily" | "weekly", weekday?: number) => void;
  t: TFn;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [repeat, setRepeat] = useState<"daily" | "weekly">("daily");
  const [weekday, setWeekday] = useState(1);

  if (!open) {
    return <AddChip label={t("＋ 习惯")} onClick={() => setOpen(true)} />;
  }

  function submit() {
    if (!text.trim()) return;
    onAdd(text.trim(), repeat, repeat === "weekly" ? weekday : undefined);
    setText("");
    setOpen(false);
  }

  return (
    <div className="space-y-2 rounded-xl border border-[var(--line)] bg-black/[0.02] px-3 py-2.5">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
        placeholder={t("习惯（如 每天读 20 页）")}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-1.5 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]"
        autoFocus
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {(["daily", "weekly"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRepeat(r)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
              repeat === r
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                : "border-[var(--line)] text-[var(--fg-dim)] hover:text-[var(--fg)]"
            }`}
          >
            {r === "daily" ? t("每日") : t("每周")}
          </button>
        ))}
        {repeat === "weekly" && (
          <select
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
            className="rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-[11px] text-[var(--fg)] outline-none focus:border-[var(--accent)] [color-scheme:light]"
          >
            {WEEKDAY_KEYS.map((k, i) => (
              <option key={k} value={i}>
                {t(k)}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full px-2.5 py-1 text-[11px] text-[var(--fg-faint)] transition hover:text-[var(--fg)]"
          >
            {t("取消")}
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-full border border-[var(--accent)]/50 px-2.5 py-1 text-[11px] text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
          >
            {t("添加")}
          </button>
        </div>
      </div>
    </div>
  );
}

// 行内"＋ 任务 / ＋ 习惯 / ＋ 指标 / ＋ 短期目标"按钮。
export function AddChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-dashed border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--fg-faint)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
    >
      {label}
    </button>
  );
}

// 行内单行文本输入（用于＋任务 /＋短期目标）：回车提交，Esc 取消。
export function InlineTextAdd({
  placeholder,
  onAdd,
  onCancel,
}: {
  placeholder: string;
  onAdd: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing && text.trim()) {
          onAdd(text.trim());
          setText("");
        } else if (e.key === "Escape") {
          onCancel();
        }
      }}
      onBlur={() => {
        if (text.trim()) onAdd(text.trim());
        onCancel();
      }}
      placeholder={placeholder}
      className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-1.5 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]"
      autoFocus
    />
  );
}

// 一组"指标 / 任务 / 习惯"列表 + 各自的添加入口。长期/短期目标共用（ownerId = goal.id）。
// habitHint：短期目标下提示习惯会被自动限制在目标时间内重复。
export function ItemGroups({
  goalId,
  metrics,
  tasks,
  habits,
  t,
  habitHint,
}: {
  goalId: string;
  metrics: Metric[];
  tasks: Task[];
  habits: Task[];
  t: TFn;
  habitHint?: boolean;
}) {
  const { addTask, addHabit, setMetric } = useApp();
  const [adding, setAdding] = useState<null | "task" | "metric">(null);

  return (
    <div className="space-y-2">
      {/* 指标 */}
      {metrics.length > 0 && (
        <div className="space-y-1.5">
          {metrics.map((m) => (
            <MetricRow key={m.id} metric={m} ownerId={goalId} t={t} />
          ))}
        </div>
      )}

      {/* 任务 */}
      {tasks.length > 0 && (
        <div>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} t={t} />
          ))}
        </div>
      )}

      {/* 习惯 */}
      {habits.length > 0 && (
        <div>
          {habits.map((h) => (
            <HabitRow key={h.id} habit={h} t={t} />
          ))}
        </div>
      )}

      {/* 行内表单 */}
      {adding === "metric" && (
        <MetricEditor
          t={t}
          onCancel={() => setAdding(null)}
          onSave={(m) => {
            setMetric(goalId, m);
            setAdding(null);
          }}
        />
      )}
      {adding === "task" && (
        <InlineTextAdd
          placeholder={t("任务（如 投 5 份简历）")}
          onAdd={(text) => addTask(goalId, text)}
          onCancel={() => setAdding(null)}
        />
      )}

      {/* 添加入口 */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <AddChip label={t("＋ 任务")} onClick={() => setAdding("task")} />
        <HabitComposer
          t={t}
          onAdd={(text, repeat, weekday) => addHabit(goalId, text, repeat, weekday)}
        />
        <AddChip label={t("＋ 指标")} onClick={() => setAdding("metric")} />
      </div>
      {habitHint && habits.length > 0 && (
        <p className="text-[10px] text-[var(--fg-faint)]">{t("习惯会在本目标时间内重复")}</p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 目标编辑器：title / why / area / 起止日期。新建 + 编辑共用。
// ───────────────────────────────────────────────────────────────────────────
