# NAVLE Full-Length Timed Exam — Build Plan

## 1. Goals
- Simulate the **current NAVLE** (Oct 2026 onward): 360 items, 12 blocks × 30 items, 33 min per block.
- **Original** NAVLE-style clinical vignettes, covering the species, body systems and competencies in the ICVA outlines.
- One question at a time, flag/review within a block, explanations **only after the whole exam is submitted**.
- Score breakdown by **species**, **body system** (discipline), and **competency domain**.
- Results saved between sessions; resume an in-progress exam.
- **Practice mode** (1–2 blocks) built and tested first.
- Built so it can be turned into a hosted web app later without a rewrite.

## 2. Exam rules
| Item | Full exam | Practice |
|---|---|---|
| Blocks | 12 | 1 or 2 (user picks) |
| Items per block | 30 | 30 |
| Time per block | 33:00 | 33:00 |
| Tutorial (optional, skippable) | 10:00 | skip |
| Breaks between blocks | **TBD**: break allowance not confirmed from an ICVA document | Optional |

> **Unverified:** the 12 × 30 / 33-minute / 10-minute-tutorial figures come from search-result snippets
> attributed to the ICVA 2026-27 Candidate Handbook. They are **not** in the two ICVA PDFs provided.
> They'll be kept in one config file and must be confirmed against the Handbook before release.

Behavior that matches the real test:
- A block's timer starts when the block starts. When time runs out, the block is auto-submitted and unanswered items are marked wrong.
- Inside a block: Prev/Next, a navigator grid, **flag for review**, and an end-of-block review screen listing unanswered and flagged items.
- **Finished blocks are locked.** You can't go back to them.
- No feedback during the exam. Answers, the correct option and explanations appear only on the results screen after the last block.
- Pretest/unscored items: reportedly 60 of 360 are unscored (unverified, same source as above). Here every item is scored by default.

## 3. Blueprint (sourced only from ICVA documents provided)

Sources in hand:
- *NAVLE Species and Diagnoses* (ICVA, version 0.0262, (c) 2026)
- *NAVLE Competency Domains* (ICVA, (c) 2026)

**Neither document gives percentage weights** for species or domains. Item quotas stay **TBD** until an
ICVA source with weights (e.g., the 2026-27 Candidate Handbook) is provided. No percentages from
third-party sites will be used.

### 3a. Species (from *Species and Diagnoses*, 12 categories)
Aquatics; Bovine; Camelidae and Cervidae; Canine; Equine; Feline; Other Small Mammal; Ovine and Caprine;
Pet Bird; Porcine; Poultry; Reptile. Each is organized by body system (e.g., Cardiovascular, Endocrine,
Gastrointestinal and Digestive, Hemic and Lymphatic, Integumentary, Musculoskeletal, Nervous,
Reproductive, Respiratory, Special Senses, Urinary, Behavior, Multisystemic).
The document states its diagnoses are **examples**; items may cover conditions not listed.

Weights: **TBD (needs ICVA source).**

### 3b. Competency domains (from *Competency Domains*)
- **Clinical Practice**: Data Gathering and Interpretation; Health Maintenance and Problem Management
- **Communications**: with Veterinary and Other Professionals; with Clients
- **Professionalism, Practice Management, and Wellness**: Veterinary Practice Management; Professional
  Development and Lifelong Learning
- **Preventive Medicine and Animal Welfare**: Animal Welfare Issues and Concerns; Environmental Health and
  Safety; Veterinary Public Health; Veterinary Epidemiology and Biostatistics

Weights: **TBD (needs ICVA source).**

### 3c. Tagging for score reports
Each item is tagged with: species (3a), **body system** as named in the ICVA outline (this is the
"discipline" axis, so no invented taxonomy), competency domain + subdomain (3b), and the specific
diagnosis/topic.

### 3d. Copyright
Both ICVA documents say no portion may be reproduced without permission. The repo will **not** contain
their text; only the category names needed for tagging are used.

## 4. Item format
- Single best answer, 5 options (A–E), clinical vignette stem, optional lab table, and an optional image later.
- No "all of the above" or "none of the above". Options are kept similar in length and are plausible distractors.
- Explanation covers why the correct answer is right, why each distractor is wrong, a key takeaway, and a reference topic (Merck Vet Manual / standard texts, cited by topic, not copied).
- **Accuracy policy:** only well-established, textbook-consensus facts. Avoid contested or recently changed guidance. No made-up drug doses: a dose appears only when it's a standard, widely published value. Every item carries a `review_status` (`draft` until it has been reviewed by a veterinarian), and the app shows draft status. AI-written items can contain errors, and students should know that.

