"use client";

import { useState } from "react";
import type { LifePath, LifeTree, PlanHorizon, Reversibility } from "@/domain/types";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { setPlan } from "@/domain/decisions";
import { fetchPlan } from "@/lib/planClient";
import { Button } from "./ui/Button";

// 选定一条路 + AI 落地成计划（确认优先：填完点生成，计划出来再保存）。
export function DecisionSheet({
  tree,
  path,
  onClose,
}: {
  tree: LifeTree;
  path: LifePath;
  onClose: () => void;
}) {
  const { t } = useT();
  const { makeDecision, commitDecision } = useApp();
  const [rationale, setRationale] = useState("");
  const [expectation, setExpectation] = useState("");
  const [confidence, setConfidence] = useState(60);
  const [reversibility, setReversibility] = useState<Reversibility>("two-way");
  const [horizon, setHorizon] = useState<PlanHorizon>("90d");
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (busy) return;
    setBusy(true);
    const decision = makeDecision({
      pathId: path.id,
      choiceLabel: path.choiceLabel,
      rationale,
      expectation,
      confidence,
      reversibility,
      horizon,
    });
    const { result, ai } = await fetchPlan(tree, path, { rationale, expectation, horizon });
    commitDecision(setPlan(decision, result.steps, result.experiments, ai));
    setBusy(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-lg rounded-t-3xl border border-[var(--line)] bg-[var(--bg-1)] p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold">{t("把这条路变成计划")}</h3>
        <p className="mt-1 text-sm text-[var(--fg-dim)]">{path.choiceLabel}</p>

        <label className="mt-4 block text-xs uppercase tracking-wider text-[var(--fg-faint)]">
          {t("为什么选它")}
        </label>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none px-4 py-3 text-base"
        />

        <label className="mt-3 block text-xs uppercase tracking-wider text-[var(--fg-faint)]">
          {t("你预期会发生什么")}
        </label>
        <textarea
          value={expectation}
          onChange={(e) => setExpectation(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none px-4 py-3 text-base"
        />

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
              {t("信心几成")}
            </span>
            <span className="text-sm font-semibold text-[var(--accent)]">{confidence}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </div>

        <div className="mt-4">
          <span className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
            {t("这个决定可逆吗？")}
          </span>
          <div className="mt-2 flex gap-2">
            <Button
              variant={reversibility === "one-way" ? "primary" : "subtle"}
              onClick={() => setReversibility("one-way")}
            >
              {t("单行道")}
            </Button>
            <Button
              variant={reversibility === "two-way" ? "primary" : "subtle"}
              onClick={() => setReversibility("two-way")}
            >
              {t("可回头")}
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <span className="text-xs uppercase tracking-wider text-[var(--fg-faint)]">
            {t("多久后回看")}
          </span>
          <div className="mt-2 flex gap-2">
            <Button
              variant={horizon === "30d" ? "primary" : "subtle"}
              onClick={() => setHorizon("30d")}
            >
              {t("30 天")}
            </Button>
            <Button
              variant={horizon === "90d" ? "primary" : "subtle"}
              onClick={() => setHorizon("90d")}
            >
              {t("90 天")}
            </Button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {t("取消")}
          </Button>
          <Button variant="primary" disabled={busy} onClick={generate}>
            {busy ? t("正在为你制定计划…") : t("生成计划 →")}
          </Button>
        </div>
      </div>
    </div>
  );
}
