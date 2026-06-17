"use client";

import { useEffect, useState } from "react";
import { futureAgeOf } from "@/lib/chatClient";
import { FutureSelfChat } from "./FutureSelfChat";
import {
  AREA_LABELS,
  DIMENSION_LABELS,
  LIFE_AREAS,
  type LifeTree,
  type Mood,
  type Scenario,
} from "@/domain/types";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { MetricChart } from "./MetricChart";
import { Button } from "./ui/Button";
import { DecisionSheet } from "./DecisionSheet";
import { activeDecisionFor, reviewedDecisionsFor, togglePlanItem } from "@/domain/decisions";

/** 导入时取一次当下作初值（render 内不可调用 new Date）；组件挂载后用 effect 刷新。 */
const _bootNow = new Date().getTime();

function daysUntil(reviewDate: string, nowMs: number): number {
  return Math.max(0, Math.ceil((new Date(reviewDate).getTime() - nowMs) / 86400000));
}

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: "optimistic", label: "乐观" },
  { value: "likely", label: "最可能" },
  { value: "conservative", label: "保守" },
];

const MOOD_COLOR: Record<Mood, string> = {
  high: "#34d399",
  mid: "#f59e0b",
  low: "#fb7185",
};
const MOOD_LABEL: Record<Mood, string> = {
  high: "高光",
  mid: "平稳",
  low: "低谷",
};
// 复盘结果（1-5）→ 简短标签
const OUTCOME_LABELS: Record<number, string> = {
  1: "比预期差很多",
  2: "比预期差",
  3: "和预期差不多",
  4: "比预期好",
  5: "比预期好很多",
};

