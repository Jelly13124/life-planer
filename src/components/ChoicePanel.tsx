"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";
import { IconScale, IconTree, IconCheckCircle } from "./ui/icons";
import {
  GOAL_AREA_LABELS,
  GOAL_AREAS,
  type Choice,
  type ChoiceOption,
  type GoalArea,
  type Reversibility,
} from "@/domain/types";

type TFn = (zh: string, vars?: Record<string, string | number>) => string;

// 决定时间用 data 里的 ISO（decidedAt），只取日期部分友好展示——不在 render 调 new Date。
function fmtDate(iso?: string): string {
  if (!iso) return "";
  // ISO 形如 2026-06-22T...；取前 10 位即本地无关的日期串，足够展示。
  return iso.slice(0, 10);
}

// ───────────────────────────────────────────────────────────────────────────
// 直觉评分：1–5 颗点，键盘可操作（←/→ 调整，数字键直选）。real button + radiogroup。
// ───────────────────────────────────────────────────────────────────────────
function GutRating({
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
function InlineField({
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
function InlineTextAdd({
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
function DecideConfirm({
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
function OptionField({ label, children }: { label: string; children: React.ReactNode }) {
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
// 单个选项卡：标签（行内编辑）+ 利/弊/成本/可逆性/直觉 + 推演/选定/删除。
// 横向滚动行里的一列；min-w 保证可读，整列在已决态可高亮。
// ───────────────────────────────────────────────────────────────────────────
function OptionCard({
  choice,
  option,
  chosen,
  decided,
  t,
}: {
  choice: Choice;
  option: ChoiceOption;
  chosen: boolean;
  decided: boolean;
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
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 单个选择卡：标题 + （已决）选定项/时间/重新打开 + 删除；横向选项对比行 + ＋选项。
// ───────────────────────────────────────────────────────────────────────────
function ChoiceCard({ choice, t }: { choice: Choice; t: TFn }) {
  const { addChoiceOption, removeChoice, reopenChoice } = useApp();
  const [addingOption, setAddingOption] = useState(false);

  const options = choice.options ?? [];
  const decided = !!choice.chosenOptionId;
  const chosen = decided ? options.find((o) => o.id === choice.chosenOptionId) : undefined;

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
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 新建选择 composer：问题输入 + 「新建选择」按钮。
// ───────────────────────────────────────────────────────────────────────────
function ChoiceComposer({ t }: { t: TFn }) {
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
export function ChoicePanel() {
  const { tree } = useApp();
  const { t } = useT();

  const choices = useMemo(() => tree?.choices ?? [], [tree]);
  const open = useMemo(() => choices.filter((c) => !c.chosenOptionId), [choices]);
  const decided = useMemo(() => choices.filter((c) => c.chosenOptionId), [choices]);

  if (!tree) return null;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-8">
      <SectionHeader
        eyebrow="Choices"
        title={t("选择面板")}
        subtitle={t("列出你在权衡的选择，逐项对比，推演未来，然后拍板。")}
      />

      <ChoiceComposer t={t} />

      {choices.length === 0 ? (
        <EmptyState
          className="mt-2"
          icon={<IconScale className="h-7 w-7" />}
          accent="var(--accent)"
          description={t("还没有要权衡的选择。新建一个，把纠结摊开看。")}
        />
      ) : (
        <div className="space-y-8">
          {/* 未决 */}
          {open.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                <IconScale className="h-3.5 w-3.5" />
                {t("未决")}
                <span className="text-[var(--fg-faint)]">· {open.length}</span>
              </h2>
              <div className="space-y-4">
                {open.map((c) => (
                  <ChoiceCard key={c.id} choice={c} t={t} />
                ))}
              </div>
            </section>
          )}

          {/* 已决 */}
          {decided.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--c-emerald)]">
                <IconCheckCircle className="h-3.5 w-3.5" />
                {t("已决")}
                <span className="text-[var(--fg-faint)]">· {decided.length}</span>
              </h2>
              <div className="space-y-4">
                {decided.map((c) => (
                  <ChoiceCard key={c.id} choice={c} t={t} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
