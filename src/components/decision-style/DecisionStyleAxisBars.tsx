import { AXES, AXIS_KEYS, type DecisionStyleAxisScores } from "@/domain/decisionStyle";

export function DecisionStyleAxisBars({
  scores,
  tendencies,
}: {
  scores: DecisionStyleAxisScores;
  tendencies: Record<(typeof AXIS_KEYS)[number], "轻微倾向" | "明显倾向">;
}) {
  return (
    <div className="space-y-4">
      {AXES.map((axis) => {
        const score = scores[axis.key];
        return (
          <div key={axis.key} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-[var(--fg)]">
                {axis.a.label} / {axis.b.label}
              </span>
              <span className="text-[var(--fg-dim)]">
                {score} / 100 · {tendencies[axis.key]}
              </span>
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-black/8"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-[image:var(--grad-accent)] transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${score}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--fg-faint)]">
              <span>{axis.a.letter} · {axis.a.label}</span>
              <span>{axis.b.letter} · {axis.b.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
