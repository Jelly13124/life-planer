/**
 * treeShareImage — pure builder for a self-contained shareable SVG of a LifeTree.
 *
 * Key constraints:
 *  - NO CSS variables (no `var(--...)`), colors are inlined as hex.
 *  - NO private structured fields (salary/savings/debt/assets/skills/snapshot).
 *  - Only what is already visible on the map: choice labels, summaries, curve shapes.
 *  - The origin dot may show profile.name (already shown on the live map).
 *  - Disclaimer ("可能的人生，不是预测的命运") always present at bottom.
 *  - Watermark in corner.
 */

import type { LifeTree } from "@/domain/types";
import { layoutMap } from "@/components/mapLayout";

// ── colors (inlined hex, no CSS vars) ────────────────────────────────────────
const BG = "#0a0a0f";
const FG = "#e5e7eb";
const FG_DIM = "#94a3b8";
const FG_FAINT = "#475569";
const SQ_STROKE = "#64748b";
const ORIGIN_STROKE = "#ffffff";
const DISCLAIMER_COLOR = "#ef4444"; // red line
const WATERMARK_COLOR = "#334155";

// ── SVG text escaping ─────────────────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ── public API ────────────────────────────────────────────────────────────────

export interface ShareLabels {
  disclaimer: string;
  watermark: string;
  now: string;
}

/**
 * Pure function — builds a complete, self-contained SVG string from a LifeTree.
 * No external stylesheets, no CSS variables, no DOM access.
 */
export function buildShareSvg(tree: LifeTree, labels: ShareLabels): string {
  const layout = layoutMap(tree.paths, tree.profile.age, tree.horizonYears);
  const W = layout.width;
  const H = layout.height;

  const lines: string[] = [];

  // ── root element ──────────────────────────────────────────────────────────
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
  );

  // ── dark background ───────────────────────────────────────────────────────
  lines.push(`  <rect x="0" y="0" width="${W}" height="${H}" fill="${BG}"/>`);

  // ── glow filter for choice paths ─────────────────────────────────────────
  lines.push(`  <defs>`);
  lines.push(
    `    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">` +
      `<feGaussianBlur stdDeviation="2.4" result="b"/>` +
      `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>` +
      `</filter>`,
  );
  lines.push(`  </defs>`);

  // ── paths ─────────────────────────────────────────────────────────────────
  for (const it of layout.items) {
    const isSq = it.kind === "status-quo";
    const stroke = isSq ? SQ_STROKE : it.color;
    const dash = isSq ? `stroke-dasharray="8 8"` : ``;
    const filter = isSq ? `` : `filter="url(#glow)"`;
    lines.push(
      `  <path d="${esc(it.dPath)}" fill="none" stroke="${stroke}" stroke-width="3" ` +
        `stroke-linecap="round" ${dash} ${filter}/>`,
    );

    // terminal dot
    lines.push(
      `  <circle cx="${it.end.x.toFixed(1)}" cy="${it.end.y.toFixed(1)}" r="5.5" fill="${stroke}"/>`,
    );

    // terminal label: choiceLabel + summary
    const labelX = (it.end.x + 14).toFixed(1);
    const labelY1 = (it.end.y - 3).toFixed(1);
    const labelY2 = (it.end.y + 15).toFixed(1);
    const choiceText = esc(truncate(it.choiceLabel, 12));
    const summaryText = esc(truncate(it.summary, 20));
    const labelFill = isSq ? FG_DIM : FG;
    lines.push(
      `  <text x="${labelX}" y="${labelY1}" font-size="15" font-weight="700" fill="${labelFill}" font-family="sans-serif">${choiceText}</text>`,
    );
    lines.push(
      `  <text x="${labelX}" y="${labelY2}" font-size="12" fill="${FG_DIM}" font-family="sans-serif">${summaryText}</text>`,
    );
  }

  // ── origin dot + "现在" label + profile.name ─────────────────────────────
  const ox = layout.origin.x.toFixed(1);
  const oy = layout.origin.y.toFixed(1);
  lines.push(
    `  <circle cx="${ox}" cy="${oy}" r="9" fill="${BG}" stroke="${ORIGIN_STROKE}" stroke-width="2"/>`,
  );
  lines.push(
    `  <text x="${ox}" y="${(layout.origin.y - 18).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="${FG}" font-family="sans-serif">${esc(labels.now)}</text>`,
  );
  // profile.name is already shown on the live map — acceptable here too
  if (tree.profile.name) {
    lines.push(
      `  <text x="${ox}" y="${(layout.origin.y + 28).toFixed(1)}" text-anchor="middle" font-size="12" fill="${FG_DIM}" font-family="sans-serif">${esc(tree.profile.name)}</text>`,
    );
  }

  // ── disclaimer (red line) at bottom ──────────────────────────────────────
  const disclaimerY = H - 18;
  lines.push(
    `  <text x="${(W / 2).toFixed(1)}" y="${disclaimerY}" text-anchor="middle" font-size="11" fill="${DISCLAIMER_COLOR}" font-family="sans-serif">${esc(labels.disclaimer)}</text>`,
  );

  // ── watermark in bottom-right corner ─────────────────────────────────────
  lines.push(
    `  <text x="${W - 12}" y="${disclaimerY}" text-anchor="end" font-size="10" fill="${WATERMARK_COLOR}" font-family="sans-serif">${esc(labels.watermark)}</text>`,
  );

  // ── faint grid lines (time axis ticks) ───────────────────────────────────
  const ageSpan = layout.maxAge - layout.minAge;
  const step = ageSpan > 24 ? 5 : ageSpan > 10 ? 3 : 2;
  for (let age = layout.minAge; age <= layout.maxAge + 0.001; age += step) {
    const tx = layout.xFor(age).toFixed(1);
    lines.push(
      `  <line x1="${tx}" y1="${layout.origin.y - H * 0.42}" x2="${tx}" y2="${layout.origin.y + H * 0.42}" stroke="${FG_FAINT}" stroke-width="1" stroke-dasharray="2 8" opacity="0.4"/>`,
    );
    lines.push(
      `  <text x="${tx}" y="${H - 34}" text-anchor="middle" font-size="10" fill="${FG_FAINT}" font-family="sans-serif">${age}</text>`,
    );
  }

  lines.push(`</svg>`);
  return lines.join("\n");
}

/**
 * Client-side helper — triggers a browser download of the SVG blob.
 * Guards against SSR: only runs when `document` is available.
 */
export function downloadShareSvg(svg: string, filename: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
