import { WEIGHTS, type Decision, type Role } from "./rubric";
import type { CriterionScore, RoleScore, Signals } from "./types";

// Pure scoring maths + hold/flag rules. Shared by the server scorer and the dashboard.

/** total = sum of (score / 5 x weight). Maximum is 100. */
export function totalFor(role: Role, criteria: CriterionScore[]) {
  return Math.round(criteria.reduce((sum, c) => sum + (c.score / 5) * WEIGHTS[role][c.key], 0));
}

export function applyRules(applied: Role, scores: Record<Role, RoleScore>, signals: Signals) {
  const band = scores[applied].band;
  const reasons: string[] = [];
  let decision: Decision = band;

  if (signals.dateIssues.length) {
    return { decision: "FLAG" as Decision, reasons: signals.dateIssues.map((d) => `Date check: ${d}`) };
  }

  const holds: string[] = [];
  if (!signals.readable) holds.push("CV looks unreadable or incomplete");
  if (applied === "PM" && signals.pmYears !== null && signals.pmYears < 1.5)
    holds.push(`Under ~1.5 years of PM experience (${signals.pmYears} yrs)`);
  if (applied === "SPM") {
    const d = scores.SPM.criteria.find((c) => c.key === "domain")!;
    if (d.score <= 2) holds.push(`SPM with Domain Contact of ${d.score}`);
  }
  if (!signals.relocationStated) holds.push("Relocation to Mumbai not stated");

  if (holds.length) {
    decision = "HOLD";
    reasons.push(...holds.map((h) => (band === "HOLD" ? h : `${h}. Held instead of ${band.toLowerCase()}.`)));
  }
  return { decision, reasons };
}

