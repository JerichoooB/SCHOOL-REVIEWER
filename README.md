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
- PDF / PPTX extraction and local, editable fill-in-the-blank quiz drafts, manual question authoring, accepted-answer variants, source sentences and page/slide attribution, exact normalized grading, results and saved attempts.
- Basic analytics from saved records, global search, dark/light appearance, persistent shuffle preference, validated full backup/restore and confirmed reset.
- Installable progressive web app, offline caching, and update prompt in Settings.

This initial release prioritizes phases 1–3 plus document quizzes and phone installation. Pomodoro sessions, calendar planning, advanced analytics filters, multiple-choice/true-false quiz builders and time limits remain future work. Their navigation entries describe availability honestly.

## Uploads and quiz generation

Files are processed entirely in the browser using PDF.js and JSZip. They are not sent to a server. Original files are not retained; saved quizzes keep the source filename, selected source sentences and generated questions. PDF text is read page by page; PPTX text is read from slide XML. Only PDF and modern `.pptx` files are supported, up to 20 MB and 200 pages/slides. Image-only/scanned documents require external OCR first; `.ppt` needs conversion to `.pptx`. Encrypted PDFs are unsupported.

Generation is **not AI**: it selects words in source sentences and replaces a word with a blank. It can produce awkward questions and does not understand concepts or diagrams. Review and edit every draft before saving. Answers match accepted text after normalization of case, whitespace and trailing punctuation, not semantic meaning. Source attribution lets you check the extracted material.

An AI question-writing service can be added later through an authenticated backend (for example PHP/MySQL). Keep provider API keys on the server. The storage service and generation/grading modules are separated for that integration; no API key is needed now.

## Install on a phone

Deploy `dist/` to an **HTTPS** static host, serving `index.html` for unknown application paths (SPA fallback). The app currently assumes deployment at the domain root. There is no deployed address created by this repository.

1. Open the deployed address online once and wait for offline files to finish caching.
2. Android Chrome: browser menu → Install app (or Add to Home screen). Settings also shows an Install button when the browser offers installation.
3. iPhone/iPad Safari: Share → Add to Home Screen → Add.

The installed app works offline after its first complete cache, including local document processing. Browser support varies; physical phone installation should be checked on the target device. Data lives in browser IndexedDB and does **not** sync between devices. iOS installed storage can be separate from Safari. Export a backup and import it into the installed app when switching contexts. Clearing site data, uninstalling or browser eviction can remove local records. Export backups regularly.

Updates appear in Settings; save open drafts before applying. A service worker runs only in production builds (or localhost preview), not the normal development server.

## Data and implementation

`src/services/database.js` centralizes IndexedDB state and lightweight localStorage preferences. Writes validate references and commit atomically before React state changes; a serialized queue prevents overlapping writes from losing updates. Failed writes display an error. `src/services/documents.js` extracts text; `src/utils/quizGrading.js` creates and grades quizzes; `src/utils/spacedRepetition.js` schedules reviews. Do not import backups from untrusted sources. No account or backend is required.
