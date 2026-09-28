import { bandFor, CRITERIA, ROLE_SPECIFIC, type CriterionKey, type Role } from "./rubric";
import { applyRules, totalFor } from "./rules";
import { templateBrief, templateEmail } from "./templates";
import type { Candidate, CriterionScore, RoleScore, Signals } from "./types";

// Fictional candidates for demoing the dashboard without API keys. Names and CVs are made up.

type C = [score: number, evidence: string, rationale: string];
interface Def {
  name: string;
  email: string;
  role: Role;
  signals: Partial<Signals> & { summary: string };
  shared: Record<"domain" | "built" | "acts" | "impact" | "trajectory", C>;
  pm: Record<"ownership" | "craft" | "complexity", C>;
  spm: Record<"ownership" | "craft" | "complexity", C>;
}

const DEFS: Def[] = [
  {
    name: "Priya Nair",
    email: "priya.nair@example.com",
    role: "PM",
    signals: { pmYears: 3, relocationStated: true, relocationEvidence: "Based in Mumbai (Andheri)", summary: "Spent two years as a freight operations coordinator at a forwarder before moving into product at a logistics startup. Has been the sole PM on a shipment-tracking product for three years" },
    shared: {
      domain: [5, "Coordinated 40+ daily FCL bookings at JNPT for two years", "Did the operational freight work personally for 2 years."],
      built: [5, "Built the exceptions tracker ops now uses across all four branches", "Unassigned fix that became the standard."],
      acts: [5, "Wrote the root-cause note after the March customs outage", "Fast response plus a written post-mortem."],
      impact: [4, "Cut manual status calls from 300 to 90 a week", "Baseline given; personal role mostly clear."],
      trajectory: [5, "Ops coordinator → Associate PM → Product Manager in four years", "Clearly growing scope; crisp CV."],
    },
    pm: {
      ownership: [5, "Sole PM for tracking; owned roadmap and trade-offs end-to-end", "Owned the area and made the trade-offs."],
      craft: [5, "Shipped and retired three features in six-week cycles", "Short cycles, killed things, first-time environment."],
      complexity: [4, "Ambiguous carrier-data problem with SLA penalties at stake", "Real consequences, moderate scale."],
    },
    spm: {
      ownership: [4, "Sole PM for tracking; owned roadmap and trade-offs end-to-end", "No senior PM above, but a founder still weighed in."],
      craft: [2, "Shipped and retired three features in six-week cycles", "Only 3 years of PM, under the SPM range."],
      complexity: [3, "Ambiguous carrier-data problem with SLA penalties at stake", "Multi-stakeholder, single team."],
    },
  },
  {
    name: "Karan Mehta",
    email: "karan.mehta@example.com",
    role: "SPM",
    signals: { pmYears: 7, relocationStated: true, relocationEvidence: "Open to relocating to Mumbai", summary: "Seven years of product management on integration and data-platform products at a supply-chain SaaS company. Led carrier API and EDI work across several teams" },
    shared: {
      domain: [3, "Led carrier EDI integrations for 60+ logistics customers", "Adjacent: logistics integrations, not hands-on ops."],
      built: [5, "Wrote the first public API docs; now the partner onboarding standard", "Unprompted, and adopted by others."],
      acts: [4, "Ran the incident bridge during the rate-feed outage", "Fast response; follow-through partly documented."],
      impact: [4, "Partner onboarding time down from 6 weeks to 9 days", "Baseline and scale given."],
      trajectory: [4, "PM → Senior PM → Group PM, Integrations over seven years", "Growing scope, clear CV."],
    },
    pm: {
      ownership: [4, "Owned integrations roadmap with no senior PM above", "Owned the area; made most calls."],
      craft: [3, "Seven years of product management on integration products", "Over the 2-4 year PM range; mature team."],
      complexity: [5, "Ambiguous migration off legacy EDI with revenue at stake", "Ambiguous with real consequences."],
    },
    spm: {
      ownership: [5, "Owned integrations roadmap with no senior PM above", "Made and lived with the calls, no committee."],
      craft: [5, "Chose to configure a vendor iPaaS instead of building connectors", "Platform work with build vs configure judgment."],
      complexity: [5, "Ambiguous migration off legacy EDI with revenue at stake", "Integrations, multi-team, multi-quarter."],
    },
  },
  {
    name: "Ananya Rao",
    email: "ananya.rao@example.com",
    role: "PM",
    signals: { pmYears: 3.5, relocationStated: true, relocationEvidence: "Currently based in Mumbai", summary: "Three and a half years as a PM in a large retail bank's mobile app team. Strong metrics on existing products, no logistics exposure" },
    shared: {
      domain: [1, "", "No logistics or supply chain exposure in the CV."],
      built: [2, "Improved the release checklist at my manager's request", "Improved a process when asked; no adoption shown."],
      acts: [1, "", "No disruptions or incidents described."],
      impact: [5, "Raised card activation from 41% to 58% across 2M users", "Specific, baselined and at scale."],
      trajectory: [3, "Product Manager, Mobile Banking, 2022 to present", "Steady at the same level; clear but generic."],
    },
    pm: {
      ownership: [2, "Supported the lead PM on the payments roadmap", "Contributor; decisions made above her."],
      craft: [3, "Managed feature backlog for the existing mobile app", "2-4 years but in a mature, maintaining team."],
      complexity: [2, "Managed feature backlog for the existing mobile app", "Mostly well-defined work."],
    },
    spm: {
      ownership: [2, "Supported the lead PM on the payments roadmap", "Contributor."],
      craft: [1, "Managed feature backlog for the existing mobile app", "Under 4 years of PM."],
      complexity: [2, "Managed feature backlog for the existing mobile app", "Single team, routine."],
    },
  },
  {
    name: "Farhan Sheikh",
    email: "farhan.sheikh@example.com",
    role: "SPM",
    signals: { pmYears: 6, relocationStated: true, relocationEvidence: "Willing to relocate to Mumbai", summary: "Six years of platform PM work at a fintech, including owning its payments data layer. No logistics exposure" },
    shared: {
      domain: [1, "", "No logistics exposure; fintech throughout."],
      built: [4, "Built the schema registry that three squads later adopted", "Built unprompted; adoption across squads."],
      acts: [4, "Authored the post-mortem after the ledger sync failure", "Written root cause; speed less clear."],
      impact: [4, "Reconciliation errors down 70% over two quarters", "Outcome with baseline; scale unclear."],
      trajectory: [4, "PM → Senior PM, Data Platform in six years", "Growing scope."],
    },
    pm: {
      ownership: [4, "Owned the payments data layer end-to-end", "Owned the area and the trade-offs."],
      craft: [3, "Six years on platform and data-layer products", "Above the PM range."],
      complexity: [4, "Ledger migration touching five teams over three quarters", "Ambiguous with consequences."],
    },
    spm: {
      ownership: [4, "Owned the payments data layer end-to-end", "Owned it; a VP still signed off on big calls."],
      craft: [5, "Six years on platform and data-layer products", "Platform/data-layer product work in range."],
      complexity: [5, "Ledger migration touching five teams over three quarters", "Data layer, multi-team, multi-quarter."],
    },
  },
  {
    name: "Neha Kulkarni",
    email: "neha.kulkarni@example.com",
    role: "PM",
    signals: { pmYears: 1, relocationStated: true, relocationEvidence: "Based in Navi Mumbai", summary: "Three years in port operations at a container terminal, followed by one year as an associate PM on the terminal's internal tools" },
    shared: {
      domain: [5, "Shift supervisor, yard operations, Nhava Sheva terminal, three years", "Hands-on port operations for 3 years."],
      built: [5, "Built the berth-slot sheet every shift lead now uses", "Unassigned fix adopted as the standard."],
      acts: [4, "Rerouted 200 boxes overnight during the crane breakdown", "Fast response; write-up not mentioned."],
      impact: [3, "Reduced truck wait times at the gate", "Outcome, but no baseline."],
      trajectory: [4, "Yard supervisor → Associate PM, internal tools", "Growing scope."],
    },
    pm: {
      ownership: [3, "Owned the gate-pass tool with the product head", "Owned an area; a senior made final calls."],
      craft: [1, "Associate Product Manager, internal tools, one year", "Under about 1.5 years of PM."],
      complexity: [3, "Gate-pass rollout across three terminals", "Moderate scale."],
    },
    spm: {
      ownership: [3, "Owned the gate-pass tool with the product head", "Senior leader decided."],
      craft: [1, "Associate Product Manager, internal tools, one year", "Under 4 years of PM."],
      complexity: [3, "Gate-pass rollout across three terminals", "Multi-stakeholder, single team."],
    },
  },
  {
    name: "Rohit Verma",
    email: "rohit.verma@example.com",
    role: "PM",
    signals: { pmYears: 3, relocationStated: true, relocationEvidence: "Open to relocating to Mumbai", dateIssues: ["Two full-time roles overlap from Jan 2023 to Aug 2023", "Summary says 5 years' experience; listed roles add up to about 3"], summary: "PM at a D2C e-commerce company with some warehouse-process work. The CV lists overlapping full-time roles" },
    shared: {
      domain: [3, "Redesigned pick-pack flow with the warehouse team", "Adjacent supply chain work."],
      built: [3, "Improved returns process when asked by ops lead", "Improved when asked."],
      acts: [3, "Handled the Diwali order backlog", "Responded; no written follow-through."],
      impact: [4, "Returns processing time cut from 5 days to 2", "Baselined."],
      trajectory: [3, "Product Manager, 2021 to present", "Steady."],
    },
    pm: {
      ownership: [3, "Owned fulfilment features with the head of product", "Senior made final calls."],
      craft: [4, "Ran discovery with warehouse staff before building", "Some discovery; shorter cycles."],
      complexity: [3, "Warehouse flow across two cities", "Moderate scale."],
    },
    spm: {
      ownership: [3, "Owned fulfilment features with the head of product", "Senior decided."],
      craft: [1, "Product Manager, 2021 to present", "Under 4 years of PM."],
      complexity: [3, "Warehouse flow across two cities", "Single team."],
    },
  },
  {
    name: "Sneha Iyer",
    email: "sneha.iyer@example.com",
    role: "SPM",
    signals: { pmYears: 6, relocationStated: false, relocationEvidence: "", summary: "Began in supply chain planning at an FMCG company, then six years of PM work on a logistics marketplace's data and integrations platform" },
    shared: {
      domain: [4, "Supply planner for 18 months, managing 12 distributor lanes", "Close to hands-on supply chain work."],
      built: [4, "Created the lane-health dashboard later adopted by sales", "Built it; adoption by another team."],
      acts: [5, "Led the carrier-outage response and published the post-mortem", "Fast response plus written post-mortem."],
      impact: [4, "Shipper churn down from 9% to 5% quarterly", "Baselined; own role fairly clear."],
      trajectory: [5, "Planner → PM → Senior PM, Data Platform", "Clearly growing scope."],
    },
    pm: {
      ownership: [5, "Only PM on the data platform; no committee", "End-to-end ownership."],
      craft: [3, "Six years of PM on marketplace data products", "Above the PM range."],
      complexity: [5, "Rebuilt pricing data pipeline across four teams", "High ambiguity, real stakes."],
    },
    spm: {
      ownership: [5, "Only PM on the data platform; no committee", "No senior PM above, no committee."],
      craft: [5, "Skipped building ETL; configured managed connectors instead", "Build vs configure vs skip judgment."],
      complexity: [5, "Rebuilt pricing data pipeline across four teams", "Data layer, multi-team."],
    },
  },
];

