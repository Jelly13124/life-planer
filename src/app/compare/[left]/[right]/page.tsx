import type { Metadata } from "next";
import {
  AXES,
  AXIS_KEYS,
  decisionPersonalityPresentationByCode,
  decisionPersonalityRelationshipLine,
  decisionStyleAxisStrength,
  type DecisionStyleAxis,
  type DecisionStyleLetter,
  type DecisionStylePublicPayload,
} from "@/domain/decisionStyle";
import { getDecisionStyleShareSecret, verifyDecisionStyleToken } from "@/lib/decisionStyleToken.server";
import { DecisionStyleAnalyticsBeacon } from "@/components/decision-style/DecisionStyleAnalyticsBeacon";
import { DecisionStyleCharacter } from "@/components/decision-style/DecisionStyleCharacter";
import {
  FALLBACK_DESCRIPTION,
  FALLBACK_TITLE,
  SafeRetestEntry,
} from "@/app/style/[code]/[token]/page";

interface ComparePayload {
  left: DecisionStylePublicPayload;
  right: DecisionStylePublicPayload;
}

function letterForAxis(payload: DecisionStylePublicPayload, axis: DecisionStyleAxis): DecisionStyleLetter {
  return payload.code[AXIS_KEYS.indexOf(axis)] as DecisionStyleLetter;
}

function axisDisplay(payload: DecisionStylePublicPayload, axis: DecisionStyleAxis) {
  const definition = AXES.find((item) => item.key === axis)!;
  const score = payload.scores[axis];
  const letter = score === 50
    ? letterForAxis(payload, axis)
    : score > 50
      ? definition.a.letter
      : definition.b.letter;
  const pole = letter === definition.a.letter ? definition.a : definition.b;
  return {
    score,
    letter,
    label: pole.label,
    tendency: decisionStyleAxisStrength(score),
  };
}

function differenceForAxis(compare: ComparePayload, axis: DecisionStyleAxis) {
  return Math.abs(compare.left.scores[axis] - compare.right.scores[axis]);
}

function closestAxis(compare: ComparePayload) {
  return AXIS_KEYS.reduce((best, axis) =>
    differenceForAxis(compare, axis) < differenceForAxis(compare, best) ? axis : best, AXIS_KEYS[0]);
}

function widestAxis(compare: ComparePayload) {
  return AXIS_KEYS.reduce((best, axis) =>
    differenceForAxis(compare, axis) > differenceForAxis(compare, best) ? axis : best, AXIS_KEYS[0]);
}

export async function resolveDecisionStyleComparePayload(
  params: Promise<{ left: string; right: string }>,
  secret = getDecisionStyleShareSecret(),
): Promise<ComparePayload | null> {
  if (!secret) return null;
  const { left, right } = await params;
  const leftPayload = verifyDecisionStyleToken(left, secret);
  const rightPayload = verifyDecisionStyleToken(right, secret);
  if (!leftPayload || !rightPayload) return null;
  return { left: leftPayload, right: rightPayload };
}

function metadataForPayload(compare: ComparePayload): Metadata {
  const leftPresentation = decisionPersonalityPresentationByCode(compare.left.code);
  const rightPresentation = decisionPersonalityPresentationByCode(compare.right.code);
  return {
    title: `${leftPresentation?.label ?? compare.left.code} × ${rightPresentation?.label ?? compare.right.code} 对照 | Life Planner`,
    description: "查看两份已验证的决策人格，以及四轴当前倾向的相近与差异之处。",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ left: string; right: string }>;
}): Promise<Metadata> {
  const compare = await resolveDecisionStyleComparePayload(params);
  return compare ? metadataForPayload(compare) : { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION };
}