Data schema (`data/questions/*.json`, the same shape a future API would return):
```json
{
  "id": "CAN-0001",
  "species": "canine",
  "system": "endocrine",
  "domain": "clinical_practice",
  "subdomain": "data_gathering_interpretation",
  "topics": ["hypoadrenocorticism", "electrolytes"],
  "difficulty": 2,
  "stem": "A 3-year-old spayed female Standard Poodle ...",
  "labs": [{"test": "Na", "value": "128", "unit": "mmol/L", "ref": "144-160"}],
  "options": ["...", "...", "...", "...", "..."],
  "answer": 2,
  "explanation": { "correct": "...", "distractors": ["...", "...", "...", "...", "..."], "takeaway": "..." },
  "reference": "Merck Vet Manual: Hypoadrenocorticism",
  "review_status": "draft"
}
```

## 5. Architecture (web-app-ready from day one)
Plain HTML/CSS/vanilla JS (ES modules), no framework, no build step. It runs with any static server (`npx serve` or `python -m http.server`) and can be deployed as-is to GitHub Pages, Netlify or Vercel.

```
index.html
css/app.css
js/
  main.js            # routing between screens
  state.js           # exam session state machine (pure, no DOM)
  timer.js           # drift-proof timer (based on wall-clock deadline; survives refresh)
  assembler.js       # builds an exam form from the bank to match blueprint quotas, shuffles options
  scoring.js         # raw score, % by species/system/domain, time stats
  storage.js         # StorageAdapter interface → LocalStorageAdapter now, ApiAdapter later
  bank.js            # QuestionBank interface → loads JSON now, fetches from API later
  ui/                # home, tutorial, question, block-review, break, results, history screens
data/
  blueprint.json     # species/system/domain lists; quotas TBD until ICVA weights provided
  questions/*.json   # one file per species
tests/               # unit tests for assembler, scoring and timer (node --test)
```

Points that matter for converting to a web app later:
- **Storage adapter.** All persistence (in-progress session, history, settings) goes through one interface, so moving to a backend means swapping one file.
- **Bank adapter.** Questions are loaded through an interface, so they can move behind an API (and the answers can be kept off the client) without touching the UI.
- **Timer uses deadlines.** It stores `blockDeadline` (epoch ms), not "seconds left". Refreshing or closing the tab doesn't pause the clock, same as the real exam. Should a reload pause instead? That's a setting.
- Mobile-friendly layout, keyboard shortcuts (A–E / 1–5 to pick, N/P to move, F to flag), a light/dark theme, and an optional strike-through on options.

## 6. Results and history
- Summary: score, % correct, and time used per block. No pass prediction or scaled score, because ICVA's scaling isn't public.
- Breakdown tables and bar charts: by species, body system and competency domain, each with n and % correct. Weakest areas are highlighted.
- Review mode: every item, with your answer, the correct answer and the full explanation. Filters: incorrect, flagged, species, body system.
- History: every attempt is saved with date, mode, score and breakdown. Trends over time. Export/import as JSON for backup.
- Avoid repeats: the assembler prefers items you haven't seen yet (tracked in storage).

## 7. Phases
1. **Phase 1, practice MVP (built first, for you to test):** the full engine (timer, block flow, flag/review, locking, results, breakdowns, persistence, resume) plus **60 original items** (2 blocks). Until weights are provided, species mix is an even spread across the 12 ICVA species categories and labeled "not blueprint-weighted". Practice mode with 1 or 2 blocks.
2. **Phase 2, your feedback:** fix UX issues and adjust item style and difficulty based on how Phase 1 feels.
3. **Phase 3, full bank:** write the rest of the bank in species batches until there are at least 360 items (target 400+ so forms can vary), each batch checked against the quotas.
4. **Phase 4, full exam mode:** 12 blocks, breaks, tutorial, history trends. Optional: a GitHub Pages deploy.

## 8. Open questions for you
1. **Refresh behavior:** should the block timer keep running while the tab is closed (realistic) or pause?
2. **Timing confirmation:** can you confirm block count, minutes per block, tutorial and break allowance from the Candidate Handbook?
3. **Blueprint weights:** can you share the ICVA page with species and domain percentages (the Candidate Handbook)? Without it, quotas stay TBD.
4. **Pretest items:** should every item count (my default), or should 60 be unscored like the real exam?
5. **Difficulty:** should items be at NAVLE level, or slightly harder?
6. **Item review:** is there a veterinarian (you or a colleague) who can review items before they are marked `reviewed`? Until then every item ships as `draft`.
