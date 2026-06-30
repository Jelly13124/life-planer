"use client";

import type { LifePathType } from "@/domain/lifePathCode";
import { useT } from "@/prefs/PreferencesContext";
import { SHARE_DOMAIN } from "@/lib/shareConfig";
import { buildLifePathCardSvg, downloadShareSvg } from "@/lib/lifePathCardImage";

const DISCLAIMER = "AI 粗估，非精确概率 · 会随你的真实努力上升";

export function LifePathCard({ type }: { type: LifePathType }) {
  const { t } = useT();
  function onDownload() {
    const svg = buildLifePathCardSvg(type, { domain: SHARE_DOMAIN, disclaimer: "AI 粗估，非精确概率" });
    downloadShareSvg(svg, `career-type-${type.code}.svg`);
  }
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="lp-card overflow-hidden p-5" style={{ borderTop: `4px solid ${type.color}` }}>
        <div className="mb-3 flex items-center justify-between text-[11px] text-[var(--fg-faint)]">
          <span>{t("职场人格测试 · 我的结果")}</span><span>{t("人生树")}</span>
        </div>
        <div className="mb-2 flex gap-1.5">
          {type.code.split("").map((ch, i) => (
            <span key={i} className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold" style={{ backgroundColor: `${type.color}1a`, color: type.color }}>{ch}</span>
          ))}
        </div>
        <div className="text-[26px] font-semibold text-[var(--fg)]">{type.nickname}</div>
        <p className="mt-1 text-sm leading-relaxed text-[var(--fg-dim)]">{type.teaser}</p>
        <div className="mt-4 flex gap-2 text-[13px]"><span className="font-semibold text-[var(--c-emerald)]">{t("光")}</span><span className="text-[var(--fg-dim)]">{type.light}</span></div>
        <div className="mt-1.5 flex gap-2 text-[13px]"><span className="font-semibold text-[var(--c-rose)]">{t("影")}</span><span className="text-[var(--fg-dim)]">{type.shadow}</span></div>
        <div className="mt-1.5 flex gap-2 text-[13px]"><span className="font-semibold text-[var(--fg-faint)]">{t("打法")}</span><span className="text-[var(--fg-dim)]">{type.workStyle}</span></div>
        <div className="mt-4 rounded-2xl bg-[var(--bg-2)] px-3 py-2.5">
          <div className="flex items-baseline justify-between"><span className="text-[13px] text-[var(--fg-dim)]">{t("这条路现实可行度")}</span><span className="text-xl font-semibold text-[var(--fg)]">{t("约 {n}%", { n: type.feasibility })}</span></div>
          <p className="mt-1 text-[11px] text-[var(--fg-faint)]">{DISCLAIMER}</p>
        </div>
      </div>
      <button onClick={onDownload} className="lp-tap mt-3 inline-flex w-full items-center justify-center rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg-dim)] transition hover:border-[var(--accent)]/60 hover:text-[var(--fg)]">
        {t("保存这张卡")}
      </button>
    </div>
  );
}