export default async function Page({
  params,
}: {
  params: Promise<{ left: string; right: string }>;
}) {
  const compare = await resolveDecisionStyleComparePayload(params);
  if (!compare) return <SafeRetestEntry />;

  const nearest = closestAxis(compare);
  const furthest = widestAxis(compare);
  const nearestAxis = AXES.find((item) => item.key === nearest)!;
  const furthestAxis = AXES.find((item) => item.key === furthest)!;
  const leftPresentation = decisionPersonalityPresentationByCode(compare.left.code);
  const rightPresentation = decisionPersonalityPresentationByCode(compare.right.code);
  if (!leftPresentation || !rightPresentation) return <SafeRetestEntry />;

  const people = [
    { payload: compare.left, presentation: leftPresentation, role: "你" },
    { payload: compare.right, presentation: rightPresentation, role: "TA" },
  ] as const;

  return (
    <main
      className="min-h-dvh px-4 pb-14 pt-6 text-[#251f1a] sm:px-6 sm:pb-20 sm:pt-10"
      style={{
        background:
          "radial-gradient(circle at 16% 4%, rgba(255,253,249,0.96) 0, rgba(255,253,249,0) 30%), #f4eadf",
      }}
    >
      <div className="mx-auto flex w-full max-w-[61.25rem] flex-col gap-5 font-display">
        <DecisionStyleAnalyticsBeacon event="style_compare_complete" source="compare" />

        <section
          aria-labelledby="friend-comparison-title"
          className="animate-fade overflow-hidden rounded-[1.75rem] bg-[#fffdf9] px-5 pb-6 pt-6 shadow-[0_1.5rem_4rem_rgba(88,57,37,0.12)] sm:rounded-[2rem] sm:px-7 sm:pb-7 sm:pt-7"
        >
          <p className="m-0 text-xs font-semibold tracking-[0.18em] text-[#6d5f54] sm:text-[0.8125rem]">
            朋友决策人格对照
          </p>

          <h1
            id="friend-comparison-title"
            className="mb-0 mt-4 max-w-[46rem] text-balance text-[clamp(2rem,6vw,3.25rem)] font-black leading-[1.05] tracking-[-0.045em]"
          >
            你们做决定，像两套不同的操作系统
          </h1>

          <div className="mt-7 grid gap-3.5 md:grid-cols-2">
            {people.map(({ payload, presentation, role }, index) => (
              <article
                key={`${payload.code}-${index}`}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center overflow-hidden rounded-[1.25rem] bg-[#f4eadf] pl-5 sm:pl-6"
              >
                <div className="relative z-10 min-w-0 py-5">
                  <p className="m-0 text-xs font-semibold tracking-[0.16em] text-[#6d5f54]">{role}</p>
                  <h2 className="mb-0 mt-2 text-[clamp(1.875rem,6vw,2.5rem)] font-black leading-none tracking-[-0.055em]">
                    {payload.code}
                  </h2>
                  <p className="mb-0 mt-2 text-base font-bold text-[#5a3d2b] sm:text-lg">
                    {presentation.label}
                  </p>
                </div>
                <DecisionStyleCharacter
                  code={payload.code}
                  size={150}
                  className="h-auto w-[clamp(6.5rem,20vw,9.375rem)] self-end drop-shadow-[0_0.8rem_1rem_rgba(92,58,34,0.13)]"
                />
              </article>
            ))}
          </div>

          <p className="mb-0 mt-3.5 rounded-[1.25rem] bg-[#2d2925] px-5 py-5 text-[clamp(1.125rem,3vw,1.375rem)] font-semibold leading-[1.55] tracking-[-0.015em] text-[#fffaf4] sm:px-6 sm:py-5">
            {decisionPersonalityRelationshipLine(compare.left.code, compare.right.code, furthest)}
          </p>
        </section>

        <section aria-label="相近与差异摘要" className="grid gap-3 md:grid-cols-[0.92fr_1.08fr]">
          <article className="animate-pop rounded-[1.25rem] bg-[#ead8c7] p-5 sm:p-6">
            <h2 className="m-0 text-sm font-bold tracking-[0.03em] text-[#7a3d22]">
              最接近：{nearestAxis.a.label} / {nearestAxis.b.label}
            </h2>
            <p className="mb-0 mt-2 leading-7 text-[#5d4638]">
              分差 {differenceForAxis(compare, nearest)}，是你们此刻最接近的一组倾向。
            </p>
          </article>
          <article
            className="animate-pop rounded-[1.25rem] bg-[#fffdf9] p-5 shadow-[0_0.75rem_2rem_rgba(88,57,37,0.08)] sm:p-6"
            style={{ animationDelay: "80ms" }}
          >
            <h2 className="m-0 text-sm font-bold tracking-[0.03em] text-[#7a3d22]">
              差异最大：{furthestAxis.a.label} / {furthestAxis.b.label}
            </h2>
            <p className="mb-0 mt-2 leading-7 text-[#5d4638]">
              分差 {differenceForAxis(compare, furthest)}，是你们此刻差距更明显的一组倾向。
            </p>
          </article>
        </section>

        <section
          aria-label="四轴倾向明细"
          className="grid gap-3 md:grid-cols-2"
        >
          {AXES.map((axis, axisIndex) => {
            const left = axisDisplay(compare.left, axis.key);
            const right = axisDisplay(compare.right, axis.key);
            return (
              <article
                key={axis.key}
                className="animate-fade flex flex-col gap-4 rounded-[1.25rem] bg-[#fffdf9] p-5 shadow-[0_0.75rem_2rem_rgba(88,57,37,0.08)] sm:p-6"
                style={{ animationDelay: `${120 + axisIndex * 55}ms` }}
              >
                <div>
                  <h2 className="m-0 text-xl font-bold tracking-[-0.02em]">
                    {axis.a.label} / {axis.b.label}
                  </h2>
                  <p className="mb-0 mt-2 text-sm leading-6 text-[#75685d]">
                    一边是你，一边是 TA，只看这次自报的选择倾向。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[left, right].map((item, index) => (
                    <div key={`${axis.key}-${index}`} className="min-w-0 rounded-[1rem] bg-[#f4eadf] p-3.5 sm:p-4">
                      <p className="m-0 text-xs font-semibold tracking-[0.12em] text-[#74665b]">
                        {index === 0 ? "你" : "TA"}
                      </p>
                      <p className="mb-0 mt-2 text-[clamp(1.125rem,4vw,1.375rem)] font-black tabular-nums tracking-[-0.035em]">
                        {item.score} / 100
                      </p>
                      <p className="mb-0 mt-2 text-sm font-semibold text-[#4c3d32]">{item.tendency}</p>
                      <p className="mb-0 mt-1 text-sm leading-5 text-[#695c52]">
                        {item.letter} · {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
