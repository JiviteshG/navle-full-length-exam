# NAVLE Full-Length Timed Exam — Build Plan

## 1. Goals
- Simulate the **current NAVLE** (Oct 2026 onward): 360 items, 12 blocks × 30 items, 33 min per block.
- **Original** NAVLE-style clinical vignettes, distributed per the ICVA blueprint.
- One question at a time, flag/review within a block, explanations **only after the whole exam is submitted**.
- Score breakdown by **species**, **discipline**, and **competency domain**.
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
| Breaks between blocks | Optional, pooled break timer (default 45 min total, configurable) | Optional |

Behavior that matches the real test:
- A block's timer starts when the block starts. When time runs out, the block is auto-submitted and unanswered items are marked wrong.
- Inside a block: Prev/Next, a navigator grid, **flag for review**, and an end-of-block review screen listing unanswered and flagged items.
- **Finished blocks are locked.** You can't go back to them.
- No feedback during the exam. Answers, the correct option and explanations appear only on the results screen after the last block.
- Every block has 5 unscored "pretest" items (60/360). These are optional and off by default, because with original questions every item might as well count. If turned on, they still show explanations but aren't scored.

## 3. Blueprint targets

### 3a. Species (axis 1)
| Species | % | Full (360) | Practice (60) |
|---|---|---|---|
| Canine | 25.6 | 93 | 15 |
| Feline | 24.3 | 87 | 15 |
| Equine | 14.7 | 53 | 9 |
| Bovine | 13.3 | 48 | 8 |
| Porcine | 5.0 | 18 | 3 |
| Ovine/Caprine | 3.3 | 12 | 2 |
| Other small mammals | 3.3 | 12 | 2 |
| Pet bird | 2.3 | 8 | 1 |
| Poultry | 2.0 | 7 | 1 |
| Non-species-specific | 2.0 | 7 | 1 |
| Camelid/Cervid | 1.7 | 6 | 1 |
| Reptile/Amphibian | 1.5 | 5 | 1 |
| Aquatic | 1.0 | 4 | 1 |

### 3b. Competency domain (axis 2)
| Domain | % | Full |
|---|---|---|
| Clinical Practice: Data Gathering & Interpretation | 35 | 126 |
| Clinical Practice: Health Maintenance & Problem Management | 35 | 126 |
| Preventive Medicine & Animal Welfare (welfare 6, environmental health/safety 5, public health 4) | 15 | 54 |
| Communication (clients 5, professionals 3) | 8 | 29 |
| Professionalism, Practice Management & Wellness | 7 | 25 |

> These numbers come from secondary summaries of the ICVA handbook, because icva.net is blocked from this build environment. Please check them against your copy of the 2026–27 Candidate Handbook.

### 3c. Discipline (axis 3, my own tagging for reports)
Internal medicine, Surgery, Anesthesia/Analgesia, Pharmacology/Toxicology, Clinical pathology, Diagnostic imaging, Infectious disease/Microbiology, Parasitology, Theriogenology, Nutrition, Behavior, Dermatology, Ophthalmology, Cardiology, Neurology, Oncology, Emergency/Critical care, Herd health/Production medicine, Public health/Regulatory, Practice management/Ethics.

Each item is tagged with one species, one competency domain, one primary discipline, and free-text topic tags.

## 4. Item format
- Single best answer, 5 options (A–E), clinical vignette stem, optional lab table, and an optional image later.
- No "all of the above" or "none of the above". Options are kept similar in length and are plausible distractors.
- Explanation covers why the correct answer is right, why each distractor is wrong, a key takeaway, and a reference topic (Merck Vet Manual / standard texts, cited by topic, not copied).

Data schema (`data/questions/*.json`, the same shape a future API would return):
```json
{
  "id": "CAN-0001",
  "species": "canine",
  "domain": "data_gathering",
  "discipline": "internal_medicine",
  "topics": ["hypoadrenocorticism", "electrolytes"],
  "difficulty": 2,
  "stem": "A 3-year-old spayed female Standard Poodle ...",
  "labs": [{"test": "Na", "value": "128", "unit": "mmol/L", "ref": "144-160"}],
  "options": ["...", "...", "...", "...", "..."],
  "answer": 2,
  "explanation": { "correct": "...", "distractors": ["...", "...", "...", "...", "..."], "takeaway": "..." },
  "reference": "Merck Vet Manual: Hypoadrenocorticism"
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
  scoring.js         # raw score, % by species/domain/discipline, time stats
  storage.js         # StorageAdapter interface → LocalStorageAdapter now, ApiAdapter later
  bank.js            # QuestionBank interface → loads JSON now, fetches from API later
  ui/                # home, tutorial, question, block-review, break, results, history screens
data/
  blueprint.json     # quotas from section 3
  questions/*.json   # one file per species
tests/               # unit tests for assembler, scoring and timer (node --test)
```

Points that matter for converting to a web app later:
- **Storage adapter.** All persistence (in-progress session, history, settings) goes through one interface, so moving to a backend means swapping one file.
- **Bank adapter.** Questions are loaded through an interface, so they can move behind an API (and the answers can be kept off the client) without touching the UI.
- **Timer uses deadlines.** It stores `blockDeadline` (epoch ms), not "seconds left". Refreshing or closing the tab doesn't pause the clock, same as the real exam. Should a reload pause instead? That's a setting.
- Mobile-friendly layout, keyboard shortcuts (A–E / 1–5 to pick, N/P to move, F to flag), a light/dark theme, and an optional strike-through on options.

## 6. Results and history
- Summary: score, % correct, an estimated pass-likelihood band (stated as a rough guide, not an ICVA scale score), and time used per block.
- Breakdown tables and bar charts: by species, discipline and domain, each with n and % correct. Weakest areas are highlighted.
- Review mode: every item, with your answer, the correct answer and the full explanation. Filters: incorrect, flagged, species, discipline.
- History: every attempt is saved with date, mode, score and breakdown. Trends over time. Export/import as JSON for backup.
- Avoid repeats: the assembler prefers items you haven't seen yet (tracked in storage).

## 7. Phases
1. **Phase 1, practice MVP (built first, for you to test):** the full engine (timer, block flow, flag/review, locking, results, breakdowns, persistence, resume) plus **60 original items** (2 blocks) matching the practice quotas in 3a. Practice mode with 1 or 2 blocks.
2. **Phase 2, your feedback:** fix UX issues and adjust item style and difficulty based on how Phase 1 feels.
3. **Phase 3, full bank:** write the rest of the bank in species batches until there are at least 360 items (target 400+ so forms can vary), each batch checked against the quotas.
4. **Phase 4, full exam mode:** 12 blocks, breaks, tutorial, history trends. Optional: a GitHub Pages deploy.

## 8. Open questions for you
1. **Refresh behavior:** should the block timer keep running while the tab is closed (realistic) or pause?
2. **Break time:** should the pooled break allowance be 45 minutes total, or unlimited for practice?
3. **Pretest items:** should every item count (my default), or should 60 be unscored like the real exam?
4. **Difficulty:** should items be at NAVLE level, or slightly harder?
