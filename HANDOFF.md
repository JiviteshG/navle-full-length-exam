# Project status and handoff notes

Read this first when resuming work. Full design: `PLAN.md`. How to run: `README.md`.

## Where things stand (2026-10-02)
- Branch `claude/navle-timed-test-ya3ix2`, deployed on GitHub Pages: https://jiviteshg.github.io/navle-full-length-exam/ (repo made public by the owner).
- The link has been sent to the reviewing veterinarian. **Waiting for her `navle-reviews-*.json` export.**
- 110 original questions, all `review_status: "draft"`. 11 have real images in `data/images/`, all credited (author, license, source URL). 11/110 = 10%, so image items are now below the 18–20% target: new image questions are needed (the owner supplies the images).
- Bank growth (Phase 3) started 2026-10-02. Batch 1 = CAN-0016–0035 plus restored topics FEL-0016 (ATE), EQU-0010 (EPM), EQU-0011 (navicular), BOV-0009 (Mannheimia/BRD metaphylaxis), BOV-0010 (nitrate). Batch 2 = FEL-0017–0031 and EQU-0012–0021. Each cites a source in `reference`, and option lengths were balanced as they were written.
- Assembler now has a repair pass (single swaps and two-step cross-species chains), so 1- and 2-block forms hit subdomain quotas exactly (100 seeds tested).
- Tests: `npm test` (11 passing). Local run: `python3 -m http.server 8000`.

## Confirmed decisions (from the owner)
- Format: 12 blocks × 30 questions, 33 min per block, 50-min pooled break (ICVA Candidate Handbook 2026-27, uploaded by the owner). Every question is scored.
- Blueprint weights come from the ICVA handbook (species and competency %); quotas use largest-remainder rounding.
- Epidemiology and Biostatistics questions count toward Veterinary Public Health's 4%.
- Timer runs until Pause; Resume continues. Explanations appear only after the whole exam.
- Image questions: target 18–20% of items, real clinical images only. Redraft only image questions; leave the rest unchanged.
- Never guess facts or numbers. Flag anything unverified. Don't commit files of unknown origin.
- NAVLE-level difficulty. Handbook: "some responses may be partially correct", so distractors should be partially correct.

## TODO (owner, 2026-10-02)
- Safeguard: each session stores its own copy of question text, options and answer key at start, so later pushes don't change in-progress tests or past scores. Do this before editing questions while people are mid-test.
- Even out option lengths in the original 60 questions (new batches are balanced as they are written).

## Next steps
1. When the vet's review JSON arrives: for each `rating: "down"` item, fix it using her comment, bump `version`, keep `draft`. For `rating: "up"` on the current version, set `review_status: "reviewed"`.
2. Even out option lengths in the 49 non-image questions. The correct answer is often the longest.
3. Strengthen easy items (e.g., CAN-0014 controlled drugs, EQU-0007/PLT-0001 euthanasia, FEL-0015 declaw, FEL-0014 references).
4. ~~Restore dropped topics~~ done in batch 1.
5. Phase 3: grow the bank to 400+ toward the 360 quotas (92/88/53/48/18/12/12/8/7/7/6/5/4 by species; 126/126/22/18/14/18/11/14/11 by subdomain), keeping 18–20% image items.
6. Optional: the 10-minute tutorial screen (Handbook says it starts the exam clock).

## Environment gotchas
- Wikimedia rate-limits this container (HTTP 429), and `thumb.wikimedia.org` is blocked. The owner downloads images in a browser and uploads them; I verify, crop or resize (`convert` is available), and record credits.
- Allowed domains: commons.wikimedia.org, upload.wikimedia.org, www.ncbi.nlm.nih.gov. icva.net is blocked.
- Browser tests: Playwright at `/opt/node-tools/node_modules/playwright` (load it with `createRequire`).
