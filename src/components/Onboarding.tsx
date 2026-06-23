"use client";

import { useState } from "react";
import type {
  DebtBand,
  EducationLevel,
  FamilyResponsibility,
  Profile,
  RelationshipStatus,
  RiskAppetite,
  SalaryBand,
  SavingsBand,
} from "@/domain/types";
import {
  buildSnapshot,
  deriveAreas,
  DEBT_OPTIONS,
  EDUCATION_OPTIONS,
  FAMILY_OPTIONS,
  RELATIONSHIP_OPTIONS,
  RISK_OPTIONS,
  SALARY_OPTIONS,
  SAVINGS_OPTIONS,
} from "@/domain/profile";
import { useApp } from "@/state/AppContext";
import { useT } from "@/prefs/PreferencesContext";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { Select } from "./ui/Select";
import { IconSparkle } from "./ui/icons";

const TOTAL_STEPS = 4;

// 可选下拉选项（含"(暂不填)"占位）——静态表，放模块级避免每次 render 重建。
const savingsOpts = [{ value: "" as SavingsBand | "", label: "(暂不填)" }, ...SAVINGS_OPTIONS];
const debtOpts = [{ value: "" as DebtBand | "", label: "(暂不填)" }, ...DEBT_OPTIONS];
const familyOpts = [{ value: "" as FamilyResponsibility | "", label: "(暂不填)" }, ...FAMILY_OPTIONS];
const riskOpts = [{ value: "" as RiskAppetite | "", label: "(暂不填)" }, ...RISK_OPTIONS];

