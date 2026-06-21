"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";
import { AREA_LABELS, type Goal } from "@/domain/types";
import { allTags, childGoals, daysUntilDeadline, dueGoalReviews, goalProgress } from "@/domain/goals";
import { localDay } from "@/domain/daily";
import { fetchGoalActions, fetchGoalSuggestions, type GoalSuggestion } from "@/lib/goalClient";

// 导入时取一次"今天"作初值（render 内不可调用 new Date）；挂载后用 effect 刷新。
const _bootISO = new Date().toISOString();

export function PlanScreen() {
  const { tree, openPath, addLongTermGoal, addShortTermGoal, setGoalActionTexts, toggleGoalActionById, completeGoalById, dropGoalById, markDueGoalsReviewed, planActionToday, setActionRepeatById, setGoalDeadlineById, addGoalTagById, removeGoalTagById, removeActionById } = useApp();
  const { t } = useT();

  const [todayISO, setTodayISO] = useState(_bootISO);
  useEffect(() => {
    const update = () => setTodayISO(new Date().toISOString());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [added, setAdded] = useState<string[]>([]); // 已加入的候选 title
  const [busyActions, setBusyActions] = useState<string | null>(null); // 正在拆行动的 goalId
  const [tagFilter, setTagFilter] = useState<string | null>(null); // null = 全部

  // todayDay は effect-backed todayISO から derive する（render 内で new Date() 不可）
  const todayDay = localDay(new Date(todayISO));

  const goals = useMemo(() => tree?.goals ?? [], [tree]);
  const longGoals = goals.filter((g) => g.horizon === "long");
  const allOrphanShort = goals.filter((g) => g.horizon === "short" && !g.parentGoalId);
  const allActiveLong = longGoals.filter((g) => g.status === "active");
  const doneLong = longGoals.filter((g) => g.status === "done");
  const due = tree ? dueGoalReviews(tree, todayISO) : [];

  const treeTags = tree ? allTags(tree) : [];
  // reset filter if the active tag disappears (e.g. last goal with it was removed)
  const effectiveFilter = tagFilter && treeTags.includes(tagFilter) ? tagFilter : null;

  const passesFilter = (g: (typeof goals)[number]) =>
    effectiveFilter === null || (g.tags ?? []).includes(effectiveFilter);
  const activeLong = allActiveLong.filter(passesFilter);
  const orphanShort = allOrphanShort.filter(passesFilter);

  if (!tree) return null;

  async function suggest() {
    if (suggesting || !tree) return;
    setSuggesting(true);
    const list = await fetchGoalSuggestions(tree);
    setSuggesting(false);
    setSuggestions(list);
  }

  function addSuggestion(s: GoalSuggestion) {
    if (added.includes(s.title)) return;
    if (s.horizon === "long") addLongTermGoal({ area: s.area, title: s.title, why: s.why });
    else addShortTermGoal({ area: s.area, title: s.title, why: s.why });
    setAdded((a) => [...a, s.title]);
  }

  async function breakIntoActions(goal: Goal) {
    const currentTree = tree;
    if (busyActions || !currentTree) return;
    if (goal.actions.length > 0 && !confirm(t("重新拆解会覆盖现有行动（包括已设的重复和完成状态）。继续？"))) return;
    setBusyActions(goal.id);
    const texts = await fetchGoalActions(goal, currentTree.profile.snapshot || "");
    setBusyActions(null);
    if (texts.length) setGoalActionTexts(goal.id, texts);
  }

  const crossroad = tree.profile.crossroad?.trim();
  const showCrossroadChip = Boolean(crossroad) && goals.length === 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Planning"
        title={t("我的规划")}
        subtitle={t("先定长期目标——它会在你的人生树上长出一条路；用短期目标和行动一步步逼近它。")}
      />

      {due.length > 0 && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-[var(--c-amber)]/50 bg-[var(--c-amber)]/10 px-4 py-3 text-sm text-[var(--c-amber)]">
          <span>{t("该回看目标了：有 {n} 个目标一周没动过了。", { n: due.length })}</span>
          <button onClick={markDueGoalsReviewed} className="flex-shrink-0 rounded-full border border-[var(--c-amber)]/60 px-3 py-1 text-xs transition hover:bg-[var(--c-amber)]/20">
            {t("我回看过了")}
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={suggest} disabled={suggesting}>
          {suggesting ? t("正在想几个适合你的目标…") : t("✨ 帮我想几个目标")}
        </Button>
        {showCrossroadChip && (
          <button
            onClick={() => addLongTermGoal({ area: "career", title: crossroad!, why: "" })}
            className="rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-3 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
          >
            {t("把「{label}」设成第一个长期目标", { label: crossroad! })}
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mb-6 space-y-2 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] p-4">
          <div className="text-xs font-semibold text-[var(--fg)]">
            {t("点「加入」才会进规划（长期目标会在树上长出一条路）")}
          </div>
          {suggestions.map((s) => {
            const isAdded = added.includes(s.title);
            return (
              <div key={s.title} className="flex items-start justify-between gap-2 rounded-xl border border-[var(--line)] bg-white/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--fg)]">
                    <span className="mr-1.5 rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-[var(--fg-dim)]">
                      {s.horizon === "long" ? t("长期") : t("短期")} · {t(AREA_LABELS[s.area])}
                    </span>
                    {s.title}
                  </div>
                  {s.why && <div className="mt-0.5 text-xs text-[var(--fg-dim)]">{s.why}</div>}
                </div>
                <button
                  onClick={() => addSuggestion(s)}
                  disabled={isAdded}
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] transition ${isAdded ? "text-[var(--c-emerald)]" : "border border-[var(--accent)]/50 text-[var(--accent)] hover:bg-[var(--accent)]/15"}`}
                >
                  {isAdded ? t("✓ 已加入") : t("加入")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {treeTags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {[null, ...treeTags].map((tag) => {
            const active = effectiveFilter === tag;
            return (
              <button
                key={tag ?? "__all__"}
                onClick={() => setTagFilter(tag)}
                className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]" : "border-[var(--line)] text-[var(--fg-dim)] hover:border-[var(--accent)]/50 hover:text-[var(--fg)]"}`}
              >
                {tag ?? t("全部")}
              </button>
            );
          })}
        </div>
      )}

      {activeLong.length > 0 && (
        <section className="mb-7 space-y-3">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">{t("长期目标")}</h2>
          {activeLong.map((g) => (
            <LongGoalCard
              key={g.id}
              goal={g}
              progress={goalProgress(tree, g)}
              kids={childGoals(tree, g.id)}
              breaking={busyActions === g.id}
              t={t}
              todayDay={todayDay}
              onOpenPath={() => g.pathId && openPath(g.pathId)}
              onBreak={() => breakIntoActions(g)}
              onToggle={(aid) => toggleGoalActionById(g.id, aid)}
              onComplete={() => completeGoalById(g.id)}
              onDrop={() => {
                if (confirm(t("确定移除这个目标？长期目标会连同它在树上的分支一起删除。"))) dropGoalById(g.id);
              }}
              onAddShort={(title) => addShortTermGoal({ area: g.area, title, why: "", parentGoalId: g.id })}
              onPlanToday={(aid) => planActionToday(aid)}
              onSetRepeat={(aid, r) => setActionRepeatById(g.id, aid, r)}
              onDeleteAction={(aid) => removeActionById(aid)}
              onSetDeadline={(date) => setGoalDeadlineById(g.id, date)}
              onAddTag={(tag) => addGoalTagById(g.id, tag)}
              onRemoveTag={(tag) => removeGoalTagById(g.id, tag)}
            />
          ))}
        </section>
      )}

      {orphanShort.length > 0 && (
        <section className="mb-7 space-y-3">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">{t("短期目标")}</h2>
          {orphanShort.map((g) => (
            <ShortGoalRow
              key={g.id}
              goal={g}
              breaking={busyActions === g.id}
              t={t}
              todayDay={todayDay}
              onBreak={() => breakIntoActions(g)}
              onToggle={(aid) => toggleGoalActionById(g.id, aid)}
              onComplete={() => completeGoalById(g.id)}
              onDrop={() => dropGoalById(g.id)}
              onPlanToday={(aid) => planActionToday(aid)}
              onSetRepeat={(aid, r) => setActionRepeatById(g.id, aid, r)}
              onDeleteAction={(aid) => removeActionById(aid)}
              onSetDeadline={(date) => setGoalDeadlineById(g.id, date)}
              onAddTag={(tag) => addGoalTagById(g.id, tag)}
              onRemoveTag={(tag) => removeGoalTagById(g.id, tag)}
            />
          ))}
        </section>
      )}

      {doneLong.length > 0 && (
        <section className="mb-7">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">{t("已达成的里程碑")}</h2>
          <div className="mt-3 space-y-1.5">
            {doneLong.map((g) => (
              <div key={g.id} className="flex items-center gap-2.5 rounded-xl border border-[var(--c-emerald)]/40 bg-[var(--c-emerald)]/10 px-4 py-2.5 text-sm">
                <span aria-hidden="true">🏆</span>
                <span className="min-w-0 truncate text-[var(--fg)]">{g.title}</span>
                <span className="ml-auto flex-shrink-0 text-xs text-[var(--c-emerald)]">{t("已达成 · {area}+", { area: t(AREA_LABELS[g.area]) })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {goals.length === 0 && suggestions.length === 0 && (
        <EmptyState
          className="mt-4"
          icon="🌱"
          accent="var(--accent)"
          description={t("还没有目标。让 AI 帮你想几个，看着它们在你的人生树上长出来。")}
          action={
            <Button variant="primary" onClick={suggest} disabled={suggesting}>
              {suggesting ? t("正在想几个适合你的目标…") : t("✨ 帮我想几个目标")}
            </Button>
          }
        />
      )}
    </div>
  );
}

type TFn = (zh: string, vars?: Record<string, string | number>) => string;

const REPEAT_LABEL = (t: TFn, r: "daily" | "weekly" | undefined) =>
  r === "daily" ? t("🔁每天") : r === "weekly" ? t("🔁每周") : t("🔁重复");
const NEXT_REPEAT = (r: "daily" | "weekly" | undefined): "daily" | "weekly" | undefined =>
  r === undefined ? "daily" : r === "daily" ? "weekly" : undefined;

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

function Actions({
  goal, t, onToggle, onPlanToday, onSetRepeat, onDelete,
}: {
  goal: Goal; t: TFn;
  onToggle: (actionId: string) => void;
  onPlanToday: (actionId: string) => void;
  onSetRepeat: (actionId: string, repeat: "daily" | "weekly" | undefined) => void;
  onDelete: (actionId: string) => void;
}) {
  if (goal.actions.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {goal.actions.map((a) => (
        <li key={a.id} className="flex items-center gap-2">
          {/* 仅这个勾选框切换完成，避免整行点击误标完成 */}
          <button
            onClick={() => onToggle(a.id)}
            aria-label={a.done ? t("标记未完成") : t("标记完成")}
            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] transition ${a.done ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]" : "border-[var(--line)] hover:border-[var(--accent)]"}`}
          >
            {a.done ? "✓" : ""}
          </button>
          <span className={`min-w-0 flex-1 text-sm ${a.done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}`}>{a.text}</span>
          <button
            onClick={() => onSetRepeat(a.id, NEXT_REPEAT(a.repeat))}
            className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] transition ${a.repeat ? "border-[var(--accent)]/60 text-[var(--accent)]" : "border-[var(--line)] text-[var(--fg-faint)] hover:text-[var(--fg-dim)]"}`}
          >
            {REPEAT_LABEL(t, a.repeat)}
          </button>
          {!a.repeat && !a.done && (
            <button onClick={() => onPlanToday(a.id)} className="flex-shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
              {t("＋今天")}
            </button>
          )}
          <button
            onClick={() => onDelete(a.id)}
            aria-label={t("删除任务")}
            title={t("删除任务")}
            className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[11px] text-[var(--fg-faint)] transition hover:text-[var(--c-rose)]"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

function DeadlineControl({
  goal, todayDay, t, onSetDeadline,
}: {
  goal: Goal; todayDay: string; t: TFn; onSetDeadline: (date: string | null) => void;
}) {
  const days = daysUntilDeadline(goal, todayDay);
  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <span className="text-[var(--fg-faint)]">{t("截止")}</span>
      <input
        type="date"
        value={goal.deadline ?? ""}
        onChange={(e) => onSetDeadline(e.target.value || null)}
        className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-0.5 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)] [color-scheme:dark]"
      />
      {days !== null && (
        <span
          className={
            days < 0
              ? "text-[var(--c-rose)]"
              : days === 0
                ? "text-[var(--c-amber)]"
                : "text-[var(--fg-dim)]"
          }
        >
          {days > 0
            ? t("剩 {n} 天", { n: days })
            : days === 0
              ? t("今天截止")
              : t("逾期 {n} 天", { n: -days })}
        </span>
      )}
    </div>
  );
}

function GoalTagRow({
  goal, t, onAddTag, onRemoveTag, newTag, setNewTag,
}: {
  goal: Goal; t: TFn;
  onAddTag: (tag: string) => void; onRemoveTag: (tag: string) => void;
  newTag: string; setNewTag: (v: string) => void;
}) {
  const tags = goal.tags ?? [];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] text-[var(--accent)]">
          {tag}
          <button
            onClick={() => onRemoveTag(tag)}
            className="ml-0.5 opacity-60 hover:opacity-100"
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
            onAddTag(newTag.trim());
            setNewTag("");
          }
        }}
        placeholder={t("＋标签")}
        className="w-16 rounded-full border border-[var(--line)] bg-transparent px-2 py-0.5 text-[10px] text-[var(--fg-dim)] outline-none transition focus:border-[var(--accent)] focus:text-[var(--fg)] placeholder:text-[var(--fg-faint)]"
      />
    </div>
  );
}

function LongGoalCard({
  goal, progress, kids, breaking, t, todayDay, onOpenPath, onBreak, onToggle, onComplete, onDrop, onAddShort, onPlanToday, onSetRepeat, onDeleteAction, onSetDeadline, onAddTag, onRemoveTag,
}: {
  goal: Goal; progress: number; kids: Goal[]; breaking: boolean; t: TFn; todayDay: string;
  onOpenPath: () => void; onBreak: () => void; onToggle: (actionId: string) => void;
  onComplete: () => void; onDrop: () => void; onAddShort: (title: string) => void;
  onPlanToday: (actionId: string) => void; onSetRepeat: (actionId: string, repeat: "daily" | "weekly" | undefined) => void;
  onDeleteAction: (actionId: string) => void;
  onSetDeadline: (date: string | null) => void;
  onAddTag: (tag: string) => void; onRemoveTag: (tag: string) => void;
}) {
  const [newKid, setNewKid] = useState("");
  const [newTag, setNewTag] = useState("");
  return (
    <Card pad="md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-bold text-[var(--fg)]">{goal.title}</div>
          {goal.why && <div className="mt-1 text-xs leading-relaxed text-[var(--fg-dim)]">{goal.why}</div>}
        </div>
        <span className="flex-shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--fg-dim)]">
          {t(AREA_LABELS[goal.area])}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <ProgressBar value={progress} />
        <span className="flex-shrink-0 text-xs text-[var(--fg-faint)]">{t("进度 {pct}%", { pct: Math.round(progress * 100) })}</span>
      </div>

      <DeadlineControl goal={goal} todayDay={todayDay} t={t} onSetDeadline={onSetDeadline} />

      <GoalTagRow goal={goal} t={t} onAddTag={onAddTag} onRemoveTag={onRemoveTag} newTag={newTag} setNewTag={setNewTag} />

      <div className="mt-2 flex flex-wrap gap-2">
        {goal.pathId && (
          <button onClick={onOpenPath} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--fg-dim)] transition hover:text-[var(--fg)]">
            {t("📈 在树上看这条路")}
          </button>
        )}
        {goal.pathId && (
          <button onClick={onOpenPath} className="rounded-full border border-[var(--accent)]/50 px-3 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15">
            {t("✨ 和达成目标的未来的你聊聊")}
          </button>
        )}
      </div>

      {kids.length > 0 && (
        <ul className="mt-3 space-y-1 border-l border-[var(--line)] pl-3">
          {kids.map((k) => (
            <li key={k.id} className="text-sm">
              <span className={k.status === "done" ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}>· {k.title}</span>
            </li>
          ))}
        </ul>
      )}

      <Actions goal={goal} t={t} onToggle={onToggle} onPlanToday={onPlanToday} onSetRepeat={onSetRepeat} onDelete={onDeleteAction} />

      <div className="mt-3 flex items-center gap-2">
        <input
          value={newKid}
          onChange={(e) => setNewKid(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && newKid.trim()) { onAddShort(newKid.trim()); setNewKid(""); } }}
          placeholder={t("加一个短期目标（踏脚石）")}
          className="flex-1 rounded-full border border-[var(--line)] bg-[var(--bg-2)] px-3 py-1.5 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3 text-xs">
        <button onClick={onBreak} disabled={breaking} className="rounded-full border border-[var(--accent)]/50 px-3 py-1 text-[var(--accent)] transition hover:bg-[var(--accent)]/15 disabled:opacity-50">
          {breaking ? t("正在拆解…") : t("✨ 拆成行动")}
        </button>
        <button onClick={onComplete} className="rounded-full border border-[var(--c-emerald)]/50 px-3 py-1 text-[var(--c-emerald)] transition hover:bg-[var(--c-emerald)]/10">
          {t("✅ 已达成")}
        </button>
        <button onClick={onDrop} className="ml-auto rounded-full border border-[var(--line)] px-3 py-1 text-[var(--fg-faint)] transition hover:text-[var(--c-rose)]">
          {t("移除")}
        </button>
      </div>
    </Card>
  );
}

function ShortGoalRow({
  goal, breaking, t, todayDay, onBreak, onToggle, onComplete, onDrop, onPlanToday, onSetRepeat, onDeleteAction, onSetDeadline, onAddTag, onRemoveTag,
}: {
  goal: Goal; breaking: boolean; t: TFn; todayDay: string;
  onBreak: () => void; onToggle: (actionId: string) => void; onComplete: () => void; onDrop: () => void;
  onPlanToday: (actionId: string) => void; onSetRepeat: (actionId: string, repeat: "daily" | "weekly" | undefined) => void;
  onDeleteAction: (actionId: string) => void;
  onSetDeadline: (date: string | null) => void;
  onAddTag: (tag: string) => void; onRemoveTag: (tag: string) => void;
}) {
  const [newTag, setNewTag] = useState("");
  return (
    <Card pad="md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-[var(--fg)]">{goal.title}</div>
          {goal.why && <div className="mt-1 text-xs leading-relaxed text-[var(--fg-dim)]">{goal.why}</div>}
        </div>
        <span className="flex-shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--fg-dim)]">
          {t(AREA_LABELS[goal.area])}
        </span>
      </div>
      <DeadlineControl goal={goal} todayDay={todayDay} t={t} onSetDeadline={onSetDeadline} />
      <GoalTagRow goal={goal} t={t} onAddTag={onAddTag} onRemoveTag={onRemoveTag} newTag={newTag} setNewTag={setNewTag} />
      <Actions goal={goal} t={t} onToggle={onToggle} onPlanToday={onPlanToday} onSetRepeat={onSetRepeat} onDelete={onDeleteAction} />
      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3 text-xs">
        <button onClick={onBreak} disabled={breaking} className="rounded-full border border-[var(--accent)]/50 px-3 py-1 text-[var(--accent)] transition hover:bg-[var(--accent)]/15 disabled:opacity-50">
          {breaking ? t("正在拆解…") : t("✨ 拆成行动")}
        </button>
        <button onClick={onComplete} className="rounded-full border border-[var(--c-emerald)]/50 px-3 py-1 text-[var(--c-emerald)] transition hover:bg-[var(--c-emerald)]/10">
          {t("✅ 已达成")}
        </button>
        <button onClick={onDrop} className="ml-auto rounded-full border border-[var(--line)] px-3 py-1 text-[var(--fg-faint)] transition hover:text-[var(--c-rose)]">
          {t("移除")}
        </button>
      </div>
    </Card>
  );
}
