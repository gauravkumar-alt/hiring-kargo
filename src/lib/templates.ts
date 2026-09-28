import { CRITERION_NAME, ROLE_LABEL, WEIGHTS, type CriterionKey, type Role } from "./rubric";
import type { Brief, Candidate, EmailDraft, EmailKind } from "./types";

// Offline brief/email drafts built from the scores alone. Used for the sample candidates so the
// dashboard can be demoed without API keys. Real uploads use the AI drafts from /api/draft.

const QUESTIONS: Record<CriterionKey, { PM: string; SPM: string; listenFor: string }> = {
  domain: {
    PM: "Walk me through the most hands-on operations work you've done. What broke most often?",
    SPM: "Walk me through the most hands-on operations work you've done. What broke most often?",
    listenFor: "They did the operational work themselves for a year or more and can name specific failure modes.",
  },
  ownership: {
    PM: "Tell me about a trade-off where nobody above you could make the call for you.",
    SPM: "Tell me about a call you made with no senior PM or committee above you, and lived with.",
    listenFor: "They made the decision, owned the fallout, and can say what they'd change.",
  },
  built: {
    PM: "What's something you built that nobody asked for? Who uses it today?",
    SPM: "What's something you built that nobody asked for? Who uses it today?",
    listenFor: "An unassigned friction they spotted, fixed, and that others adopted as the standard.",
  },
  acts: {
    PM: "Tell me about the worst disruption you handled. What did you write up afterwards?",
    SPM: "Tell me about the worst disruption you handled. What did you write up afterwards?",
    listenFor: "A fast response plus a written root cause and follow-through to closure.",
  },
  craft: {
    PM: "Tell me about something you shipped and later killed. How did you know?",
    SPM: "Tell me about a time you chose to configure or skip instead of building.",
    listenFor: "Short cycles, real discovery, and clear build vs configure vs skip judgment.",
  },
  impact: {
    PM: "Pick your proudest number. What was the baseline, and what exactly was your part?",
    SPM: "Pick your proudest number. What was the baseline, and what exactly was your part?",
    listenFor: "A checkable result with a baseline, scale and a clearly separated personal contribution.",
  },
  complexity: {
    PM: "What's the most ambiguous problem you've owned, and what was at stake if it went wrong?",
    SPM: "Tell me about an integration or data change that spanned several teams and quarters.",
    listenFor: "Real ambiguity with real consequences; for SPM, multi-team, multi-quarter stakes.",
  },
  trajectory: {
    PM: "Walk me through why you made each move in your career.",
    SPM: "Walk me through why you made each move in your career.",
    listenFor: "Clearly growing scope, with a crisp reason for each move.",
  },
};

export function templateBrief(c: Candidate): Brief {
  const role = c.role;
  const r = c.result!;
  const crit = r.scores[role].criteria;
  const w = WEIGHTS[role];
  const strong = [...crit].filter((x) => !x.notEvidenced && x.score >= 4).sort((a, b) => b.score * w[b.key] - a.score * w[a.key]);
  const weak = [...crit].sort((a, b) => a.score * w[a.key] - b.score * w[b.key] || w[b.key] - w[a.key]);

  return {
    headline: `${r.signals.summary.split(".")[0]}. Biggest open question: ${CRITERION_NAME[weak[0].key].toLowerCase()}.`,
    strengths: strong.slice(0, 3).map((x) => `${CRITERION_NAME[x.key]} (${x.score}/5): "${x.evidence}"`),
    risks: [
      ...weak
        .slice(0, 3)
        .filter((x) => x.score <= 3)
        .map((x) => (x.notEvidenced ? `${CRITERION_NAME[x.key]} is not evidenced in the CV. Unknown, not proven weak.` : `${CRITERION_NAME[x.key]} only ${x.score}/5: ${x.rationale}`)),
      ...r.reasons,
    ].slice(0, 4),
    questions: weak.slice(0, 5).map((x) => ({
      criterion: CRITERION_NAME[x.key],
      question: QUESTIONS[x.key][role],
      listenFor: QUESTIONS[x.key].listenFor,
    })),
    verify: [
      r.signals.pmYears !== null ? `Confirm ${r.signals.pmYears} years of hands-on PM work and the dates behind it.` : "Confirm total years of PM work.",
      ...(strong[0] ? [`Ask for the baseline behind: "${strong[0].evidence}"`] : []),
    ],
  };
}

export function templateEmail(c: Candidate, kind: EmailKind, sender = "Arjun"): EmailDraft {
  const first = c.extract?.contact.name.split(" ")[0] || "there";
  const role: Role = c.role;
  if (kind === "invite") {
    return {
      kind,
      subject: `${ROLE_LABEL[role]} at Kargo: let's talk`,
      body: `Hi ${first},\n\nThanks for applying for the ${ROLE_LABEL[role]} role at Kargo. Your time close to the operations side stood out to me. It's the kind of ground-level context this role needs.\n\nI'd love to set up a 45-minute first conversation. Could you reply with two or three time slots that work for you over the next week?\n\nThe role is in-office in Mumbai${c.result?.signals.relocationStated ? "" : ", so please also confirm that works for you"}.\n\nLooking forward to it,\n${sender}\nKargo`,
    };
  }
  return {
    kind,
    subject: `Your application to Kargo`,
    body: `Hi ${first},\n\nThank you for applying for the ${ROLE_LABEL[role]} role at Kargo, and for the care you put into your CV. The detail on the work you've shipped was genuinely useful to read.\n\nAfter a careful look, we won't be moving forward with your application for this role right now.\n\nI appreciate the time you took, and I wish you the very best with your search.\n\nWarmly,\n${sender}\nKargo`,
  };
}
