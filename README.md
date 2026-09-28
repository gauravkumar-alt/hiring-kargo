# Kargo Hiring Desk

Screens PM and SPM CVs against Kargo's rubrics (`src/lib/rubric.ts`), then produces an interview brief and a draft email for each one. Emails go out through Resend, and only when the founder clicks send.

## Flow (matches the components map)
1. **Upload**: CV (PDF / DOCX / TXT) plus the role applied for (PM or SPM).
2. **Extract** (`/api/extract`): pulls out the text, then strips name, email, phone, links, address, age/gender lines and the education section before any AI sees it.
3. **Score** (`/api/score`): Gemini scores all 8 criteria for both roles. Each score must quote the CV. If the quote isn't actually in the CV, the score drops to 1 and is marked "not evidenced". Totals, bands and the hold/flag rules are worked out in code (`src/lib/rules.ts`), not by the AI.
4. **Draft** (`/api/draft`): interview brief for every candidate. An invite goes to ADVANCE and a rejection to PASS. HOLD and FLAG wait for the founder's call.
5. **Send** (`/api/send`): Resend, after a confirm step.
6. **Dashboard**: ranked list, per-criterion evidence, brief, editable email, your-call override, CSV export. State is saved in the browser (localStorage).

## Setup
```
cp .env.example .env.local   # fill GEMINI_API_KEY, RESEND_API_KEY, FROM_EMAIL
./run-dev.sh                 # http://localhost:3100
```
Without keys you can still click "Load sample candidates" to explore the UI.
