"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Button } from "./ui/Button";
import { LifeMap } from "./LifeMap";
import { WeeklyReviewSheet } from "./WeeklyReviewSheet";
import { AREA_LABELS } from "@/domain/types";
import { branchPositionAge, currentStreak, heatmap, todayItems } from "@/domain/daily";
import { fetchTodayPlan, localTodayStr, type TodayPick } from "@/lib/dailyClient";

const _bootToday = localTodayStr();

export function DashboardScreen() {
  const { tree, openPlan, openTree, openPath, toggleTodayAction, planActionToday, unplanActionToday, markDueGoalsReviewed, addBranch } = useApp();
  const { t } = useT();

  const [today, setToday] = useState(_bootToday);
  useEffect(() => {
    const update = () => setToday(localTodayStr());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const [picks, setPicks] = useState<TodayPick[]>([]);
  const [picking, setPicking] = useState(false);
  const [addedPick, setAddedPick] = useState<string[]>([]);
  const [weeklyOpen, setWeeklyOpen] = useState(false);

  const items = useMemo(() => (tree ? todayItems(tree, today) : []), [tree, today]);
  const todayIds = useMemo(() => new Set(items.map((i) => i.action.id)), [items]);
  const pending = useMemo(
    () =>
      tree
        ? tree.goals
            .filter((g) => g.status === "active")
            .flatMap((g) =>
              g.actions
                .filter((a) => !a.repeat && !a.done && !todayIds.has(a.id))
                .map((a) => ({ id: a.id, text: a.text, goalTitle: g.title })),
            )
        : [],
    [tree, todayIds],
  );
  const streak = useMemo(() => (tree ? currentStreak(tree, today) : 0), [tree, today]);
  const hm = useMemo(() => (tree ? heatmap(tree, 30, today) : []), [tree, today]);

  const markers = useMemo(() => {
    if (!tree) return [];
    return tree.goals
      .filter((g) => g.horizon === "long" && g.status === "active" && g.pathId)
      .map((g) => {
        const age = branchPositionAge(tree, g);
        return age == null ? null : { pathId: g.pathId as string, age, label: g.title };
      })
      .filter((m): m is { pathId: string; age: number; label: string } => m !== null);
  }, [tree]);

  const doneLong = useMemo(
    () => (tree ? tree.goals.filter((g) => g.horizon === "long" && g.status === "done") : []),
    [tree],
  );

  if (!tree) return null;

  const hasChoicePaths = tree.paths.some((p) => p.kind === "choice");

  const pendingById = new Map(pending.map((p) => [p.id, p]));

  async function suggestToday() {
    if (picking || !tree) return;
    setPicking(true);
    const list = await fetchTodayPlan(tree, pending);
    setPicking(false);
    setPicks(list);
    setAddedPick([]);
  }

  function addPick(id: string) {
    if (addedPick.includes(id)) return;
    planActionToday(id);
    setAddedPick((a) => [...a, id]);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 animate-fade">
        <div>
          <div className="text-xs uppercase tracking-[3px] text-[var(--fg-faint)]">Life Planner</div>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t("今天")}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-[var(--fg-dim)]">
            <span className="inline-flex items-center gap-1 text-[var(--c-amber)]">🔥 {t("连续 {n} 天", { n: streak })}</span>
            <HeatStrip days={hm} t={t} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="subtle" onClick={() => setWeeklyOpen(true)}>{t("📅 本周回顾")}</Button>
          <Button variant="primary" onClick={openPlan}>{t("🎯 我的规划")}</Button>
          <Button variant="ghost" onClick={openTree}>{t("看完整人生树 →")}</Button>
        </div>
      </header>

      {doneLong.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {doneLong.map((g) => (
            <div key={g.id} className="flex items-center gap-2 rounded-2xl border border-[var(--c-emerald)]/40 bg-[var(--c-emerald)]/10 px-4 py-2.5 text-sm">
              <span>🏆</span>
              <span className="text-[var(--fg)]">{t("你真的做到了：{title}", { title: g.title })}</span>
              {g.pathId && (
                <button onClick={() => openPath(g.pathId as string)} className="ml-auto flex-shrink-0 rounded-full border border-[var(--accent)]/50 px-3 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15">
                  {t("和未来的你说一声")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--fg-dim)]">{t("今日计划")}</h2>
          <button onClick={suggestToday} disabled={picking || pending.length === 0} className="rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-3 py-1 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:opacity-40">
            {picking ? t("正在想…") : t("✨ 建议今天做什么")}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-6 text-center text-sm text-[var(--fg-faint)]">
            {t("今天还没安排。让 AI 建议，或去「我的规划」把目标的行动挑进今天。")}
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {items.map(({ goal, action, doneToday }) => (
              <li key={action.id} className="flex items-center gap-1">
                <button onClick={() => toggleTodayAction(action.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 text-left transition hover:border-[var(--accent)]/50">
                  <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] ${doneToday ? "border-[var(--c-emerald)] bg-[var(--c-emerald)]/20 text-[var(--c-emerald)]" : "border-[var(--line)]"}`}>
                    {doneToday ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`text-sm ${doneToday ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}`}>{action.text}</span>
                    {action.repeat && <span className="ml-1.5 text-[11px] text-[var(--accent)]">🔁</span>}
                    <span className="ml-2 text-[11px] text-[var(--fg-faint)]">{t(AREA_LABELS[goal.area])} · {goal.title}</span>
                  </span>
                </button>
                {!doneToday && !action.repeat && (
                  <button
                    onClick={() => unplanActionToday(action.id)}
                    aria-label={t("从今天移除")}
                    title={t("从今天移除")}
                    className="flex-shrink-0 rounded-full border border-[var(--line)] px-2 py-1 text-xs text-[var(--fg-faint)] transition hover:border-[var(--c-rose)] hover:text-[var(--c-rose)]"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {picks.length > 0 && (
          <div className="mt-3 space-y-2 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] p-3">
            <div className="text-xs font-semibold text-[var(--fg)]">{t("建议今天做这几件（点「加入今天」）")}</div>
            {picks.map((p) => {
              const item = pendingById.get(p.id);
              if (!item) return null;
              const isAdded = addedPick.includes(p.id) || todayIds.has(p.id);
              return (
                <div key={p.id} className="flex items-start justify-between gap-2 rounded-xl border border-[var(--line)] bg-white/5 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--fg)]">{item.text}</div>
                    {p.why && <div className="mt-0.5 text-xs text-[var(--fg-dim)]">{p.why}</div>}
                  </div>
                  <button onClick={() => addPick(p.id)} disabled={isAdded} className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] transition ${isAdded ? "text-[var(--c-emerald)]" : "border border-[var(--accent)]/50 text-[var(--accent)] hover:bg-[var(--accent)]/15"}`}>
                    {isAdded ? t("✓ 已加入") : t("＋ 加入今天")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-7">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--fg-dim)]">{t("你的人生树")}</h2>
          <button onClick={openTree} className="text-xs text-[var(--fg-dim)] transition hover:text-[var(--fg)]">{t("看完整人生树 →")}</button>
        </div>
        <p className="mt-1 text-[11px] text-[var(--fg-faint)]">{t("「你在这里」会随你完成里程碑前进；每日习惯不移动它。")}</p>
        <div className="mt-2 overflow-hidden rounded-3xl border border-[var(--line)] bg-black/20 p-2">
          {hasChoicePaths ? (
            <LifeMap
              tree={tree}
              compact
              markers={markers}
              onSelectPath={openPath}
              // 紧凑图里点节点不在原地加岔路，直接进完整人生树
              onForkAtNode={() => openTree()}
            />
          ) : (
            <p className="px-4 py-10 text-center text-sm text-[var(--fg-faint)]">
              {t("还没有路。去「我的规划」加一个长期目标，它会在树上长出一条路。")}
            </p>
          )}
        </div>
      </section>

      {weeklyOpen && (
        <WeeklyReviewSheet
          tree={tree}
          today={today}
          onClose={() => setWeeklyOpen(false)}
          onReviewedGoals={markDueGoalsReviewed}
          onReplan={(label) => {
            addBranch(label);
            setWeeklyOpen(false);
          }}
        />
      )}
    </div>
  );
}

type TFn = (zh: string, vars?: Record<string, string | number>) => string;

function HeatStrip({ days, t }: { days: { date: string; count: number }[]; t: TFn }) {
  const shade = (c: number) => (c <= 0 ? "var(--line)" : c === 1 ? "var(--accent)" : "var(--c-fuchsia)");
  return (
    <span className="inline-flex items-end gap-0.5" aria-label={t("最近完成情况")}>
      {days.map((d) => (
        <span key={d.date} title={`${d.date}: ${d.count}`} className="inline-block h-3 w-1.5 rounded-[1px]" style={{ backgroundColor: shade(d.count), opacity: d.count > 0 ? 1 : 0.5 }} />
      ))}
    </span>
  );
}
