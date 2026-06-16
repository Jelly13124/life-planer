"use client";

import { useEffect, useState } from "react";
import { useT } from "@/prefs/PreferencesContext";

export interface PredictionOverlayProps {
  labels: string[]; // 正在推演的选择标签，可能为空（仅维持现状）
  done: number; // 已完成的预测数
  total: number; // 在途的预测总数（>=1）
  context: "onboarding" | "branch"; // 首次建图 vs 加岔路
  aiEnabled: boolean; // false = 没有真实模型；措辞避免暗示在线大模型
}

const STEPS = [
  "读取此刻的你",
  "寻找现实里的转折点",
  "推演十年后的样子",
  "校对签证 / 薪资 / 城市的可信度",
  "把每条时间线画出来",
] as const;

// 分支曲线：accent / fuchsia / emerald —— 与真实路径配色同源
const BRANCHES = [
  { d: "M 70 130 C 150 130 188 86 270 80", color: "var(--accent)" },
  { d: "M 110 130 C 190 130 226 132 300 130", color: "var(--c-fuchsia)" },
  { d: "M 92 130 C 170 130 206 176 286 188", color: "var(--c-emerald)" },
] as const;

function usePrefersReducedMotion(): boolean {
  // 客户端首帧读取，SSR 安全；变化时同步更新。
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function PredictionOverlay({
  labels,
  done,
  total,
  context,
  aiEnabled,
}: PredictionOverlayProps) {
  const reduced = usePrefersReducedMotion();
  const { t } = useT();
  const [stepIdx, setStepIdx] = useState(0);

  // 微文案轮播：每 ~1.4s 切换一行，让等待显得在“认真计算”。
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(
      () => setStepIdx((i) => (i + 1) % STEPS.length),
      1400,
    );
    return () => window.clearInterval(id);
  }, [reduced]);

  const title =
    context === "onboarding" ? t("正在推演你的人生地图…") : t("正在推演这条路…");
  const lead = aiEnabled
    ? t("正在结合你的真实处境逐条推演")
    : t("正在依据你填写的信息逐条推演");
  const multi = total > 1;
  const pct = multi ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("AI 正在推演你的人生")}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 38%, rgba(27,31,58,0.86) 0%, rgba(10,11,26,0.94) 60%, var(--bg-0) 100%)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        animation: reduced ? undefined : "po-enter .5s ease both",
      }}
    >
      {/* 中央母题：一条主时间线 + 三条分叉，边画边发光 */}
      <svg
        viewBox="0 0 360 260"
        width="320"
        className="max-w-[78vw]"
        aria-hidden
      >
        <defs>
          <filter id="po-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 现状基线：灰色虚线，恒定，作为“维持现状”的锚 */}
        <line
          x1={70}
          y1={130}
          x2={330}
          y2={130}
          stroke="var(--c-slate)"
          strokeWidth={2}
          strokeDasharray="7 8"
          strokeLinecap="round"
          opacity={0.7}
        />

        {/* 三条命运分叉：依次绘出 */}
        {BRANCHES.map((b, i) => (
          <g key={i}>
            <path
              d={b.d}
              fill="none"
              stroke={b.color}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeDasharray={reduced ? undefined : 300}
              strokeDashoffset={reduced ? undefined : 300}
              style={{
                filter: `drop-shadow(0 0 5px ${b.color}88)`,
                animation: reduced
                  ? undefined
                  : `po-draw 1.7s cubic-bezier(0.2,0.7,0.2,1) ${0.25 + i * 0.45}s infinite`,
              }}
            />
            {/* 终点光点：在曲线画到尽头时点亮、再脉动 */}
            <circle
              cx={Number(b.d.split(" ").slice(-2)[0])}
              cy={Number(b.d.split(" ").slice(-1)[0])}
              r={3.5}
              fill={b.color}
              style={{
                filter: `drop-shadow(0 0 6px ${b.color})`,
                animation: reduced
                  ? undefined
                  : `po-spark 1.7s ease-in-out ${0.25 + i * 0.45}s infinite`,
                transformOrigin: "center",
              }}
            />
          </g>
        ))}

        {/* 起点：呼吸脉冲的“现在” */}
        <circle
          cx={70}
          cy={130}
          r={6}
          fill="var(--bg-1)"
          stroke="#fff"
          strokeWidth={2}
          filter="url(#po-glow)"
          style={{
            transformOrigin: "70px 130px",
            animation: reduced ? undefined : "po-breathe 2.4s ease-in-out infinite",
          }}
        />

        {/* 漂浮微粒：沿主线缓缓上行，营造“正在计算”的尘埃感 */}
        {!reduced &&
          [0, 1, 2, 3, 4].map((i) => (
            <circle
              key={`p${i}`}
              cx={96 + i * 52}
              cy={130}
              r={1.4}
              fill="var(--fg-faint)"
              style={{
                animation: `po-float 3.2s ease-in-out ${i * 0.5}s infinite`,
              }}
            />
          ))}
      </svg>

      {/* 标题 + 引导语 */}
      <div
        className="mt-7 text-center"
        style={{ animation: reduced ? undefined : "po-rise .6s ease .15s both" }}
      >
        <div className="text-[11px] uppercase tracking-[3px] text-[var(--fg-faint)]">
          Life Planner
        </div>
        <h2 className="mt-2 text-xl font-bold text-[var(--fg)] sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-[var(--fg-dim)]">{lead}</p>
      </div>

      {/* 轮播微文案：固定高度，避免跳动 */}
      <div className="mt-5 flex h-5 items-center justify-center">
        <span
          key={reduced ? "static" : stepIdx}
          className="inline-flex items-center gap-2 text-[13px] text-[var(--fg-dim)]"
          style={{ animation: reduced ? undefined : "po-swap .5s ease both" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
            style={{
              animation: reduced ? undefined : "po-blink 1.4s ease-in-out infinite",
            }}
          />
          {reduced ? t("正在推演，请稍候") : t(STEPS[stepIdx])}
        </span>
      </div>

      {/* 进度：多条显示计数 + 进度条；单条用流光 shimmer */}
      <div className="mt-6 w-full max-w-[280px]">
        {multi ? (
          <>
            <div className="mb-2 flex items-baseline justify-between text-xs">
              <span className="text-[var(--fg-faint)]">
                {t("已推演 {done} / {total} 条路", { done: Math.min(done, total), total })}
              </span>
              <span className="tabular-nums text-[var(--fg-dim)]">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(pct, 6)}%`,
                  background:
                    "linear-gradient(90deg, var(--accent), var(--c-fuchsia))",
                  transition: "width .6s cubic-bezier(0.2,0.7,0.2,1)",
                }}
              />
            </div>
          </>
        ) : (
          <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full w-1/3 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--accent), var(--c-fuchsia), transparent)",
                animation: reduced ? undefined : "po-shimmer 1.5s ease-in-out infinite",
              }}
            />
          </div>
        )}
      </div>

      {/* 选择标签：以小药丸呈现正在推演的几条路 */}
      {labels.length > 0 && (
        <div
          className="mt-5 flex max-w-[80vw] flex-wrap items-center justify-center gap-2"
          style={{ animation: reduced ? undefined : "po-rise .6s ease .3s both" }}
        >
          {labels.slice(0, 4).map((label, i) => {
            const reached = i < done;
            return (
              <span
                key={`${label}-${i}`}
                className="rounded-full border px-3 py-1 text-xs transition-colors"
                style={{
                  borderColor: reached ? "var(--accent)" : "var(--line)",
                  color: reached ? "var(--fg)" : "var(--fg-dim)",
                  background: reached
                    ? "rgba(167,139,250,0.12)"
                    : "rgba(255,255,255,0.03)",
                }}
              >
                {reached ? "✓ " : ""}
                {truncate(label, 12)}
              </span>
            );
          })}
          {labels.length > 4 && (
            <span className="text-xs text-[var(--fg-faint)]">
              +{labels.length - 4}
            </span>
          )}
        </div>
      )}

      {/* 作用域内 keyframes：全部 po- 前缀，避免与 globals.css 冲突 */}
      <style>{`
        @keyframes po-enter { from { opacity: 0 } to { opacity: 1 } }
        @keyframes po-rise {
          from { opacity: 0; transform: translateY(10px) }
          to { opacity: 1; transform: translateY(0) }
        }
        @keyframes po-swap {
          from { opacity: 0; transform: translateY(4px) }
          to { opacity: 1; transform: translateY(0) }
        }
        @keyframes po-draw {
          0% { stroke-dashoffset: 300 }
          55% { stroke-dashoffset: 0 }
          85% { stroke-dashoffset: 0; opacity: 1 }
          100% { stroke-dashoffset: 0; opacity: 0.35 }
        }
        @keyframes po-spark {
          0%, 45% { opacity: 0; transform: scale(0.4) }
          60% { opacity: 1; transform: scale(1.25) }
          85% { opacity: 1; transform: scale(1) }
          100% { opacity: 0.3; transform: scale(0.9) }
        }
        @keyframes po-breathe {
          0%, 100% { opacity: 1; transform: scale(1) }
          50% { opacity: 0.6; transform: scale(1.25) }
        }
        @keyframes po-float {
          0% { opacity: 0; transform: translateY(6px) }
          40% { opacity: 0.8 }
          100% { opacity: 0; transform: translateY(-16px) }
        }
        @keyframes po-blink {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.3 }
        }
        @keyframes po-shimmer {
          0% { transform: translateX(-130%) }
          100% { transform: translateX(360%) }
        }
      `}</style>
    </div>
  );
}
