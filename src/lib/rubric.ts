// Kargo CV scoring rubrics (PM + SPM), transcribed from kargo_cv_scoring_rubrics.txt.
// Single source of truth: the AI prompt, the weighting maths and the UI all read from here.

export type Role = "PM" | "SPM";
export const ROLES: Role[] = ["PM", "SPM"];

export const ROLE_LABEL: Record<Role, string> = {
  PM: "Product Manager",
  SPM: "Senior Product Manager",
};

export const ROLE_JD: Record<Role, string> = {
  PM: "2-4 years PM, first PM on the core platform, in-office Mumbai",
  SPM: "5-8 years PM, owns integration and data layer, in-office Mumbai",
};

export type CriterionKey =
  | "domain"
  | "ownership"
  | "built"
  | "acts"
  | "craft"
  | "impact"
  | "complexity"
  | "trajectory";

export const CRITERIA: CriterionKey[] = [
  "domain",
  "ownership",
  "built",
  "acts",
  "craft",
  "impact",
  "complexity",
  "trajectory",
];

/** Criteria whose anchors differ between PM and SPM. The rest are scored once and shared. */
export const ROLE_SPECIFIC: CriterionKey[] = ["ownership", "craft", "complexity"];
export const SHARED: CriterionKey[] = CRITERIA.filter((c) => !ROLE_SPECIFIC.includes(c));

export const CRITERION_NAME: Record<CriterionKey, string> = {
  domain: "Ground-Level Domain Contact",
  ownership: "Ownership Without a Safety Net",
  built: "Built the Missing Thing, and It Stuck",
  acts: "Acts Fast, Closes the Loop",
  craft: "Product Craft and Role Fit",
  impact: "Impact and Evidence",
  complexity: "Complexity and Scale",
  trajectory: "Trajectory and Communication",
};

export const CRITERION_SHORT: Record<CriterionKey, string> = {
  domain: "Domain",
  ownership: "Ownership",
  built: "Built it",
  acts: "Acts fast",
  craft: "Craft",
  impact: "Impact",
  complexity: "Complexity",
  trajectory: "Trajectory",
};

export const WEIGHTS: Record<Role, Record<CriterionKey, number>> = {
  PM: { domain: 20, ownership: 15, built: 15, acts: 10, craft: 20, impact: 10, complexity: 5, trajectory: 5 },
  SPM: { domain: 15, ownership: 20, built: 15, acts: 5, craft: 10, impact: 10, complexity: 15, trajectory: 10 },
};

type Anchors = { 1: string; 3: string; 5: string };

const SHARED_ANCHORS: Record<string, Anchors> = {
  domain: {
    1: "No logistics exposure, or only built or sold software to the industry.",
    3: "Adjacent: supply chain planning, logistics integrations, or a customer-facing role at a logistics vendor.",
    5: "Personally did operational work in freight, port or supply chain for a year or more.",
  },
  built: {
    1: "Executed assigned work only.",
    3: "Improved a process when asked; no evidence others adopted it.",
    5: "Spotted an unassigned friction, built the fix, and others adopted it as the standard.",
  },
  acts: {
    1: "No evidence of handling disruptions.",
    3: "Responded to incidents, but no written root cause or follow-through.",
    5: "Fast response plus a written root cause, post-mortem or documented follow-through to closure.",
  },
  impact: {
    1: "Duties only, no outcomes.",
    3: "Outcomes stated, but no baseline or unclear personal role.",
    5: "Specific, checkable results with baseline, scale and their own contribution.",
  },
  trajectory: {
    1: "Flat or regressing with no reason; vague, hard-to-follow CV.",
    3: "Steady at the same level; clear but generic.",
    5: "Clearly growing scope; specific, structured CV understood in 60 seconds.",
  },
};

export const ANCHORS: Record<Role, Record<CriterionKey, Anchors>> = {
  PM: {
    ...(SHARED_ANCHORS as Record<"domain" | "built" | "acts" | "impact" | "trajectory", Anchors>),
    ownership: {
      1: 'Contributor; decisions made above them ("supported", "assisted").',
      3: "Owned an area, but a senior person made the final calls.",
      5: "Owned an area end-to-end and made the trade-offs themselves.",
    },
    craft: {
      1: "No product work, or under about 1.5 years.",
      3: "2-4 years of PM work, but in a mature, structured team maintaining existing products.",
      5: "2-4 years of PM work; shipped and killed things in short cycles; ran discovery; built in a first-time environment.",
    },
    complexity: {
      1: "Routine, well-defined work.",
      3: "Real ambiguity or moderate scale.",
      5: "Ambiguous problem with real consequences.",
    },
  },
  SPM: {
    ...(SHARED_ANCHORS as Record<"domain" | "built" | "acts" | "impact" | "trajectory", Anchors>),
    ownership: {
      1: "Contributor; decisions made above them.",
      3: "Owned an area, but a senior PM or leader decided.",
      5: "Made and lived with the calls with no senior PM above and no committee.",
    },
    craft: {
      1: "Under 4 years of PM, or no product-area ownership.",
      3: "5-8 years of PM, but on non-platform products.",
      5: "5-8 years on platform, integration or data-layer products, with evidence of build vs configure vs skip judgment.",
    },
    complexity: {
      1: "Routine, well-defined work.",
      3: "Multi-stakeholder, but within a single team.",
      5: "Integrations or data layer; multi-team; multi-quarter stakes.",
    },
  },
};

export const BANDS = { advance: 75, hold: 55 } as const;

export type Decision = "ADVANCE" | "HOLD" | "PASS" | "FLAG";

export const DECISION_LABEL: Record<Decision, string> = {
  ADVANCE: "Advance",
  HOLD: "Hold",
  PASS: "Pass",
  FLAG: "Flag",
};

export function bandFor(total: number): Exclude<Decision, "FLAG"> {
  if (total >= BANDS.advance) return "ADVANCE";
  if (total >= BANDS.hold) return "HOLD";
  return "PASS";
}
