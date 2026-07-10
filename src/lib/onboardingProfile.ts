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
import type { DecisionStyleSummary } from "@/domain/decisionStyle";
import { buildSnapshot, deriveAreas } from "@/domain/profile";

export interface OnboardingProfileInput {
  name: string;
  age: number;
  education: EducationLevel;
  major: string;
  location: string;
  nationality?: string;
  occupation: string;
  salary: SalaryBand;
  hasSideHustle: boolean;
  sideHustle: string;
  hobbies: string;
  relationship: RelationshipStatus;
  status: string;
  crossroad: string;
  skills?: string;
  savings?: SavingsBand;
  debt?: DebtBand;
  assets?: string;
  family?: FamilyResponsibility;
  riskAppetite?: RiskAppetite;
  decisionStyle?: DecisionStyleSummary;
}

export function buildOnboardingProfile(inputs: OnboardingProfileInput): Profile {
  return {
    ...inputs,
    snapshot: buildSnapshot(inputs),
    areas: deriveAreas(inputs),
  };
}
