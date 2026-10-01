# NAVLE Full-Length Timed Exam

A timed, NAVLE-style practice exam that runs in the browser. Plain HTML/CSS/JS with no build step. See `PLAN.md` for the full design.

## Run it
```
python3 -m http.server 8000     # or: npm start
```
Then open http://localhost:8000. Opening `index.html` straight from disk won't work, because the browser blocks loading the data files.

## Test it
```
npm test
```
The tests check every question's format, the blueprint math (percentages → question counts), building an exam form, the timer (pause/resume), and scoring.

## Status (Phase 1)
- Practice mode with 1 or 2 blocks. Full 12-block exam unlocks once the bank covers every species quota (360+ questions).
- 60 original questions, all marked **draft** until a veterinarian reviews them.
- Block timing (12 × 30 questions, 33 min) still needs confirming against the ICVA Candidate Handbook. To change it, edit `js/config.js`.

## Veterinarian review
1. On the home page, turn on **Reviewer mode** and enter a name.
2. Take a block and submit it.
3. On the results page, rate each question 👍 or 👎. A 👎 opens a comment box.
4. Press **Export reviews** and send the JSON file in. Ratings are tied to each question's `version`.

## Layout
- `data/blueprint.json`: ICVA species and competency weights.
- `data/questions/*.json`: the question bank, listed in `index.json`.
- `js/`: `assembler` (builds exam forms), `quota`, `timer`, `scoring`, `storage` (saved data; swap this for an API later), `bank` (question loading; swap this for an API later), `main` (the user interface).
