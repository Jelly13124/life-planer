import type { LifePathType } from "@/domain/lifePathCode";

const BG = "#ffffff";
const FG = "#1d1d1f";
const FG_DIM = "#6e6e73";
const FG_FAINT = "#8e8e93";
const LINE = "#e5e5ea";
const LIGHT_C = "#0F6E56";
const SHADOW_C = "#A32D2D";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface CardLabels { domain: string; disclaimer: string }

export function buildLifePathCardSvg(t: LifePathType, labels: CardLabels): string {
  const W = 600, H = 860, cx = W / 2;
  const accent = /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : "#D85A30";
  const L: string[] = [];
  L.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`);
  L.push(`  <rect x="0" y="0" width="${W}" height="${H}" fill="${BG}"/>`);
  L.push(`  <rect x="0" y="0" width="${W}" height="10" fill="${accent}"/>`);
  L.push(`  <text x="${cx}" y="88" text-anchor="middle" font-size="20" fill="${FG_FAINT}" font-family="sans-serif">职场人格测试 · 我的结果</text>`);
  L.push(`  <text x="${cx}" y="200" text-anchor="middle" font-size="92" font-weight="800" letter-spacing="8" fill="${accent}" font-family="sans-serif">${esc(t.code)}</text>`);
  L.push(`  <text x="${cx}" y="278" text-anchor="middle" font-size="44" font-weight="700" fill="${FG}" font-family="sans-serif">${esc(t.nickname)}</text>`);
  L.push(`  <text x="${cx}" y="330" text-anchor="middle" font-size="21" fill="${FG_DIM}" font-family="sans-serif">${esc(t.teaser)}</text>`);
  L.push(`  <text x="56" y="424" font-size="22" font-weight="700" fill="${LIGHT_C}" font-family="sans-serif">光</text>`);
  L.push(`  <text x="104" y="424" font-size="21" fill="${FG_DIM}" font-family="sans-serif">${esc(t.light)}</text>`);
  L.push(`  <text x="56" y="470" font-size="22" font-weight="700" fill="${SHADOW_C}" font-family="sans-serif">影</text>`);
  L.push(`  <text x="104" y="470" font-size="21" fill="${FG_DIM}" font-family="sans-serif">${esc(t.shadow)}</text>`);
  L.push(`  <text x="56" y="520" font-size="21" fill="${FG_DIM}" font-family="sans-serif">打法：${esc(t.workStyle)}</text>`);
  L.push(`  <rect x="56" y="560" width="${W - 112}" height="110" rx="16" fill="#f5f5f7"/>`);
  L.push(`  <text x="80" y="608" font-size="22" fill="${FG_DIM}" font-family="sans-serif">这条路现实可行度</text>`);
  L.push(`  <text x="${W - 80}" y="620" text-anchor="end" font-size="48" font-weight="700" fill="${FG}" font-family="sans-serif">约 ${t.feasibility}%</text>`);
  L.push(`  <text x="80" y="646" font-size="16" fill="${FG_FAINT}" font-family="sans-serif">${esc(labels.disclaimer)}</text>`);
  L.push(`  <line x1="56" y1="752" x2="${W - 56}" y2="752" stroke="${LINE}" stroke-width="1"/>`);
  L.push(`  <text x="56" y="800" font-size="24" font-weight="700" fill="${accent}" font-family="sans-serif">28 题测你的 →</text>`);
  L.push(`  <text x="${W - 56}" y="800" text-anchor="end" font-size="18" fill="${FG_FAINT}" font-family="sans-serif">${esc(labels.domain)}</text>`);
  L.push(`</svg>`);
  return L.join("\n");
}

export { downloadShareSvg } from "./treeShareImage";
