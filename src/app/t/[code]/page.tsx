import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { typeByCode } from "@/domain/lifePathCode";
import { LifePathCard } from "@/components/LifePathCard";
import { ResultActions } from "./ResultActions";
import { SHARE_DOMAIN } from "@/lib/shareConfig";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const t = typeByCode(code.toUpperCase());
  if (!t) return { title: "职场人格测试" };
  const title = `${t.code} · ${t.nickname} | 职场人格测试`;
  const description = `${t.teaser} ｜ 28 题测你的职场人格`;
  return { title, description, openGraph: { title, description, url: `https://${SHARE_DOMAIN}/t/${t.code}` }, twitter: { card: "summary_large_image", title, description } };
}

export default async function ResultPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const type = typeByCode(code.toUpperCase());
  if (!type) notFound();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <LifePathCard type={type} />
      <ResultActions />
    </main>
  );
}
