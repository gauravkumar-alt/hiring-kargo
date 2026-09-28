import "server-only";
import type { Contact, ExtractResult } from "./types";

/** Turn an uploaded CV (PDF, DOCX or plain text) into plain text. */
export async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buf = new Uint8Array(await file.arrayBuffer());

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    return value;
  }

  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    return new TextDecoder().decode(buf);
  }

  throw new Error("Unsupported file type. Upload a PDF, DOCX or TXT CV.");
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin|github|behance|medium)\.com\/\S*/gi;
// 10+ digits, optionally with +country code, spaces, dashes, dots or brackets in between.
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?){2,4}\d{3,5}/g;
const PERSONAL_LINE_RE =
  /\b(date of birth|d\.?o\.?b|born on|age\s*[:\-]|gender|sex\s*[:\-]|marital|nationality|religion|father'?s name|mother'?s name|passport|aadhaar|pan\s*(no|number|card))\b/i;
const PINCODE_RE = /\b\d{3}\s?\d{3}\b/; // Indian 6-digit PIN; only checked in the CV header so metrics aren't hit
const ADDRESS_LINE_RE = /^\s*(address|addr\.?|residence|current location|location)\s*[:\-]/i;

const SECTION_HEADINGS = [
  "summary", "profile", "about", "objective", "experience", "work experience", "professional experience",
  "employment", "work history", "career", "skills", "core skills", "key skills", "projects", "certifications",
  "achievements", "awards", "accomplishments", "interests", "hobbies", "languages", "publications",
  "volunteering", "leadership", "additional", "tools", "competencies", "references", "education",
  "academic", "academics", "qualifications", "educational qualifications", "academic background",
];
const EDUCATION_HEADINGS = /^(education|academic|academics|qualifications|educational qualifications|academic background|academic qualifications)$/;

function headingOf(line: string): string | null {
  const t = line.trim().replace(/[:|•\-–—_*#]+$/g, "").replace(/^[#*•\-–—\s]+/, "").trim().toLowerCase();
  if (!t || t.length > 40) return null;
  return SECTION_HEADINGS.includes(t) ? t : null;
}

function guessName(lines: string[], fileName: string): string {
  for (const raw of lines.slice(0, 8)) {
    const line = raw.replace(EMAIL_RE, "").replace(PHONE_RE, "").replace(/[|,•·]/g, " ").trim();
    if (!line) continue;
    if (/resume|curriculum|vitae|\bcv\b|profile|summary/i.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w))) {
      return words.map((w) => (w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w)).join(" ");
    }
  }
  const fromFile = fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\b(cv|resume|final|updated|pm|spm|v\d+|\d+)\b/gi, "")
    .trim();
  return fromFile || "Candidate";
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The "Context" step on the components map: pull out who the candidate is and strip it before AI sees
 * the CV. The rubric says name, gender, age, photo, location and college brand are never scored, so the
 * model shouldn't be able to see them in the first place.
 */
export function redact(text: string, fileName: string): ExtractResult {
  const clean = text.replace(/\r/g, "").replace(/ /g, " ").replace(/[ \t]+/g, " ");
  const lines = clean.split("\n");
  const redactions = new Set<string>();

  const email = clean.match(EMAIL_RE)?.[0] ?? "";
  const phone =
    (clean.match(PHONE_RE) ?? []).find((p) => p.replace(/\D/g, "").length >= 10 && p.replace(/\D/g, "").length <= 13)?.trim() ?? "";
  const name = guessName(lines, fileName);
  const contact: Contact = { name, email, phone };

  // Drop personal-detail lines, address lines, and the whole education section.
  const kept: string[] = [];
  let inEducation = false;
  for (const [i, line] of lines.entries()) {
    const h = headingOf(line);
    if (h) {
      inEducation = EDUCATION_HEADINGS.test(h);
      if (inEducation) {
        redactions.add("Education section");
        continue;
      }
    }
    if (inEducation) continue;
    if (PERSONAL_LINE_RE.test(line)) {
      redactions.add("Personal details (age, gender, etc.)");
      continue;
    }
    // Keep relocation statements even when they mention a place; drop plain postal addresses.
    // Keep relocation statements; replace postal addresses, but keep "based in Mumbai" as a signal
    // because the rubric holds CVs that don't show willingness to work from Mumbai.
    if (!/relocat|willing to move|open to moving/i.test(line) && (ADDRESS_LINE_RE.test(line) || (i < 8 && PINCODE_RE.test(line.replace(PHONE_RE, ""))))) {
      redactions.add("Address");
      if (/mumbai|navi mumbai|thane/i.test(line)) kept.push("[address: Mumbai area]");
      continue;
    }
    kept.push(line);
  }

  let out = kept.join("\n");
  if (out.search(EMAIL_RE) !== -1) redactions.add("Email");
  out = out.replace(EMAIL_RE, "[email]");
  if (out.search(URL_RE) !== -1) redactions.add("Profile links");
  out = out.replace(URL_RE, "[link]");
  out = out.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, "").length;
    if (digits >= 10 && digits <= 13) {
      redactions.add("Phone");
      return "[phone]";
    }
    return m;
  });

  // Name: full name first, then each part (3+ letters) anywhere in the text.
  if (name && name !== "Candidate") {
    const parts = [name, ...name.split(/\s+/).filter((p) => p.replace(/\./g, "").length >= 3)];
    for (const p of parts) {
      const re = new RegExp(`\\b${escapeRe(p)}\\b`, "gi");
      if (out.search(re) !== -1) redactions.add("Name");
      out = out.replace(re, "[candidate]");
    }
  }

  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return {
    contact,
    redactedText: out,
    redactions: [...redactions],
    wordCount: out.split(/\s+/).filter(Boolean).length,
  };
}
