"use client";

import { SectionPlaceholder } from "./SectionPlaceholder";

// 人生面：占位面板，下一步填入真实内容（事业/财富/关系/健康/成长各维度概览）。
export function AreasSection() {
  return (
    <SectionPlaceholder
      eyebrow="Life Areas"
      icon="🧭"
      accent="var(--c-sky)"
      title="人生面"
    />
  );
}
