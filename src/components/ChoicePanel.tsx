"use client";

import { useMemo } from "react";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { SectionHeader } from "./ui/SectionHeader";
import { EmptyState } from "./ui/EmptyState";
import { IconScale, IconCheckCircle } from "./ui/icons";
import { ChoiceCard, ChoiceComposer } from "./choices/ChoicePrimitives";

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
