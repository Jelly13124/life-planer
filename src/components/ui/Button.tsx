"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "subtle";

const styles: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[#11132a] font-semibold hover:brightness-110 shadow-[0_8px_24px_rgba(167,139,250,0.35)]",
  ghost:
    "bg-transparent text-[var(--fg-dim)] border border-[var(--line)] hover:text-[var(--fg)] hover:border-[var(--accent)]",
  subtle: "bg-white/5 text-[var(--fg)] hover:bg-white/10 border border-[var(--line)]",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
