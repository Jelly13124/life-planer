"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/prefs/PreferencesContext";

export function ShareActions() {
  const router = useRouter();
  const { t } = useT();
  return (
    <div className="mx-auto mt-5 flex w-full max-w-sm flex-col gap-2">
      <button
        onClick={() => router.push("/")}
        className="lp-tap inline-flex items-center justify-center rounded-full bg-[image:var(--grad-accent)] px-5 py-2.5 text-sm font-semibold text-white"
      >
        {t("测测你的人生树")}
      </button>
      <button
        onClick={() => router.push("/test")}
        className="lp-tap inline-flex items-center justify-center rounded-full border border-[var(--line)] px-5 py-2.5 text-sm text-[var(--fg-dim)] transition hover:text-[var(--fg)]"
      >
        {t("测职场人格")}
      </button>
    </div>
  );
}
