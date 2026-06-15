"use client";

import { useState } from "react";
import type {
  EducationLevel,
  Profile,
  RelationshipStatus,
  SalaryBand,
} from "@/domain/types";
import {
  buildSnapshot,
  deriveAreas,
  EDUCATION_OPTIONS,
  RELATIONSHIP_OPTIONS,
  SALARY_OPTIONS,
} from "@/domain/profile";
import { useApp } from "@/state/AppContext";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { Select } from "./ui/Select";

const TOTAL_STEPS = 3;

export function Onboarding() {
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [age, setAge] = useState(28);
  const [education, setEducation] = useState<EducationLevel>("bachelor");
  const [major, setMajor] = useState("");

  const [occupation, setOccupation] = useState("");
  const [salary, setSalary] = useState<SalaryBand>("5to10");
  const [hasSideHustle, setHasSideHustle] = useState(false);
  const [sideHustle, setSideHustle] = useState("");

  const [relationship, setRelationship] = useState<RelationshipStatus>("single");
  const [hobbies, setHobbies] = useState("");
  const [crossroad, setCrossroad] = useState("");

  const step0Valid = name.trim().length > 0 && age >= 10 && age <= 100;
  const finalValid = crossroad.trim().length > 0;

  function submit() {
    const inputs = {
      name: name.trim(),
      age,
      education,
      major: major.trim(),
      occupation: occupation.trim(),
      salary,
      hasSideHustle,
      sideHustle: sideHustle.trim(),
      hobbies: hobbies.trim(),
      relationship,
      crossroad: crossroad.trim(),
    };
    const profile: Profile = {
      ...inputs,
      snapshot: buildSnapshot(inputs),
      areas: deriveAreas(inputs),
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
          填得越具体，AI 推演的人生越像你。这些信息只存在你自己的浏览器里。
        </p>
      </div>

      {/* 进度 */}
      <div className="mt-8 flex gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i <= step ? "var(--accent)" : "rgba(255,255,255,0.12)" }}
          />
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-5">
        {step === 0 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="昵称">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="比如 阿明"
                  className="px-4 py-3 text-base"
                  autoFocus
                />
              </Field>
              <Field label="年龄">
                <input
                  type="number"
                  value={age}
                  min={10}
                  max={100}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="px-4 py-3 text-base"
                />
              </Field>
            </div>
            <Field label="最高学历">
              <Select value={education} onChange={setEducation} options={EDUCATION_OPTIONS} />
            </Field>
            <Field label="专业" hint="可选，比如 计算机 / 会计 / 临床医学">
              <input
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="学的是什么专业"
                className="px-4 py-3 text-base"
              />
            </Field>
            <Button
              variant="primary"
              disabled={!step0Valid}
              onClick={() => setStep(1)}
              className="mt-2 self-end"
            >
              下一步 →
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="现在的职业" hint="可选，比如 后端工程师 / 中学老师 / 自由职业">
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="现在靠什么谋生"
                className="px-4 py-3 text-base"
                autoFocus
              />
            </Field>
            <Field label="月薪区间">
              <Select value={salary} onChange={setSalary} options={SALARY_OPTIONS} />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">有没有副业？</span>
              <div className="flex gap-2">
                <Button
                  variant={hasSideHustle ? "primary" : "subtle"}
                  onClick={() => setHasSideHustle(true)}
                >
                  有
                </Button>
                <Button
                  variant={!hasSideHustle ? "primary" : "subtle"}
                  onClick={() => setHasSideHustle(false)}
                >
                  没有
                </Button>
              </div>
            </div>
            {hasSideHustle && (
              <Field label="副业是什么" hint="可选，比如 做自媒体 / 摆摊 / 接私活">
                <input
                  type="text"
                  value={sideHustle}
                  onChange={(e) => setSideHustle(e.target.value)}
                  placeholder="在做的副业"
                  className="px-4 py-3 text-base"
                />
              </Field>
            )}
            <div className="mt-2 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                ← 返回
              </Button>
              <Button variant="primary" onClick={() => setStep(2)}>
                下一步 →
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="情感 / 婚姻状态">
              <Select
                value={relationship}
                onChange={setRelationship}
                options={RELATIONSHIP_OPTIONS}
              />
            </Field>
            <Field label="爱好" hint="可选，比如 跑步、摄影、打游戏">
              <input
                type="text"
                value={hobbies}
                onChange={(e) => setHobbies(e.target.value)}
                placeholder="平时喜欢做什么"
                className="px-4 py-3 text-base"
              />
            </Field>
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
                autoFocus
              />
            </Field>
            <div className="mt-2 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                ← 返回
              </Button>
              <Button variant="primary" disabled={!finalValid} onClick={submit}>
                ✨ 生成我的人生树
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
