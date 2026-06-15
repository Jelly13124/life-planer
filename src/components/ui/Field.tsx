"use client";

import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--fg)]">{label}</span>
      {children}
      {hint && <span className="text-xs text-[var(--fg-faint)]">{hint}</span>}
    </label>
  );
}
