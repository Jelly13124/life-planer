import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareCard } from "./ShareCard";
import { ShareActions } from "./ShareActions";
import { fetchSharePayload } from "./shareData";
import { SHARE_DOMAIN } from "@/lib/shareConfig";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const payload = await fetchSharePayload(id);
  if (!payload) return { title: "人生树 Life Planner" };

  const title = `${payload.title} · 人生树`;
  const description =
    payload.subtitle || payload.quote || payload.items?.[0]?.label || "AI 推演的可能人生 · 人生树 Life Planner";
  const url = `https://${SHARE_DOMAIN}/s/${id}`;
  return {
    title,
    description,
    openGraph: { title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await fetchSharePayload(id);
  if (!payload) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <ShareCard payload={payload} />
      <ShareActions />
    </main>
  );
}
