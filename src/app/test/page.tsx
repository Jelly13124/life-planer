"use client";

import { useRouter } from "next/navigation";
import { LifePathTest } from "@/components/LifePathTest";

export default function TestPage() {
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <LifePathTest
        onDone={({ code, answers }) => {
          try {
            sessionStorage.setItem("lp.lifePath", JSON.stringify({ code, answers }));
          } catch {
            /* sessionStorage 不可用时无所谓，码已在 URL */
          }
          router.push(`/t/${code}`);
        }}
      />
    </main>
  );
}
