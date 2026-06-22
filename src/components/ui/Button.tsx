"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "subtle";

const styles: Record<Variant, string> = {
  // 主操作：压深的紫渐变 + 白字 + 柔影，悬浮微抬升、按下回弹（Apple 观感）
  primary:
    "bg-[image:var(--grad-accent)] text-white font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08),0_6px_16px_-6px_rgba(109,74,255,0.45)] hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.1),0_12px_28px_-8px_rgba(109,74,255,0.55)] hover:brightness-[1.05] active:translate-y-0 active:brightness-95",
  // 幽灵：克制发丝描边，悬浮加深文字与极浅灰底
  ghost:
    "bg-transparent text-[var(--fg-dim)] border border-[var(--line)] hover:text-[var(--fg)] hover:border-black/20 hover:bg-black/[0.03] active:translate-y-px",
  // 次级：浅灰面，悬浮加深
  subtle:
    "bg-black/[0.04] text-[var(--fg)] border border-[var(--line)] hover:bg-black/[0.06] hover:border-black/15 active:translate-y-px",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function Button({ variant = "primary", className = "", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm transition-[transform,box-shadow,background-color,border-color,filter] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${styles[variant]} ${className}`}
      {...props}
    />
  );
});
