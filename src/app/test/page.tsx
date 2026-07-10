"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AppProvider } from "@/state/AppContext";
import { DecisionStyleTest } from "@/components/decision-style/DecisionStyleTest";

export default function TestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  return (
    <AppProvider>
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <DecisionStyleTest
          inviteToken={inviteToken}
          onCompareReady={(path) => router.push(path)}
          onInviteCleared={() => router.replace("/test", { scroll: false })}
          onContinueToTree={() => router.push("/")}
        />
      </main>
    </AppProvider>
  );
}
