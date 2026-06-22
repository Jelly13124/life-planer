"use client";

import { useT } from "@/prefs/PreferencesContext";

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const { t } = useT();
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full cursor-pointer appearance-none rounded-xl border border-[var(--line)] bg-black/[0.03] px-4 py-3 pr-10 text-base text-[var(--fg)] outline-none transition [color-scheme:light] focus:border-[var(--accent)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[var(--bg-1)] text-[var(--fg)]">
            {t(o.label)}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--fg-faint)]">
        ▾
      </span>
    </div>
  );
}
