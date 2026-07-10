import { decisionStyleTypeByCode, scoreDecisionStyle, type DecisionStyleEvidence, type DecisionStyleSummary } from "@/domain/decisionStyle";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DecisionStyleAxisBars } from "./DecisionStyleAxisBars";

export function DecisionStyleResult({
  summary,
  evidence,
  onContinue,
  onRestart,
}: {
  summary: DecisionStyleSummary;
  evidence: DecisionStyleEvidence[];
  onContinue: () => void;
  onRestart: () => void;
}) {
  const type = decisionStyleTypeByCode(summary.code);
  const tendencies = scoreDecisionStyle(summary.source, [], {}).tendencies;
  for (const [axis, score] of Object.entries(summary.scores)) {
    tendencies[axis as keyof typeof tendencies] = score >= 45 && score <= 55 ? "轻微倾向" : "明显倾向";
  }

  return (
    <div className="space-y-5">
      <Card pad="lg" className="space-y-4">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--fg-faint)]">
            职业决策风格测试
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-3xl font-semibold text-[var(--fg)]">{summary.code}</div>
              <div className="mt-1 text-lg text-[var(--fg-dim)]">{type?.label ?? "当前倾向"}</div>
            </div>
            <div className="text-sm text-[var(--fg-dim)]">
              {summary.source === "full" ? "28 题完整版" : "快测"}
            </div>
          </div>
        </div>

        <DecisionStyleAxisBars scores={summary.scores} tendencies={tendencies} />

        {type ? (
          <div className="grid gap-3 text-sm text-[var(--fg-dim)] sm:grid-cols-2">
            <Card pad="sm" sunken className="space-y-1">
              <div className="font-medium text-[var(--fg)]">优势</div>
              <p>{type.strength}</p>
            </Card>
            <Card pad="sm" sunken className="space-y-1">
              <div className="font-medium text-[var(--fg)]">代价</div>
              <p>{type.cost}</p>
            </Card>
            <Card pad="sm" sunken className="space-y-1">
              <div className="font-medium text-[var(--fg)]">决策建议</div>
              <p>{type.advice}</p>
            </Card>
            <Card pad="sm" sunken className="space-y-1">
              <div className="font-medium text-[var(--fg)]">张力</div>
              <p>{type.tension}</p>
            </Card>
          </div>
        ) : null}

        <Card pad="sm" sunken className="space-y-2">
          <div className="font-medium text-[var(--fg)]">本地结果依据</div>
          <ul className="space-y-2 text-sm text-[var(--fg-dim)]">
            {evidence.map((item) => (
              <li key={`${item.axis}-${item.questionId}`} className="list-disc pl-2 ml-4">
                {item.choiceLabel}
              </li>
            ))}
          </ul>
        </Card>

        <p className="text-sm text-[var(--fg-dim)]">当前倾向，不是固定人格。</p>
      </Card>

      <div className="flex flex-col gap-3">
        <Button type="button" disabled className="min-h-11">
          一键分享
        </Button>
        <Button type="button" variant="subtle" disabled className="min-h-11">
          复制链接
        </Button>
        <Button type="button" variant="subtle" disabled className="min-h-11">
          保存 PNG
        </Button>
        <Button type="button" variant="subtle" className="min-h-11" onClick={onContinue}>
          继续生成人生树
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" onClick={onRestart}>
          重新测试
        </Button>
      </div>
    </div>
  );
}
