"use client";

import { useState, type ReactNode } from "react";
import { useApp } from "@/state/AppContext";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { IconCheckCircle, IconScale, IconSparkle, IconTree } from "../ui/icons";
import { GOAL_AREA_LABELS, GOAL_AREAS, type Choice, type ChoiceOption, type GoalArea, type LifePath, type LifeTree, type Mood, type Reversibility } from "@/domain/types";
import { effectiveFeasibility, roundFeasibility } from "@/domain/feasibility";
import type { ChoiceAnalysis, OptionAnalysis } from "@/lib/choiceAnalysis";

type TFn = (zh: string, vars?: Record<string, string | number>) => string;

const MOOD_COLOR: Record<Mood, string> = {
  high: "#34d399",
  mid: "#f59e0b",
  low: "#fb7185",
};

export function reversibilityLabel(r: Reversibility, t: TFn): string {
  return r === "one-way" ? t("单行道") : t("可回头");
}

// 决定时间用 data 里的 ISO（decidedAt），只取日期部分友好展示——不在 render 调 new Date。
export function fmtDate(iso?: string): string {
  if (!iso) return "";
  // ISO 形如 2026-06-22T...；取前 10 位即本地无关的日期串，足够展示。
  return iso.slice(0, 10);
}

// ───────────────────────────────────────────────────────────────────────────
// 直觉评分：1–5 颗点，键盘可操作（←/→ 调整，数字键直选）。real button + radiogroup。
// ───────────────────────────────────────────────────────────────────────────
export function GutRating({
  value,
  onChange,
  t,
}: {
  value: number;
  onChange: (v: number) => void;
  t: TFn;
}) {
  const clamped = Math.max(1, Math.min(5, value || 3));
  return (
    <div
      role="radiogroup"
      aria-label={t("直觉")}
      className="flex items-center gap-1"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(Math.min(5, clamped + 1));
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          onChange(Math.max(1, clamped - 1));
        }
      }}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= clamped;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === clamped}
            aria-label={t("直觉 {n} 分", { n })}
            tabIndex={n === clamped ? 0 : -1}
            onClick={() => onChange(n)}
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[13px] leading-none transition ${
              on ? "text-[var(--c-amber)]" : "text-[var(--fg-faint)] hover:text-[var(--fg-dim)]"
            }`}
          >
            {on ? "●" : "○"}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 行内可编辑字段：失焦/回车提交。textarea 多行（利/弊），input 单行（成本/标签）。
// ───────────────────────────────────────────────────────────────────────────
export function InlineField({
  value,
  onCommit,
  placeholder,
  multiline,
  ariaLabel,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(value);
  // value 来自外部时（其它编辑导致重渲），保持本地草稿；提交时才回写。
  const cls =
    "w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-1.5 text-xs leading-relaxed text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]";
  if (multiline) {
    return (
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={2}
        className={`${cls} resize-none`}
      />
    );
  }
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cls}
    />
  );
}

// 行内单行新增（用于新建选项标签）：回车提交，Esc 取消。
export function InlineTextAdd({
  placeholder,
  onAdd,
  onCancel,
  ariaLabel,
}: {
  placeholder: string;
  onAdd: (text: string) => void;
  onCancel: () => void;
  ariaLabel: string;
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
      aria-label={ariaLabel}
      className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-1.5 text-xs text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]"
      autoFocus
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 拍板确认：「同时建成目标」复选（默认勾）+ 领域 select + 确认/取消。
// ───────────────────────────────────────────────────────────────────────────
export function DecideConfirm({
  t,
  onConfirm,
  onCancel,
}: {
  t: TFn;
  onConfirm: (makeGoal: boolean, area: GoalArea) => void;
  onCancel: () => void;
}) {
  const [makeGoal, setMakeGoal] = useState(true);
  const [area, setArea] = useState<GoalArea>("growth");
  return (
    <div className="mt-2 space-y-2.5 rounded-xl border border-[var(--c-emerald)]/40 bg-[var(--c-emerald)]/[0.06] p-3">
      <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--fg-dim)]">
        <input
          type="checkbox"
          checked={makeGoal}
          onChange={(e) => setMakeGoal(e.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--c-emerald)]"
        />
        {t("同时建成目标")}
      </label>
      {makeGoal && (
        <label className="flex items-center gap-2 text-xs text-[var(--fg-faint)]">
          {t("归到领域")}
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as GoalArea)}
            aria-label={t("目标领域")}
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)] [color-scheme:light]"
          >
            {GOAL_AREAS.map((a) => (
              <option key={a} value={a}>
                {t(GOAL_AREA_LABELS[a])}
              </option>
            ))}
          </select>
        </label>
      )}
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
          onClick={() => onConfirm(makeGoal, area)}
          className="rounded-full border border-[var(--c-emerald)]/60 bg-[var(--c-emerald)]/10 px-3 py-1 text-[11px] text-[var(--c-emerald)] transition hover:bg-[var(--c-emerald)]/20"
        >
          {t("确认")}
        </button>
      </div>
    </div>
  );
}

// 选项卡里的一格：小标题 + 内容（在模块作用域声明，避免 render 内创建组件）。
export function OptionField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
        {label}
      </div>
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 2a. AI 分析预览：一行「采纳」把某条建议写回该选项字段。
// 永不静默覆盖用户已填内容——非空字段时先并列展示「你当前的内容」+ 警示，采纳是用户主动动作。
// ───────────────────────────────────────────────────────────────────────────

// 一条可采纳的建议（文本字段：利/弊/成本/点评）。current 非空 → 采纳前并列展示旧内容。
export function SuggestionField({
  label,
  suggestion,
  current,
  onAccept,
  t,
}: {
  label: string;
  suggestion: string;
  current: string;
  onAccept: () => void;
  t: TFn;
}) {
  if (!suggestion.trim()) return null;
  const hasCurrent = current.trim().length > 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
          {label}
        </span>
        <button
          type="button"
          onClick={onAccept}
          className="flex-shrink-0 rounded-full border border-[var(--accent)]/50 px-2 py-0.5 text-[10px] text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
        >
          {t("采纳")}
        </button>
      </div>
      <p className="whitespace-pre-line rounded-lg border border-[var(--accent)]/25 bg-[var(--accent)]/[0.05] px-2.5 py-1.5 text-xs leading-relaxed text-[var(--fg-dim)]">
        {suggestion}
      </p>
      {hasCurrent && (
        <p className="text-[10px] leading-snug text-[var(--c-amber)]">
          {t("你已填了内容，采纳会替换它")}
          <span className="mt-0.5 block text-[var(--fg-faint)]">
            {t("你当前的内容：")} {current}
          </span>
        </p>
      )}
    </div>
  );
}

// 单个选项的 AI 建议预览块（在该选项卡底部展开）。
export function OptionSuggestion({
  option,
  analysis,
  onUpdate,
  t,
}: {
  option: ChoiceOption;
  analysis: OptionAnalysis;
  onUpdate: (patch: Partial<ChoiceOption>) => void;
  t: TFn;
}) {
  return (
    <div className="mt-2 space-y-2.5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.04] p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
        <IconSparkle className="h-3 w-3" />
        {t("AI 建议")}
      </div>
      <SuggestionField
        label={t("利")}
        suggestion={analysis.pros}
        current={option.pros}
        onAccept={() => onUpdate({ pros: analysis.pros })}
        t={t}
      />
      <SuggestionField
        label={t("弊")}
        suggestion={analysis.cons}
        current={option.cons}
        onAccept={() => onUpdate({ cons: analysis.cons })}
        t={t}
      />
      <SuggestionField
        label={t("成本")}
        suggestion={analysis.cost}
        current={option.cost}
        onAccept={() => onUpdate({ cost: analysis.cost })}
        t={t}
      />
      {/* 可逆性建议：toggle 当前不同时给「采纳」改成 AI 判定的方向 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
            {t("可逆性")}
          </span>
          {option.reversibility !== analysis.reversibility && (
            <button
              type="button"
              onClick={() => onUpdate({ reversibility: analysis.reversibility })}
              className="flex-shrink-0 rounded-full border border-[var(--accent)]/50 px-2 py-0.5 text-[10px] text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
            >
              {t("采纳")}
            </button>
          )}
        </div>
        <p className="rounded-lg border border-[var(--accent)]/25 bg-[var(--accent)]/[0.05] px-2.5 py-1.5 text-xs text-[var(--fg-dim)]">
          {reversibilityLabel(analysis.reversibility, t)}
        </p>
      </div>
      {analysis.note.trim() && (
        <p className="text-[11px] italic leading-snug text-[var(--fg-faint)]">
          “{analysis.note}”
        </p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 单个选项卡：标签（行内编辑）+ 利/弊/成本/可逆性/直觉 + 推演/选定/删除。
// 横向滚动行里的一列；min-w 保证可读，整列在已决态可高亮。
// ───────────────────────────────────────────────────────────────────────────
export function OptionCard({
  choice,
  option,
  chosen,
  decided,
  suggestion,
  t,
}: {
  choice: Choice;
  option: ChoiceOption;
  chosen: boolean;
  decided: boolean;
  suggestion?: OptionAnalysis; // 非空 = 显示 AI 建议预览块（accept-to-apply）
  t: TFn;
}) {
  const {
    updateChoiceOption,
    removeChoiceOption,
    predictOptionBranch,
    openPath,
    decideChoice,
    predicting,
  } = useApp();
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className={`flex w-64 flex-shrink-0 flex-col gap-2.5 rounded-2xl border p-3 transition ${
        chosen
          ? "border-[var(--c-emerald)]/60 bg-[var(--c-emerald)]/[0.07]"
          : "border-[var(--line)] bg-black/[0.02]"
      }`}
    >
      {/* 标签 + 选定标记 + 删除 */}
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <InlineField
            value={option.label}
            onCommit={(v) => v.trim() && updateChoiceOption(option.id, { label: v.trim() })}
            placeholder={t("选项名")}
            ariaLabel={t("选项名")}
          />
        </div>
        {chosen && (
          <span
            className="mt-1 flex-shrink-0 rounded-full border border-[var(--c-emerald)]/50 bg-[var(--c-emerald)]/10 px-1.5 py-0.5 text-[10px] text-[var(--c-emerald)]"
            title={t("已选定")}
          >
            ✓ {t("已选定")}
          </span>
        )}
        <button
          type="button"
          onClick={() => removeChoiceOption(option.id)}
          aria-label={t("删除选项")}
          title={t("删除选项")}
          className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] text-[var(--fg-faint)] transition hover:bg-black/[0.04] hover:text-[var(--c-rose)]"
        >
          ✕
        </button>
      </div>

      <OptionField label={t("利")}>
        <InlineField
          value={option.pros}
          onCommit={(v) => updateChoiceOption(option.id, { pros: v })}
          placeholder={t("一行一条好处")}
          ariaLabel={t("利")}
          multiline
        />
      </OptionField>
      <OptionField label={t("弊")}>
        <InlineField
          value={option.cons}
          onCommit={(v) => updateChoiceOption(option.id, { cons: v })}
          placeholder={t("一行一条坏处")}
          ariaLabel={t("弊")}
          multiline
        />
      </OptionField>
      <OptionField label={t("成本")}>
        <InlineField
          value={option.cost}
          onCommit={(v) => updateChoiceOption(option.id, { cost: v })}
          placeholder={t("时间 / 金钱 / 机会")}
          ariaLabel={t("成本")}
        />
      </OptionField>

      {/* 可逆性 toggle */}
      <OptionField label={t("可逆性")}>
        <div className="flex gap-1.5">
          {(["one-way", "two-way"] as Reversibility[]).map((r) => {
            const active = option.reversibility === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => updateChoiceOption(option.id, { reversibility: r })}
                aria-pressed={active}
                className={`flex-1 rounded-full border px-2 py-1 text-[11px] transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "border-[var(--line)] text-[var(--fg-dim)] hover:text-[var(--fg)]"
                }`}
              >
                {r === "one-way" ? t("单行道") : t("可回头")}
              </button>
            );
          })}
        </div>
      </OptionField>

      {/* 直觉 */}
      <OptionField label={t("直觉")}>
        <GutRating
          value={option.gut}
          onChange={(v) => updateChoiceOption(option.id, { gut: v })}
          t={t}
        />
      </OptionField>

      {/* 操作：推演 / 在树上看 + 就选它 */}
      <div className="mt-0.5 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-2.5">
        {option.pathId ? (
          <button
            type="button"
            onClick={() => option.pathId && openPath(option.pathId)}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/50 px-2.5 py-1 text-[11px] text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
          >
            <IconTree className="h-3.5 w-3.5" />
            {t("在树上看")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => predictOptionBranch(choice.id, option.id)}
            disabled={!!predicting}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/50 px-2.5 py-1 text-[11px] text-[var(--accent)] transition hover:bg-[var(--accent)]/15 disabled:opacity-50"
          >
            <IconTree className="h-3.5 w-3.5" />
            {t("推演这个选项")}
          </button>
        )}
        {!decided && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--c-emerald)]/50 px-2.5 py-1 text-[11px] text-[var(--c-emerald)] transition hover:bg-[var(--c-emerald)]/10"
          >
            <IconCheckCircle className="h-3.5 w-3.5" />
            {t("就选它")}
          </button>
        )}
      </div>

      {confirming && (
        <DecideConfirm
          t={t}
          onCancel={() => setConfirming(false)}
          onConfirm={(makeGoal, area) => {
            decideChoice(choice.id, option.id, { makeGoal, area });
            setConfirming(false);
          }}
        />
      )}

      {/* 2a. AI 建议预览（accept-to-apply）：仅在拉过分析后显示 */}
      {suggestion && (
        <OptionSuggestion
          option={option}
          analysis={suggestion}
          onUpdate={(patch) => updateChoiceOption(option.id, patch)}
          t={t}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 2b. 两个未来并排对比：纯展示，数据来自 tree.paths（按 pathId）+ effectiveFeasibility。
// 不新做预测。一列 = 选项名 · 该路 summary · 现实可行度 · 最终走向（endValue + 末节点一句）
//   · 前 3-4 个关键里程碑（title + 年龄 + mood 点）。
// ───────────────────────────────────────────────────────────────────────────

// 已推演选项 = pathId 已回填、且树上确有对应 LifePath。
export function predictedOptions(choice: Choice, tree: LifeTree): { option: ChoiceOption; path: LifePath }[] {
  const out: { option: ChoiceOption; path: LifePath }[] = [];
  for (const o of choice.options ?? []) {
    if (!o.pathId) continue;
    const path = tree.paths.find((p) => p.id === o.pathId);
    if (path) out.push({ option: o, path });
  }
  return out;
}

// 一列：某条已推演路的结构化对比。
export function CompareColumn({
  option,
  path,
  tree,
  t,
}: {
  option: ChoiceOption;
  path: LifePath;
  tree: LifeTree;
  t: TFn;
}) {
  const eff = effectiveFeasibility(tree, path);
  // 末节点一句：取节点里年龄最大的那条 title，作为"最终走向"的具体落点。
  const lastNode =
    path.nodes.length > 0
      ? path.nodes.reduce((a, b) => (b.age >= a.age ? b : a))
      : null;
  // 前 3-4 个里程碑（按年龄升序）。
  const milestones = [...path.nodes].sort((a, b) => a.age - b.age).slice(0, 4);

  return (
    <div className="flex-1 space-y-3 rounded-2xl border border-[var(--line)] bg-black/[0.02] p-3">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ background: path.color }}
        />
        <h4 className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--fg)]">
          {option.label}
        </h4>
      </div>

      {path.summary && (
        <p className="text-xs leading-relaxed text-[var(--fg-dim)]">{path.summary}</p>
      )}

      {/* 现实可行度（复用 effectiveFeasibility + 约 {pct}% 键） */}
      {eff && (
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className="text-[var(--fg-faint)]">{t("现实可行度")}</span>
          <span className="font-semibold text-[var(--fg)]">
            {t("约 {pct}%", { pct: roundFeasibility(eff.value) })}
          </span>
        </div>
      )}

      {/* 最终走向：endValue + 末节点一句 */}
      <div className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
          {t("最终走向")}
        </div>
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className="font-semibold" style={{ color: path.color }}>
            {path.endValue}
          </span>
          <span className="text-[var(--fg-faint)]">/100</span>
        </div>
        {lastNode && <p className="text-xs leading-snug text-[var(--fg-dim)]">{lastNode.title}</p>}
      </div>

      {/* 前 3-4 个关键里程碑 */}
      {milestones.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
            {t("关键里程碑")}
          </div>
          <ul className="space-y-1.5">
            {milestones.map((n, i) => (
              <li key={`${n.age}-${i}`} className="flex items-start gap-1.5 text-xs">
                <span
                  className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: MOOD_COLOR[n.mood] }}
                  aria-hidden="true"
                />
                <span className="text-[var(--fg-dim)]">
                  <span className="text-[var(--fg-faint)]">{t("{age} 岁", { age: n.age })}</span>{" "}
                  {n.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// 对比视图：从已推演选项里选 2 个 → 两列并排（移动端纵向堆叠）。只读，可返回。
export function CompareView({
  choice,
  tree,
  onClose,
  t,
}: {
  choice: Choice;
  tree: LifeTree;
  onClose: () => void;
  t: TFn;
}) {
  const predicted = predictedOptions(choice, tree);
  // 默认选前两个已推演选项。
  const [leftId, setLeftId] = useState(predicted[0]?.option.id ?? "");
  const [rightId, setRightId] = useState(predicted[1]?.option.id ?? "");

  const left = predicted.find((p) => p.option.id === leftId) ?? predicted[0];
  const right =
    predicted.find((p) => p.option.id === rightId && p.option.id !== left?.option.id) ??
    predicted.find((p) => p.option.id !== left?.option.id) ??
    predicted[1];

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.03] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">
          {t("并排看两个未来")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--fg)]"
        >
          {t("返回")}
        </button>
      </div>

      {/* 选两个推演过的选项 */}
      {predicted.length > 2 && (
        <div className="flex flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-[var(--fg-faint)]">
            <span>A</span>
            <select
              value={left?.option.id ?? ""}
              onChange={(e) => setLeftId(e.target.value)}
              aria-label={t("选两个推演过的选项来并排对比")}
              className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)] [color-scheme:light]"
            >
              {predicted.map((p) => (
                <option key={p.option.id} value={p.option.id}>
                  {p.option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[var(--fg-faint)]">
            <span>B</span>
            <select
              value={right?.option.id ?? ""}
              onChange={(e) => setRightId(e.target.value)}
              aria-label={t("选两个推演过的选项来并排对比")}
              className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)] [color-scheme:light]"
            >
              {predicted.map((p) => (
                <option key={p.option.id} value={p.option.id}>
                  {p.option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* 两列：桌面并排，移动端纵向堆叠 */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {left && (
          <CompareColumn option={left.option} path={left.path} tree={tree} t={t} />
        )}
        {right && right.option.id !== left?.option.id && (
          <CompareColumn option={right.option} path={right.path} tree={tree} t={t} />
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 单个选择卡：标题 + （已决）选定项/时间/重新打开 + 删除；横向选项对比行 + ＋选项。
// ───────────────────────────────────────────────────────────────────────────
export function ChoiceCard({ choice, t }: { choice: Choice; t: TFn }) {
  const { tree, addChoiceOption, removeChoice, reopenChoice, analyzeChoice, updateChoiceOption } =
    useApp();
  const [addingOption, setAddingOption] = useState(false);

  // 2a. AI 分析预览态（不写回——采纳由用户在每个选项卡里主动触发）。
  const [analysis, setAnalysis] = useState<ChoiceAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(false);
  // 2b. 并排对比视图的开合。
  const [comparing, setComparing] = useState(false);

  const options = choice.options ?? [];
  const decided = !!choice.chosenOptionId;
  const chosen = decided ? options.find((o) => o.id === choice.chosenOptionId) : undefined;

  // 已推演选项（pathId 回填 + 树上有对应分支）：≥2 个才给「并排对比」入口。
  const predictedCount = tree ? predictedOptions(choice, tree).length : 0;

  async function runAnalyze() {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalyzeError(false);
    try {
      const result = await analyzeChoice(choice.id);
      if (result) setAnalysis(result);
      else setAnalyzeError(true);
    } catch {
      setAnalyzeError(true);
    } finally {
      setAnalyzing(false);
    }
  }

  // 全部采纳：只填「当前为空」的字段，绝不覆盖用户已填内容（诚实：批量也不静默盖写）。
  // 可逆性当前为 two-way（默认/未改）时才采纳 AI 判定，避免改掉用户明确设过的方向。
  function acceptAll() {
    if (!analysis) return;
    for (const o of options) {
      const a = analysis[o.id];
      if (!a) continue;
      const patch: Partial<ChoiceOption> = {};
      if (!o.pros.trim() && a.pros.trim()) patch.pros = a.pros;
      if (!o.cons.trim() && a.cons.trim()) patch.cons = a.cons;
      if (!o.cost.trim() && a.cost.trim()) patch.cost = a.cost;
      if (o.reversibility === "two-way" && a.reversibility === "one-way") {
        patch.reversibility = a.reversibility;
      }
      if (Object.keys(patch).length > 0) updateChoiceOption(o.id, patch);
    }
  }

  return (
    <Card pad="md" className={decided ? "border-[var(--c-emerald)]/30" : ""}>
      {/* 头部：问题 + 已决信息/操作 */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-[var(--fg)]">{choice.question}</h3>
          {decided && chosen && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-[var(--c-emerald)]/40 bg-[var(--c-emerald)]/10 px-2 py-0.5 text-[var(--c-emerald)]">
                {t("已选 {label}", { label: chosen.label })}
              </span>
              {choice.decidedAt && (
                <span className="text-[var(--fg-faint)]">
                  {t("决定于 {date}", { date: fmtDate(choice.decidedAt) })}
                </span>
              )}
            </div>
          )}
        </div>
        {decided && (
          <button
            type="button"
            onClick={() => reopenChoice(choice.id)}
            className="flex-shrink-0 rounded-full border border-[var(--line)] px-3 py-1 text-[11px] text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--fg)]"
          >
            {t("重新打开")}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(t("删除这个选择？它的选项和对比都会一起删除。"))) {
              removeChoice(choice.id);
            }
          }}
          aria-label={t("删除选择")}
          title={t("删除选择")}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] text-[var(--fg-faint)] transition hover:bg-black/[0.04] hover:text-[var(--c-rose)]"
        >
          ✕
        </button>
      </div>

      {/* 选项对比：横向滚动行（手机可读，桌面排开） */}
      <div className="mt-3 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {options.map((o) => (
          <OptionCard
            key={o.id}
            choice={choice}
            option={o}
            chosen={o.id === choice.chosenOptionId}
            decided={decided}
            suggestion={analysis?.[o.id]}
            t={t}
          />
        ))}

        {/* ＋ 选项（最后一列） */}
        <div className="flex w-64 flex-shrink-0 items-start">
          {addingOption ? (
            <div className="w-full rounded-2xl border border-dashed border-[var(--accent)]/50 p-3">
              <InlineTextAdd
                placeholder={t("选项名（如 去大厂 / 创业）")}
                ariaLabel={t("新选项名")}
                onAdd={(label) => addChoiceOption(choice.id, label)}
                onCancel={() => setAddingOption(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingOption(true)}
              className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[var(--line)] text-sm text-[var(--fg-faint)] transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]"
            >
              <span className="text-xl leading-none" aria-hidden="true">＋</span>
              {t("＋ 选项")}
            </button>
          )}
        </div>
      </div>

      {/* 操作条：AI 分析（仅未决） + 全部采纳/忽略 + 并排对比入口 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!decided && options.length > 0 && (
          <button
            type="button"
            onClick={runAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/50 px-3 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/15 disabled:opacity-50"
          >
            <IconSparkle className="h-3.5 w-3.5" />
            {analyzing ? t("正在分析…") : t("✨ AI 帮我分析")}
          </button>
        )}

        {/* 并排对比入口：≥2 个已推演选项才显示；否则给一句提示 */}
        {predictedCount >= 2 ? (
          <button
            type="button"
            onClick={() => setComparing((v) => !v)}
            aria-expanded={comparing}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--fg)]"
          >
            <IconScale className="h-3.5 w-3.5" />
            {t("并排对比")}
          </button>
        ) : (
          options.length >= 2 && (
            <span className="text-[11px] text-[var(--fg-faint)]">
              {t("先给两个选项各点『推演这个选项』")}
            </span>
          )
        )}
      </div>

      {/* AI 建议提示条：拉过分析后强调"AI 建议，你来定"，给「全部采纳 / 忽略」 */}
      {analysis && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/[0.04] px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--accent)]">
            <IconSparkle className="h-3 w-3" />
            {t("AI 建议，你来定")}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={acceptAll}
              className="rounded-full border border-[var(--accent)]/50 px-2.5 py-1 text-[11px] text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
            >
              {t("全部采纳")}
            </button>
            <button
              type="button"
              onClick={() => setAnalysis(null)}
              className="rounded-full px-2.5 py-1 text-[11px] text-[var(--fg-faint)] transition hover:text-[var(--fg)]"
            >
              {t("忽略")}
            </button>
          </div>
        </div>
      )}

      {analyzeError && (
        <p className="mt-2 text-[11px] text-[var(--c-rose)]">{t("AI 分析失败了，请稍后再试")}</p>
      )}

      {/* 2b. 并排对比视图 */}
      {comparing && predictedCount >= 2 && tree && (
        <CompareView choice={choice} tree={tree} onClose={() => setComparing(false)} t={t} />
      )}
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 新建选择 composer：问题输入 + 「新建选择」按钮。
// ───────────────────────────────────────────────────────────────────────────
export function ChoiceComposer({ t }: { t: TFn }) {
  const { createChoice } = useApp();
  const [question, setQuestion] = useState("");

  function submit() {
    if (!question.trim()) return;
    createChoice(question.trim());
    setQuestion("");
  }

  return (
    <Card pad="md" className="mb-6">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
          }}
          placeholder={t("我在纠结什么？（如 留在现在的公司，还是跳槽？）")}
          aria-label={t("我面临的选择")}
          className="w-full flex-1 rounded-xl border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2.5 text-sm text-[var(--fg)] outline-none transition focus:border-[var(--accent)] placeholder:text-[var(--fg-faint)]"
        />
        <Button variant="primary" onClick={submit} className="flex-shrink-0">
          {t("新建选择")}
        </Button>
      </div>
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// ChoicePanel：未决 / 已决两区；列出选择卡，逐项对比、推演、拍板。
// ───────────────────────────────────────────────────────────────────────────
