"use client";

import { useRouter } from "next/navigation";
import { DecisionStyleTest } from "@/components/decision-style/DecisionStyleTest";

export default function TestPage() {
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <DecisionStyleTest onContinueToTree={() => router.push("/")} />
    </main>
  );
}
