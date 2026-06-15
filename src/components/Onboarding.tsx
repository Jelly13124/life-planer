"use client";

import { useState } from "react";
import { AREA_LABELS, LIFE_AREAS, type LifeArea, type Profile } from "@/domain/types";
import { useApp } from "@/state/AppContext";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { Slider } from "./ui/Slider";

const DEFAULT_AREAS: Record<LifeArea, number> = {
  career: 50,
  wealth: 50,
  relationships: 50,
  health: 50,
  growth: 50,
};

export function Onboarding() {
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [age, setAge] = useState(28);
  const [snapshot, setSnapshot] = useState("");
  const [areas, setAreas] = useState<Record<LifeArea, number>>(DEFAULT_AREAS);
  const [crossroad, setCrossroad] = useState("");

  const step1Valid = name.trim().length > 0 && age >= 10 && age <= 100;
  const step2Valid = crossroad.trim().length > 0;

  function submit() {
    const profile: Profile = {
      name: name.trim(),
      age,
      snapshot: snapshot.trim(),
      areas,
      crossroad: crossroad.trim(),
    };
    completeOnboarding(profile);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <div className="animate-fade">
        <div className="text-xs uppercase tracking-[3px] text-[var(--fg-faint)]">
          Life Planner
        </div>
        <h1 className="mt-2 text-3xl font-bold">
          先认识一下<span className="text-[var(--accent)]">真实的你</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--fg-dim)]">
          这些信息只存在你自己的浏览器里。它们会让 AI 推演的人生更像你。
        </p>
      </div>

      {/* 进度 */}
      <div className="mt-8 flex gap-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{
              background: i <= step ? "var(--accent)" : "rgba(255,255,255,0.12)",
            }}
          />
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-5">
        {step === 0 ? (
          <>
            <Field label="你叫什么？">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="昵称即可，比如 阿明"
                className="px-4 py-3 text-base"
                autoFocus
              />
            </Field>
            <Field label="现在多大？" hint="决定人生树从哪一年开始生长">
              <input
                type="number"
                value={age}
                min={10}
                max={100}
                onChange={(e) => setAge(Number(e.target.value))}
                className="px-4 py-3 text-base"
              />
            </Field>
            <Field label="一句话描述现在的你" hint="可选，比如 在一家中厂做后端，单身">
              <textarea
                value={snapshot}
                onChange={(e) => setSnapshot(e.target.value)}
                rows={2}
                placeholder="现在的状态、在做的事、在意的东西……"
                className="resize-none px-4 py-3 text-base"
              />
            </Field>
            <Button
              variant="primary"
              disabled={!step1Valid}
              onClick={() => setStep(1)}
              className="mt-2 self-end"
            >
              下一步 →
            </Button>
          </>
        ) : (
          <>
            <div>
              <div className="text-sm font-medium">现在各方面的状态如何？</div>
              <div className="mt-1 text-xs text-[var(--fg-faint)]">
                凭感觉拖动即可（0 = 很差，100 = 很满意）。这是人生树的起点。
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {LIFE_AREAS.map((a) => (
                <Slider
                  key={a}
                  label={AREA_LABELS[a]}
                  value={areas[a]}
                  onChange={(v) => setAreas((prev) => ({ ...prev, [a]: v }))}
                />
              ))}
            </div>
            <Field
              label="你现在面临的一个岔路是？"
              hint="比如 要不要辞职创业 / 要不要换城市 / 要不要读研"
            >
              <textarea
                value={crossroad}
                onChange={(e) => setCrossroad(e.target.value)}
                rows={2}
                placeholder="写下一个你正在纠结的选择，它会成为第一条岔路"
                className="resize-none px-4 py-3 text-base"
              />
            </Field>
            <div className="mt-2 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                ← 返回
              </Button>
              <Button variant="primary" disabled={!step2Valid} onClick={submit}>
                ✨ 生成我的人生树
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
