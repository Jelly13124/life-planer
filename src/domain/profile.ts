import {
  LIFE_AREAS,
  type DebtBand,
  type EducationLevel,
  type FamilyResponsibility,
  type LifeArea,
  type Profile,
  type RelationshipStatus,
  type RiskAppetite,
  type SalaryBand,
  type SavingsBand,
} from "./types";

// ---- 选项表（供 UI 下拉使用） ----
export const EDUCATION_OPTIONS: { value: EducationLevel; label: string }[] = [
  { value: "highschool", label: "高中及以下" },
  { value: "college", label: "大专" },
  { value: "bachelor", label: "本科" },
  { value: "master", label: "硕士" },
  { value: "phd", label: "博士" },
];

export const SALARY_OPTIONS: { value: SalaryBand; label: string }[] = [
  { value: "none", label: "暂无收入" },
  { value: "lt5", label: "5千以下" },
  { value: "5to10", label: "5千 - 1万" },
  { value: "10to20", label: "1万 - 2万" },
  { value: "20to50", label: "2万 - 5万" },
  { value: "gt50", label: "5万以上" },
];

export const RELATIONSHIP_OPTIONS: { value: RelationshipStatus; label: string }[] = [
  { value: "single", label: "单身" },
  { value: "dating", label: "恋爱中" },
  { value: "married", label: "已婚" },
  { value: "married_kids", label: "已婚有孩子" },
  { value: "divorced", label: "离异" },
  { value: "na", label: "不便透露" },
];

export const EDUCATION_LABELS: Record<EducationLevel, string> = Object.fromEntries(
  EDUCATION_OPTIONS.map((o) => [o.value, o.label]),
) as Record<EducationLevel, string>;
export const SALARY_LABELS: Record<SalaryBand, string> = Object.fromEntries(
  SALARY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<SalaryBand, string>;
export const RELATIONSHIP_LABELS: Record<RelationshipStatus, string> = Object.fromEntries(
  RELATIONSHIP_OPTIONS.map((o) => [o.value, o.label]),
) as Record<RelationshipStatus, string>;

export const SAVINGS_OPTIONS: { value: SavingsBand; label: string }[] = [
  { value: "none", label: "几乎没有积蓄" },
  { value: "lt1w", label: "1万以下" },
  { value: "1to10w", label: "1万 - 10万" },
  { value: "10to50w", label: "10万 - 50万" },
  { value: "50to100w", label: "50万 - 100万" },
  { value: "gt100w", label: "100万以上" },
];
export const DEBT_OPTIONS: { value: DebtBand; label: string }[] = [
  { value: "none", label: "没有负债" },
  { value: "lt10w", label: "10万以下" },
  { value: "10to50w", label: "10万 - 50万" },
  { value: "50to100w", label: "50万 - 100万" },
  { value: "gt100w", label: "100万以上" },
];
export const FAMILY_OPTIONS: { value: FamilyResponsibility; label: string }[] = [
  { value: "none", label: "暂无特别负担" },
  { value: "kids", label: "要养孩子" },
  { value: "parents", label: "要养父母" },
  { value: "both", label: "上有老下有小" },
];
export const RISK_OPTIONS: { value: RiskAppetite; label: string }[] = [
  { value: "conservative", label: "保守求稳" },
  { value: "balanced", label: "稳健" },
  { value: "aggressive", label: "进取敢冲" },
];

export const SAVINGS_LABELS: Record<SavingsBand, string> = Object.fromEntries(
  SAVINGS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<SavingsBand, string>;
export const DEBT_LABELS: Record<DebtBand, string> = Object.fromEntries(
  DEBT_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DebtBand, string>;
export const FAMILY_LABELS: Record<FamilyResponsibility, string> = Object.fromEntries(
  FAMILY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<FamilyResponsibility, string>;
export const RISK_LABELS: Record<RiskAppetite, string> = Object.fromEntries(
  RISK_OPTIONS.map((o) => [o.value, o.label]),
) as Record<RiskAppetite, string>;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

type ProfileInputs = Omit<Profile, "areas" | "snapshot">;

const EDU_CAREER: Record<EducationLevel, number> = {
  highschool: 46,
  college: 52,
  bachelor: 58,
  master: 64,
  phd: 70,
};
const SALARY_WEALTH: Record<SalaryBand, number> = {
  none: 28,
  lt5: 42,
  "5to10": 54,
  "10to20": 64,
  "20to50": 75,
  gt50: 86,
};
const REL_SCORE: Record<RelationshipStatus, number> = {
  single: 50,
  dating: 70,
  married: 74,
  married_kids: 70,
  divorced: 46,
  na: 56,
};

// 由结构化信息推导五个领域的起点（让填写的内容真正影响人生树）。
export function deriveAreas(p: ProfileInputs): Record<LifeArea, number> {
  const hasJob = p.occupation.trim().length > 0;
  const hasHobby = p.hobbies.trim().length > 0;
  const hasMajor = p.major.trim().length > 0;

  const career = clamp(
    EDU_CAREER[p.education] + (hasJob ? 6 : -4) + (p.hasSideHustle ? 4 : 0),
  );
  const wealth = clamp(SALARY_WEALTH[p.salary] + (p.hasSideHustle ? 4 : 0));
  const relationships = clamp(REL_SCORE[p.relationship]);
  const health = clamp(
    62 + (hasHobby ? 6 : 0) - (p.age > 45 ? (p.age - 45) * 0.4 : 0) - (p.hasSideHustle ? 3 : 0),
  );
  const growth = clamp(
    50 +
      (p.education === "master" || p.education === "phd" ? 6 : 0) +
      (hasHobby ? 6 : 0) +
      (p.hasSideHustle ? 8 : 0) +
      (hasMajor ? 3 : 0),
  );

  const areas = { career, wealth, relationships, health, growth };
  // 取整
  for (const a of LIFE_AREAS) areas[a] = Math.round(areas[a]);
  return areas;
}

// 把结构化信息汇总成一句"现状"文本（用于故事代入 + 关键词建议匹配）。
export function buildSnapshot(p: ProfileInputs): string {
  const parts: string[] = [];
  parts.push(`${p.age} 岁`);
  if (p.location.trim()) parts.push(p.location.trim());
  parts.push(EDUCATION_LABELS[p.education]);
  if (p.major.trim()) parts.push(`${p.major.trim()}专业`);
  if (p.occupation.trim()) parts.push(`现在是${p.occupation.trim()}`);
  parts.push(`月薪${SALARY_LABELS[p.salary]}`);
  if (p.hasSideHustle) parts.push(p.sideHustle.trim() ? `有副业（${p.sideHustle.trim()}）` : "有副业");
  if (p.hobbies.trim()) parts.push(`爱好${p.hobbies.trim()}`);
  parts.push(RELATIONSHIP_LABELS[p.relationship]);
  if (p.status.trim()) parts.push(p.status.trim());
  if (p.skills?.trim()) parts.push(`技能：${p.skills.trim()}`);
  if (p.savings) parts.push(`存款${SAVINGS_LABELS[p.savings]}`);
  if (p.debt && p.debt !== "none") parts.push(`负债${DEBT_LABELS[p.debt]}`);
  if (p.assets?.trim()) parts.push(`资产：${p.assets.trim()}`);
  if (p.family && p.family !== "none") parts.push(FAMILY_LABELS[p.family]);
  if (p.riskAppetite) parts.push(`风险偏好：${RISK_LABELS[p.riskAppetite]}`);
  return parts.join(" · ");
}