export function PathDetail({
  tree,
  pathId,
  onBack,
}: {
  tree: LifeTree;
  pathId: string;
  onBack: () => void;
}) {
  const { addScenario, addBranch, openPath, updateDecision } = useApp();
  const { t } = useT();
  const [chatting, setChatting] = useState(false);
  const [deciding, setDeciding] = useState(false);
  // 当下放进 state：挂载即取真实时间、标签页重新可见时刷新，避免"距复盘还有 N 天"过期。
  const [nowMs, setNowMs] = useState(_bootNow);
  useEffect(() => {
    const update = () => setNowMs(Date.now());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const path = tree.paths.find((p) => p.id === pathId);
  const decision = path ? activeDecisionFor(tree, path.id) : null;
  const reviewed = path ? reviewedDecisionsFor(tree, path.id) : [];
  const daysUntilReview = decision ? daysUntil(decision.reviewDate, nowMs) : 0;
  if (!path) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-[var(--fg-dim)]">{t("这条路找不到了。")}</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">
          {t("← 返回人生树")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <button
        onClick={onBack}
        className="text-sm text-[var(--fg-dim)] transition hover:text-[var(--fg)]"
      >
        {t("← 返回人生树")}
      </button>

      {/* 头部 */}
      <div className="animate-fade mt-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: path.color, boxShadow: `0 0 10px ${path.color}` }}
          />
          <h2 className="text-2xl font-bold">{path.choiceLabel}</h2>
        </div>
        <p className="mt-2 text-[var(--fg-dim)]">{path.summary}</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/5 px-3 py-1 text-sm">
          <span className="text-[var(--fg-faint)]">
            {t("{name} 的综合人生指数 ·", { name: tree.profile.name })}
          </span>
          <span className="font-semibold" style={{ color: path.color }}>
            {path.endValue}
          </span>
          <span className="text-[var(--fg-faint)]">/100</span>
        </div>
        <p className="mt-2 text-xs text-[var(--fg-faint)]">
          {t("这是一种可能的人生，不是预测。数字代表综合状态感受，仅供想象与参考。")}
        </p>
        <div className="mt-4">
          <Button variant="primary" onClick={() => setChatting(true)}>
            {t("✨ 和 {age} 岁的你聊聊", { age: futureAgeOf(path) })}
          </Button>
        </div>
      </div>

      {/* 选定 → 落地：把这条路变成计划 */}
      {path.kind === "choice" && (
        <div className="mt-6 space-y-3">
          {decision ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
                  {t("你的决定")}
                </span>
                <span className="text-xs text-[var(--fg-faint)]">
                  {t("距复盘还有 {n} 天", { n: daysUntilReview })}
                </span>
              </div>
              {!decision.plan.generatedByAI && (
                <p className="mt-2 text-xs text-[var(--fg-faint)]">
                  {t("（没接上 AI，先用本地模板生成的计划）")}
                </p>
              )}
              <div className="mt-3 text-xs font-semibold text-[var(--fg-dim)]">{t("近期行动")}</div>
              <ul className="mt-1 space-y-1">
                {decision.plan.steps.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => updateDecision(togglePlanItem(decision, s.id))}
                      className="flex w-full items-start gap-2 text-left text-sm"
                    >
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                          s.done
                            ? "border-[var(--c-emerald)] text-[var(--c-emerald)]"
                            : "border-[var(--line)] text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span className={s.done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}>
                        {s.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-xs font-semibold text-[var(--fg-dim)]">{t("低成本试错")}</div>
              <ul className="mt-1 space-y-1">
                {decision.plan.experiments.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => updateDecision(togglePlanItem(decision, s.id))}
                      className="flex w-full items-start gap-2 text-left text-sm"
                    >
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                          s.done
                            ? "border-[var(--c-emerald)] text-[var(--c-emerald)]"
                            : "border-[var(--line)] text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span className={s.done ? "text-[var(--fg-faint)] line-through" : "text-[var(--fg)]"}>
                        {s.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Button variant="primary" onClick={() => setDeciding(true)}>
              {t("把这条路变成计划")}
            </Button>
          )}

          {/* 已复盘的决定：回看当时的判断与那一句校准（最新一条） */}
          {reviewed.slice(-1).map((d) =>
            d.review ? (
              <div
                key={d.id}
                className="rounded-2xl border border-[var(--line)] bg-white/5 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
                    {t("已复盘")}
                  </span>
                  <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] text-[var(--accent)]">
                    {t(OUTCOME_LABELS[d.review.outcome])}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--fg)]">{d.review.lesson}</p>
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* 多走向切换（乐观/最可能/保守） */}
      {path.kind === "choice" && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
            {t("换个走向看看")}
          </div>
          <div className="mt-2 inline-flex rounded-full border border-[var(--line)] bg-white/5 p-1">
            {SCENARIOS.map((s) => {
              const variant = tree.paths.find(
                (p) =>
                  p.kind === "choice" &&
                  p.choiceLabel === path.choiceLabel &&
                  p.parentId === path.parentId &&
                  p.forkAge === path.forkAge &&
                  p.scenario === s.value,
              );
              const active = path.scenario === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => {
                    if (active) return;
                    if (variant) openPath(variant.id);
                    else addScenario(path.id, s.value);
                  }}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                    active
                      ? "bg-[var(--accent)] font-semibold text-[#11132a]"
                      : "text-[var(--fg-dim)] hover:text-[var(--fg)]"
                  }`}
                >
                  {t(s.label)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 指标 */}
      <div className="mt-8">
        <div className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
          {t("各方面随时间的变化")}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LIFE_AREAS.map((a) => (
            <MetricChart
              key={a}
              label={t(AREA_LABELS[a])}
              points={path.metrics[a]}
              color={path.color}
            />
          ))}
        </div>
      </div>

      {/* 时间线 */}
      <div className="mt-10">
        <div className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
          {t("这条路上的关键时刻")}
        </div>
        <div className="relative mt-4 pl-6">
          <div className="absolute left-[7px] top-1 bottom-1 w-px bg-[var(--line)]" />
          <div className="flex flex-col gap-7">
            {path.nodes.map((n, i) => (
              <div
                key={i}
                className="relative"
                style={{ animation: "lpPop .5s ease both", animationDelay: `${i * 0.12}s` }}
              >
                <span
                  className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--bg-1)]"
                  style={{ background: MOOD_COLOR[n.mood] }}
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-[var(--fg)]">
                    {t("{age} 岁", { age: n.age })}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{ background: `${MOOD_COLOR[n.mood]}22`, color: MOOD_COLOR[n.mood] }}
                  >
                    {t(MOOD_LABEL[n.mood])}
                  </span>
                </div>
                <div className="mt-1 font-medium">{n.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-[var(--fg-dim)]">{n.story}</p>
                {n.dimensions?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {n.dimensions.map((d) => (
                      <span
                        key={d}
                        className="rounded-full border border-[var(--line)] bg-white/5 px-2 py-0.5 text-[10px] text-[var(--fg-faint)]"
                      >
                        {t(DIMENSION_LABELS[d])}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {chatting && (
        <FutureSelfChat
          tree={tree}
          path={path}
          onClose={() => setChatting(false)}
          onAddBranch={(label) =>
            addBranch(label, {
              parentId: path.id,
              forkAge: path.nodes[0]?.age ?? path.forkAge + 2,
            })
          }
        />
      )}
      {deciding && (
        <DecisionSheet tree={tree} path={path} onClose={() => setDeciding(false)} />
      )}
    </div>
  );
}