function criterion(key: CriterionKey, [score, evidence, rationale]: C): CriterionScore {
  const notEvidenced = !evidence;
  return { key, score: notEvidenced ? 1 : score, aiScore: score, evidence, rationale, notEvidenced, quoteUnverified: false };
}

function build(def: Def, i: number): Candidate {
  const roleScore = (role: Role): RoleScore => {
    const spec = role === "PM" ? def.pm : def.spm;
    const criteria = CRITERIA.map((k) =>
      criterion(k, ROLE_SPECIFIC.includes(k) ? spec[k as keyof typeof spec] : def.shared[k as keyof typeof def.shared])
    );
    const total = totalFor(role, criteria);
    return { role, total, criteria, band: bandFor(total) };
  };
  const signals: Signals = {
    pmYears: null,
    relocationStated: false,
    relocationEvidence: "",
    readable: true,
    dateIssues: [],
    shortStints: 0,
    ...def.signals,
  };
  const scores = { PM: roleScore("PM"), SPM: roleScore("SPM") };
  const { decision, reasons } = applyRules(def.role, scores, signals);
  const evidence = [...Object.values(def.shared), ...Object.values(def.role === "PM" ? def.pm : def.spm)]
    .map((c) => c[1])
    .filter(Boolean);
  const redactedText = `[candidate]\n[email] · [phone] · [link]\n\nSUMMARY\n${signals.summary}.\n${signals.relocationEvidence}\n\nEXPERIENCE\n${[...new Set(evidence)].map((e) => `• ${e}`).join("\n")}`;

  const c: Candidate = {
    id: `sample-${i}`,
    fileName: `${def.name.replace(" ", "_")}_CV.pdf`,
    role: def.role,
    addedAt: Date.now() - i * 60_000,
    stage: "done",
    sample: true,
    extract: {
      contact: { name: def.name, email: def.email, phone: "+91 98XXX XXXXX" },
      redactedText,
      redactions: ["Name", "Email", "Phone", "Profile links", "Education section"],
      wordCount: redactedText.split(/\s+/).length,
    },
    result: { scores, signals, decision, reasons },
  };
  c.brief = templateBrief(c);
  if (decision === "ADVANCE") c.email = templateEmail(c, "invite");
  if (decision === "PASS") c.email = templateEmail(c, "rejection");
  return c;
}

export function sampleCandidates(): Candidate[] {
  return DEFS.map(build);
}