export function Onboarding() {
  const { completeOnboarding } = useApp();
  const { t } = useT();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [age, setAge] = useState(28);
  const [education, setEducation] = useState<EducationLevel>("bachelor");
  const [major, setMajor] = useState("");
  const [location, setLocation] = useState("");
  const [nationality, setNationality] = useState("");

  const [occupation, setOccupation] = useState("");
  const [salary, setSalary] = useState<SalaryBand>("5to10");
  const [hasSideHustle, setHasSideHustle] = useState(false);
  const [sideHustle, setSideHustle] = useState("");

  const [skills, setSkills] = useState("");
  const [savings, setSavings] = useState<SavingsBand | "">("");
  const [debt, setDebt] = useState<DebtBand | "">("");
  const [assets, setAssets] = useState("");
  const [family, setFamily] = useState<FamilyResponsibility | "">("");
  const [riskAppetite, setRiskAppetite] = useState<RiskAppetite | "">("");

  const [relationship, setRelationship] = useState<RelationshipStatus>("single");
  const [hobbies, setHobbies] = useState("");
  const [status, setStatus] = useState("");
  const [crossroad, setCrossroad] = useState("");

  const step0Valid = name.trim().length > 0 && age >= 10 && age <= 100;
  // 单线起手：岔路改为可选——不再要求填、也不再自动分叉（之后能在「我的规划」里变成目标）。

  function submit() {
    const inputs = {
      name: name.trim(),
      age,
      education,
      major: major.trim(),
      location: location.trim(),
      nationality: nationality.trim() || undefined,
      occupation: occupation.trim(),
      salary,
      hasSideHustle,
      sideHustle: sideHustle.trim(),
      hobbies: hobbies.trim(),
      relationship,
      status: status.trim(),
      crossroad: crossroad.trim(),
      skills: skills.trim() || undefined,
      savings: savings || undefined,
      debt: debt || undefined,
      assets: assets.trim() || undefined,
      family: family || undefined,
      riskAppetite: riskAppetite || undefined,
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
          {t("先认识一下")}
          <span className="text-[var(--accent)]">{t("真实的你")}</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--fg-dim)]">
          {t("填得越具体，AI 推演的人生越像你。这些信息只存在你自己的浏览器里。")}
        </p>
      </div>

      {/* 进度 */}
      <div className="mt-8 flex gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i <= step ? "var(--accent)" : "rgba(0,0,0,0.12)" }}
          />
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-5">
        {step === 0 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("昵称")}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("比如 阿明")}
                  className="px-4 py-3 text-base"
                  autoFocus
                />
              </Field>
              <Field label={t("年龄")}>
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
            <Field label={t("最高学历")}>
              <Select value={education} onChange={setEducation} options={EDUCATION_OPTIONS} />
            </Field>
            <Field label={t("专业")} hint={t("可选，比如 计算机 / 会计 / 临床医学")}>
              <input
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder={t("学的是什么专业")}
                className="px-4 py-3 text-base"
              />
            </Field>
            <Field label={t("现在生活在哪")} hint={t("国家/城市，用来让预测符合现实，比如 美国纽约 / 中国上海")}>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("所在国家 / 城市")}
                className="px-4 py-3 text-base"
              />
            </Field>
            <Field label={t("国籍 / 出生国")} hint={t("可选，用来校准签证排期等现实约束，比如 中国大陆 / 美国 / 印度")}>
              <input
                type="text"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder={t("如 中国大陆 / 美国 / 印度")}
                className="px-4 py-3 text-base"
              />
            </Field>
            <Button
              variant="primary"
              disabled={!step0Valid}
              onClick={() => setStep(1)}
              className="mt-2 self-end"
            >
              {t("下一步 →")}
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <Field label={t("现在的职业")} hint={t("可选，比如 后端工程师 / 中学老师 / 自由职业")}>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder={t("现在靠什么谋生")}
                className="px-4 py-3 text-base"
                autoFocus
              />
            </Field>
            <Field label={t("月薪区间")}>
              <Select value={salary} onChange={setSalary} options={SALARY_OPTIONS} />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("有没有副业？")}</span>
              <div className="flex gap-2">
                <Button
                  variant={hasSideHustle ? "primary" : "subtle"}
                  onClick={() => setHasSideHustle(true)}
                >
                  {t("有")}
                </Button>
                <Button
                  variant={!hasSideHustle ? "primary" : "subtle"}
                  onClick={() => setHasSideHustle(false)}
                >
                  {t("没有")}
                </Button>
              </div>
            </div>
            {hasSideHustle && (
              <Field label={t("副业是什么")} hint={t("可选，比如 做自媒体 / 摆摊 / 接私活")}>
                <input
                  type="text"
                  value={sideHustle}
                  onChange={(e) => setSideHustle(e.target.value)}
                  placeholder={t("在做的副业")}
                  className="px-4 py-3 text-base"
                />
              </Field>
            )}
            <div className="mt-2 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                {t("← 返回")}
              </Button>
              <Button variant="primary" onClick={() => setStep(2)}>
                {t("下一步 →")}
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm text-[var(--fg-dim)]">
              {t("再多说说你自己（可选，但越填越准）")}
            </p>
            <Field label={t("技能 / 专长")} hint={t("比如 编程、设计、英语、带团队")}>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder={t("比如 编程、设计、英语、带团队")}
                className="px-4 py-3 text-base"
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("存款")}>
                <Select value={savings} onChange={setSavings} options={savingsOpts} />
              </Field>
              <Field label={t("负债")}>
                <Select value={debt} onChange={setDebt} options={debtOpts} />
              </Field>
            </div>
            <Field label={t("资产")} hint={t("比如 一套房、一辆车、些许股票")}>
              <input
                type="text"
                value={assets}
                onChange={(e) => setAssets(e.target.value)}
                placeholder={t("比如 一套房、一辆车、些许股票")}
                className="px-4 py-3 text-base"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("家庭责任")}>
                <Select value={family} onChange={setFamily} options={familyOpts} />
              </Field>
              <Field label={t("风险偏好")}>
                <Select value={riskAppetite} onChange={setRiskAppetite} options={riskOpts} />
              </Field>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>{t("← 返回")}</Button>
              <Button variant="primary" onClick={() => setStep(3)}>{t("下一步 →")}</Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Field label={t("情感 / 婚姻状态")}>
              <Select
                value={relationship}
                onChange={setRelationship}
                options={RELATIONSHIP_OPTIONS}
              />
            </Field>
            <Field label={t("爱好")} hint={t("可选，比如 跑步、摄影、打游戏")}>
              <input
                type="text"
                value={hobbies}
                onChange={(e) => setHobbies(e.target.value)}
                placeholder={t("平时喜欢做什么")}
                className="px-4 py-3 text-base"
              />
            </Field>
            <Field
              label={t("现在的身份 / 阶段")}
              hint={t("可选但很关键，帮预测贴合现实，比如 H1B工作签 / 在读研究生 / 已工作3年 / 创业中")}
            >
              <input
                type="text"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder={t("你现在的处境 / 身份")}
                className="px-4 py-3 text-base"
              />
            </Field>
            <Field
              label={t("你最近在纠结的一个选择？（可选）")}
              hint={t("比如 要不要辞职创业 / 要不要换城市 / 要不要读研")}
            >
              <textarea
                value={crossroad}
                onChange={(e) => setCrossroad(e.target.value)}
                rows={2}
                placeholder={t("可留空。写下来的话，进去后能把它变成你的第一个目标")}
                className="resize-none px-4 py-3 text-base"
                autoFocus
              />
            </Field>
            <div className="mt-2 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                {t("← 返回")}
              </Button>
              <Button variant="primary" onClick={submit}>
                <IconSparkle className="h-4 w-4" />
                {t("生成我的人生树")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
