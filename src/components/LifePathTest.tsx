"use client";

import { useState } from "react";
import { useT } from "@/prefs/PreferencesContext";
import { STATEMENTS, scoreQuiz, type QuizAnswer, type SliderValue } from "@/domain/lifePathCode";

const CHOICES: { v: SliderValue; label: string }[] = [
  { v: 2, label: "非常符合" }, { v: 1, label: "比较符合" }, { v: 0, label: "中立" },
  { v: -1, label: "不太符合" }, { v: -2, label: "完全不符合" },
];

export function LifePathTest({ onDone }: { onDone: (r: { code: string; answers: QuizAnswer[] }) => void }) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const s = STATEMENTS[i];
  const total = STATEMENTS.length;

  function answer(v: SliderValue) {
    const next = [...answers.filter((a) => a.statementId !== s.id), { statementId: s.id, value: v }];
    setAnswers(next);
    if (i + 1 < total) setI(i + 1);
    else onDone({ code: scoreQuiz(next).code, answers: next });
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="mb-8 flex gap-1.5">
        {STATEMENTS.map((_, k) => (
          <div key={k} className="h-1 flex-1 rounded-full" style={{ background: k <= i ? "var(--accent)" : "rgba(0,0,0,0.12)" }} />
        ))}
      </div>
      <div className="text-xs uppercase tracking-[3px] text-[var(--fg-faint)]">{t("职场人格测试")} · {i + 1}/{total}</div>
      <h1 className="mt-3 min-h-[4.5rem] text-2xl font-semibold leading-snug text-[var(--fg)]">{s.text}</h1>
      <div className="mt-6 flex flex-col gap-2.5">
        {CHOICES.map((c) => (
          <button key={c.v} onClick={() => answer(c.v)} className="lp-tap rounded-2xl border border-[var(--line)] px-5 py-3.5 text-left text-base text-[var(--fg)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/[0.06]">
            {c.label}
          </button>
        ))}
      </div>
      {i > 0 && (
        <button onClick={() => setI(i - 1)} className="mt-6 self-start text-sm text-[var(--fg-faint)] transition hover:text-[var(--fg-dim)]">{t("← 上一题")}</button>
      )}
    </div>
  );
}
