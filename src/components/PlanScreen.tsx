"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Button } from "./ui/Button";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";
import { GOAL_AREA_LABELS, GOAL_AREAS, type GoalArea } from "@/domain/types";
import { allTags, dueGoalReviews, goalProgress } from "@/domain/goals";
import { longGoals, shortGoalsOf, standaloneShortGoals } from "@/domain/goalTree";
import { localTodayStr } from "@/lib/dailyClient";
import { fetchGoalSuggestions, type GoalSuggestion } from "@/lib/goalClient";
import { AreaIcon } from "./lib/areaMeta";
import { IconSparkle, IconSprout } from "./ui/icons";
import { CreateGoalForm, LongGoalCard, ShortGoalCard } from "./plan/PlanGoalSections";

const _bootToday = localTodayStr();

const AREA_COLORS: Record<GoalArea, string> = {
  career: "var(--c-sky)",
  wealth: "var(--c-amber)",
  relationships: "var(--c-rose)",
  health: "var(--c-emerald)",
  growth: "var(--accent)",
  other: "var(--fg-faint)",
};
export function PlanScreen() {
  const { tree, addLongGoal, addLongGoalWithBranch, addStandaloneShortGoal, markDueGoalsReviewed, focusGoalId, clearFocusGoal } = useApp();
  const { t } = useT();

  const [todayStr, setTodayStr] = useState(_bootToday);
  useEffect(() => {
    const update = () => setTodayStr(localTodayStr());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  // 顶部创建器：单一「建立目标」表单，内部切换长期/短期类型。
  const [creating, setCreating] = useState(false);

  // 只迭代长期目标（短期目标嵌在各自长期目标卡内）。
  const longs = useMemo(() => (tree ? longGoals(tree) : []), [tree]);
  // 独立短期目标（无长期父）：单独一节渲染。
  const standalones = useMemo(() => (tree ? standaloneShortGoals(tree) : []), [tree]);
  const treeTags = useMemo(() => (tree ? allTags(tree) : []), [tree]);
  const due = useMemo(() => (tree ? dueGoalReviews(tree, todayStr) : []), [tree, todayStr]);

  // 当筛选标签随目标删除而消失时，回落到全部
  const effectiveFilter = tagFilter && treeTags.includes(tagFilter) ? tagFilter : null;

  // 按领域分组（6 桶：5 个人生面 + 其他）。仅展示有长期目标的领域。
  const grouped = useMemo(() => {
    const visible = longs.filter(
      (g) => effectiveFilter === null || (g.tags ?? []).includes(effectiveFilter),
    );
    return GOAL_AREAS.map((area) => ({
      area,
      goals: visible.filter((g) => g.area === area),
    })).filter((grp) => grp.goals.length > 0);
  }, [longs, effectiveFilter]);

  if (!tree) return null;
  const workingTree = tree;

  async function suggest() {
    if (suggesting) return;
    setSuggesting(true);
    const list = await fetchGoalSuggestions(workingTree);
    setSuggesting(false);
    setSuggestions(list);
  }

  function addSuggestion(s: GoalSuggestion) {
    if (added.includes(s.title)) return;
    addLongGoal({ area: s.area, title: s.title, why: s.why });
    setAdded((a) => [...a, s.title]);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Planning"
        title={t("我的规划")}
        subtitle={t("把人生分成领域，每个长期目标拆成短期目标，再落到指标、任务和习惯，一步步靠近它。")}
        actions={
          <Button variant="primary" onClick={() => setCreating((v) => !v)}>
            {t("建立目标")}
          </Button>
        }
      />

      {/* 该回看提醒 */}
      {due.length > 0 && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-[var(--c-amber)]/50 bg-[var(--c-amber)]/10 px-4 py-3 text-sm text-[var(--c-amber)]">
          <span>{t("该回看目标了：有 {n} 个目标一周没动过了。", { n: due.length })}</span>
          <button
            type="button"
            onClick={markDueGoalsReviewed}
            className="flex-shrink-0 rounded-full border border-[var(--c-amber)]/60 px-3 py-1 text-xs transition hover:bg-[var(--c-amber)]/20"
          >
            {t("我回看过了")}
          </button>
        </div>
      )}

      {/* 统一「建立目标」表单：内部切换长期/短期类型 */}
      {creating && (
        <div className="mb-6">
          <CreateGoalForm
            t={t}
            today={todayStr}
            onCancel={() => setCreating(false)}
            onSubmitLong={(d, withBranch) => {
              const payload = {
                area: d.area,
                title: d.title,
                why: d.why,
                endDate: d.endDate || undefined,
              };
              if (withBranch) addLongGoalWithBranch(payload);
              else addLongGoal(payload);
              setCreating(false);
            }}
            onSubmitShort={(d) => {
              addStandaloneShortGoal({
                area: d.area,
                title: d.title,
                why: d.why,
                startDate: d.startDate || undefined,
                endDate: d.endDate || undefined,
              });
              setCreating(false);
            }}
          />
        </div>
      )}

      {/* AI 建议 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="subtle" onClick={suggest} disabled={suggesting}>
          {suggesting ? (
            t("正在想几个适合你的目标…")
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <IconSparkle className="h-4 w-4" />
              {t("帮我想几个目标")}
            </span>
          )}
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="mb-6 space-y-2 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] p-4">
          <div className="text-xs font-semibold text-[var(--fg)]">
            {t("点「加入」才会进规划")}
          </div>
          {suggestions.map((s) => {
            const isAdded = added.includes(s.title);
            return (
              <div
                key={s.title}
                className="flex items-start justify-between gap-2 rounded-xl border border-[var(--line)] bg-black/[0.02] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--fg)]">
                    <span className="mr-1.5 inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-[var(--fg-dim)]">
                      <AreaIcon area={s.area} className="h-3 w-3" color="currentColor" />
                      {t(GOAL_AREA_LABELS[s.area])}
                    </span>
                    {s.title}
                  </div>
                  {s.why && <div className="mt-0.5 text-xs text-[var(--fg-dim)]">{s.why}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => addSuggestion(s)}
                  disabled={isAdded}
                  className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] transition ${
                    isAdded
                      ? "text-[var(--c-emerald)]"
                      : "border border-[var(--accent)]/50 text-[var(--accent)] hover:bg-[var(--accent)]/15"
                  }`}
                >
                  {isAdded ? t("✓ 已加入") : t("加入")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 标签筛选 */}
      {treeTags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {[null, ...treeTags].map((tag) => {
            const active = effectiveFilter === tag;
            return (
              <button
                key={tag ?? "__all__"}
                type="button"
                onClick={() => setTagFilter(tag)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "border-[var(--line)] text-[var(--fg-dim)] hover:border-[var(--accent)]/50 hover:text-[var(--fg)]"
                }`}
              >
                {tag ?? t("全部")}
              </button>
            );
          })}
        </div>
      )}

      {/* 领域分组 */}
      {grouped.length > 0 ? (
        <div className="space-y-7">
          {grouped.map(({ area, goals: areaGoals }) => {
            const color = AREA_COLORS[area];
            return (
              <section key={area}>
                <h2
                  className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color }}
                >
                  <AreaIcon area={area} className="h-3.5 w-3.5" color="currentColor" />
                  {t(GOAL_AREA_LABELS[area])}
                  <span className="text-[var(--fg-faint)]">· {areaGoals.length}</span>
                </h2>
                <div className="space-y-3">
                  {areaGoals.map((g) => (
                    <LongGoalCard
                      key={g.id}
                      goal={g}
                      shorts={shortGoalsOf(workingTree, g.id)}
                      t={t}
                      focusGoalId={focusGoalId}
                      onFocused={clearFocusGoal}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        longs.length === 0 && (
          <EmptyState
            className="mt-4"
            icon={<IconSprout className="h-7 w-7" />}
            accent="var(--accent)"
            description={t("还没有目标。建一个长期目标，或让 AI 帮你想几个，看着它们在你的人生树上长出来。")}
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                {t("建立目标")}
              </Button>
            }
          />
        )
      )}

      {/* 独立短期目标（无长期父）：单独一节，用 ShortGoalCard 渲染（卡本身不假设有父）。 */}
      {standalones.length > 0 && (
        <section className={grouped.length > 0 ? "mt-7" : "mt-4"}>
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-dim)]">
            <IconSprout className="h-3.5 w-3.5" />
            {t("独立短期目标")}
            <span className="text-[var(--fg-faint)]">· {standalones.length}</span>
          </h2>
          <div className="space-y-2">
            {standalones.map((s) => (
              <ShortGoalCard
                key={s.id}
                short={s}
                progress={goalProgress(workingTree, s)}
                t={t}
                focused={focusGoalId === s.id}
                onFocused={clearFocusGoal}
              />
            ))}
          </div>
        </section>
      )}

      {/* 有目标但被筛选清空 */}
      {longs.length > 0 && grouped.length === 0 && (
        <p className="mt-4 text-center text-sm text-[var(--fg-faint)]">
          {t("没有匹配这个标签的目标。")}
        </p>
      )}
    </div>
  );
}
