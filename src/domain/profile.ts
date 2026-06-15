import {
  LIFE_AREAS,
  type EducationLevel,
  type LifeArea,
  type Profile,
  type RelationshipStatus,
  type SalaryBand,
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
  parts.push(EDUCATION_LABELS[p.education]);
  if (p.major.trim()) parts.push(`${p.major.trim()}专业`);
  if (p.occupation.trim()) parts.push(`现在是${p.occupation.trim()}`);
  parts.push(`月薪${SALARY_LABELS[p.salary]}`);
  if (p.hasSideHustle) parts.push(p.sideHustle.trim() ? `有副业（${p.sideHustle.trim()}）` : "有副业");
  if (p.hobbies.trim()) parts.push(`爱好${p.hobbies.trim()}`);
  parts.push(RELATIONSHIP_LABELS[p.relationship]);
  return parts.join(" · ");
}
