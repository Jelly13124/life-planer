"use client";

import { SectionPlaceholder } from "./SectionPlaceholder";

// 习惯：占位面板，下一步填入真实内容（每日/每周重复行动的养成视图）。
export function HabitsSection() {
  return (
    <SectionPlaceholder
      eyebrow="Habits"
      icon="🔁"
      accent="var(--c-emerald)"
      title="习惯"
    />
  );
}
