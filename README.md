# Recall

A personal, local-first study assistant built with React, Vite, Tailwind CSS, React Router, Lucide, Motion, Recharts, and IndexedDB.

## Run

Requires Node.js 20.19+ or 22.12+ (tested with Node 24).

```sh
npm ci
npm run dev
```

Build and test:

```sh
npm test
npm run build
npm run preview
npx playwright test
```

Browser tests use `/usr/bin/chromium` in this cloud environment. Adjust `playwright.config.js` for another machine, or install Playwright Chromium and remove `executablePath`.

## What works

- Responsive dashboard with actual card counts, review activity, streak, and quiz scores. Study hours remain untracked until a future timer feature is implemented.
- Subject CRUD with colors, optional emoji, deck counts, and mastery. Deleting a subject confirms and deletes its decks/cards/history; quizzes are kept and unassigned.
- Deck and card CRUD, search, JSON/CSV card import and export, optional explanations/tags/difficulty.
- Study mode with reveal, previous/skip, shuffle, Space to flip and 1–4 recall ratings. A simplified SM-2 schedule saves due dates, intervals, ease, repetitions, and review history. Again schedules in one minute; Good starts at 1 day then 6 days; later intervals multiply by ease (minimum 1.3). Hard grows more slowly and Easy increases intervals.
- PDF / PPTX extraction, Gemini-generated multiple-choice quiz drafts, editable options and correct answers, explanations, supporting quotations with page/slide attribution, scoring, and saved attempts. Legacy short-answer quizzes and manual questions remain supported.
- Basic analytics from saved records, global search, dark/light appearance, persistent shuffle preference, validated full backup/restore and confirmed reset.
- Installable progressive web app, offline caching, and update prompt in Settings.

This initial release prioritizes phases 1–3 plus document quizzes and phone installation. Pomodoro sessions, calendar planning, advanced analytics filters, multiple-choice/true-false quiz builders and time limits remain future work. Their navigation entries describe availability honestly.

## Uploads and quiz generation

PDF/PPTX text is extracted on the device using PDF.js and JSZip. The original file is not uploaded or retained. Before AI generation, the user sees the extracted text size and explicitly confirms sending the extracted text to Google Gemini via the app’s Vercel server function. Saved quizzes retain the source filename, questions, explanations, source labels and supporting quotations, not the entire extracted document. Limits: 20 MB, 200 pages/slides, and 60,000 extracted characters per AI request; split long documents into chapters. Scanned documents need OCR; `.ppt` needs conversion to `.pptx`; encrypted PDFs are unsupported.

Gemini writes 3–15 concept-based multiple-choice questions (or fewer if the material cannot support the requested number), each with four distinct choices and one correct answer. The server rejects malformed questions, duplicates, unknown source labels, and quotations absent from the extracted text. These checks establish a quotation exists, **not that the AI’s explanation is always correct**. Review and edit drafts before saving. Existing short-answer quizzes still use normalized exact matching, not semantic grading. There is no automatic fallback to the old word-blank generator.

### Enable Gemini on Vercel

1. Create a Gemini API key at [Google AI Studio](https://aistudio.google.com/apikey), using a project eligible for the unpaid tier. Free access is subject to Google’s model, region, account and quota rules. Keep billing disabled if you want to avoid paid usage; this app does not manage your provider billing. The default is `gemini-2.5-flash-lite`; choose another available structured-output-capable model with `RECALL_AI_MODEL` if needed.
2. In **Vercel → Project → Settings → Environment Variables**, add `GEMINI_API_KEY` with your key and `RECALL_QUIZ_ACCESS_CODE` with your own random private passcode of 16–512 characters. Add them for Production (and Preview if needed). Do not use a `VITE_` prefix: these must stay on the server. Never put secret values in GitHub, chat, or committed files.
3. Redeploy after saving the variables. `api/generate-quiz.js` runs as a Vercel Node function; `vercel.json` keeps `/api/` out of the SPA rewrite. All other application routes keep the SPA fallback. Keep the deployment at the domain root.
4. In Practice Quizzes, choose a PDF/PPTX, select the question count, enter your private generation passcode, confirm sending the text, and generate. The passcode stays only in component memory for this tab; it is not saved in study backups or preferences.

Google’s unpaid API terms may permit submitted content to be used to improve products, depending on account and region. Read the [Gemini API terms](https://ai.google.dev/gemini-api/terms) and avoid confidential material. This is a personal shared-passcode gate, not multi-user authentication or a distributed rate limiter. Keep the passcode private and rotate it in Vercel if exposed. Provider quotas still apply; a 429 shows a usage-limit message without silently upgrading billing.

`npm run dev` and `npm run preview` serve the frontend only. For local AI generation, use `vercel dev` with server environment variables configured privately. No API key is needed for the normal build or automated tests. Unit tests mock Gemini responses and browser tests mock `/api/generate-quiz`; they do not prove live provider access, free-tier eligibility, or question quality. A real upload must be tested after adding the key and redeploying.

## Install on a phone

Deploy `dist/` to an **HTTPS** static host, serving `index.html` for unknown application paths (SPA fallback). The app currently assumes deployment at the domain root. There is no deployed address created by this repository.

1. Open the deployed address online once and wait for offline files to finish caching.
2. Android Chrome: browser menu → Install app (or Add to Home screen). Settings also shows an Install button when the browser offers installation.
3. iPhone/iPad Safari: Share → Add to Home Screen → Add.

The installed app works offline after its first complete cache, including saved quizzes. Generating new AI quizzes requires internet and the configured server function. Browser support varies; physical phone installation should be checked on the target device. Data lives in browser IndexedDB and does **not** sync between devices. iOS installed storage can be separate from Safari. Export a backup and import it into the installed app when switching contexts. Clearing site data, uninstalling or browser eviction can remove local records. Export backups regularly.

Updates appear in Settings; save open drafts before applying. A service worker runs only in production builds (or localhost preview), not the normal development server.

## Data and implementation

`src/services/database.js` centralizes IndexedDB state and lightweight localStorage preferences. Writes validate references and commit atomically before React state changes; a serialized queue prevents overlapping writes from losing updates. Failed writes display an error. `src/services/documents.js` extracts text; `src/utils/quizGrading.js` grades saved answers, while `server/aiQuiz.js` requests and validates Gemini-generated questions; `src/utils/spacedRepetition.js` schedules reviews. Do not import backups from untrusted sources. Study data needs no account or database backend; AI generation uses the Vercel server function.
