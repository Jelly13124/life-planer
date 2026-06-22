"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "subtle";

const styles: Record<Variant, string> = {
  // 主操作：紫→品红渐变 + 紫调辉光，悬浮微抬升、按下回弹
  primary:
    "bg-[image:var(--grad-accent)] text-[#11132a] font-semibold shadow-[0_10px_28px_-8px_rgba(167,139,250,0.55),0_1px_0_0_rgba(255,255,255,0.25)_inset] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-10px_rgba(167,139,250,0.65),0_1px_0_0_rgba(255,255,255,0.3)_inset] hover:brightness-[1.04] active:translate-y-0 active:brightness-95",
  // 幽灵：克制描边，悬浮提亮文字与紫色描边
  ghost:
    "bg-transparent text-[var(--fg-dim)] border border-[var(--line)] hover:text-[var(--fg)] hover:border-[rgba(167,139,250,0.5)] hover:bg-white/[0.03] active:translate-y-px",
  // 次级：玻璃面，悬浮加亮 + 顶缘高光
  subtle:
    "bg-white/[0.06] text-[var(--fg)] border border-[var(--line)] shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] hover:bg-white/[0.1] hover:border-[rgba(167,139,250,0.3)] active:translate-y-px",
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
