import {
  DECISION_STYLE_SCALE_VALUES,
  decisionStyleScaleAccessibilityLabel,
  type DecisionStyleAnswerValue,
  type DecisionStyleQuestion,
} from "@/domain/decisionStyle";

export function DecisionStyleScale({
  question,
  value,
  disabled = false,
  onChange,
}: {
  question: DecisionStyleQuestion;
  value?: DecisionStyleAnswerValue;
  disabled?: boolean;
  onChange: (value: DecisionStyleAnswerValue) => void;
}) {
  return (
    <fieldset className="space-y-6" disabled={disabled}>
      <legend className="sr-only">{question.prompt}</legend>
      <div className="grid grid-cols-2 gap-5 text-base font-medium leading-6 text-[var(--fg)]">
        <p>{question.left.label}</p>
        <p className="text-right">{question.right.label}</p>
      </div>
      <div className="relative flex items-center justify-between gap-2 px-1 before:absolute before:left-6 before:right-6 before:top-1/2 before:h-px before:bg-[var(--line)]">
        {DECISION_STYLE_SCALE_VALUES.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-label={decisionStyleScaleAccessibilityLabel(question, option)}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(option)}
              className={`relative z-10 grid size-11 place-items-center rounded-full border transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] motion-reduce:transition-none ${selected ? "scale-110 border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]"}`}
            >
              <span className={`rounded-full ${selected ? "size-3 bg-white" : "size-2 bg-[var(--fg-faint)]"}`} />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
