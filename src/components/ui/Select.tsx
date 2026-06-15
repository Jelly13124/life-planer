"use client";

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full cursor-pointer appearance-none rounded-xl border border-[var(--line)] bg-white/[0.04] px-4 py-3 pr-10 text-base text-[var(--fg)] outline-none transition focus:border-[var(--accent)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[var(--bg-1)] text-[var(--fg)]">
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--fg-faint)]">
        ▾
      </span>
    </div>
  );
}
