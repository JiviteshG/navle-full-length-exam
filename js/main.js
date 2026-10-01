import { EXAM_CONFIG } from './config.js';
import { assemble } from './assembler.js';
import { speciesQuotas } from './quota.js';
import * as T from './timer.js';
import { score } from './scoring.js';
import { LocalStorageAdapter } from './storage.js';
import { StaticBank } from './bank.js';

const store = new LocalStorageAdapter();
const bankSource = new StaticBank('data');
const app = document.getElementById('app');
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

let blueprint, bank, bankById, labels;
let session = null; // active exam session
let tickHandle = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lab = (group, key) => labels[group]?.[key] ?? key;

// ---------- boot ----------
async function boot() {
  try {
    [blueprint, bank] = await Promise.all([bankSource.loadBlueprint(), bankSource.loadQuestions()]);
  } catch (e) {
    app.innerHTML = `<div class="panel"><h1>Couldn't load the question bank</h1>
      <p>Open this app through a local web server, for example <code>python3 -m http.server 8000</code>, then visit
      <code>http://localhost:8000</code>. Opening <code>index.html</code> directly from disk blocks the data files.</p>
      <p class="muted">${esc(e.message)}</p></div>`;
    return;
  }
  bankById = Object.fromEntries(bank.map((q) => [q.id, q]));
  labels = {
    species: Object.fromEntries(blueprint.species.map((s) => [s.key, s.label])),
    subdomain: Object.fromEntries(blueprint.subdomains.map((s) => [s.key, s.label])),
    domain: Object.fromEntries(blueprint.domains.map((s) => [s.key, s.label])),
    system: Object.fromEntries(blueprint.systems.map((s) => [s.key, s.label])),
  };
  session = await store.getActiveSession();
  if (session && !session.items.every((it) => bankById[it.id])) {
    session = null; // bank changed under an old session
    await store.clearActiveSession();
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', onKey);
  route();
}

function route() {
  stopTick();
  const h = location.hash.replace('#', '') || 'home';
  if (h === 'exam' && session) return renderExam();
  if (h.startsWith('results/')) return renderResults(h.slice(8));
  if (h === 'history') return renderHistory();
  return renderHome();
}

// ---------- home ----------
async function renderHome() {
  const settings = await store.getSettings();
  const fullTotal = EXAM_CONFIG.fullExamBlocks * EXAM_CONFIG.questionsPerBlock;
  const fullQ = speciesQuotas(blueprint, fullTotal);
  const counts = {};
  for (const q of bank) counts[q.species] = (counts[q.species] ?? 0) + 1;
  const fullReady = Object.entries(fullQ).every(([k, n]) => (counts[k] ?? 0) >= n);
  const reviewed = bank.filter((q) => q.review_status === 'reviewed').length;

  app.innerHTML = `
    ${session ? `<div class="panel"><h2>Exam in progress</h2>
      <p>${esc(modeLabel(session))}: block ${session.currentBlock + 1} of ${session.blocks.length}.
      ${session.timer.status === 'running' ? 'The block timer is still running.' : 'The block timer is paused.'}</p>
      <div class="row"><button class="primary" id="resumeExam">Return to exam</button>
      <button id="abandon">Abandon exam</button></div></div>` : ''}
    <div class="panel">
      <h1>Start an exam</h1>
      <p>One question at a time, ${EXAM_CONFIG.questionsPerBlock} questions per block, ${EXAM_CONFIG.secondsPerBlock / 60} minutes per block.
      Answers and explanations are shown only after the whole exam is submitted. Every question counts.</p>
      <div class="row">
        ${EXAM_CONFIG.practiceBlockOptions.map((n) => `<button class="primary" data-start="${n}" ${session ? 'disabled' : ''}>Practice: ${n} block${n > 1 ? 's' : ''} (${n * EXAM_CONFIG.questionsPerBlock} Q)</button>`).join('')}
        <button data-start="${EXAM_CONFIG.fullExamBlocks}" ${session || !fullReady ? 'disabled' : ''}>Full exam: ${EXAM_CONFIG.fullExamBlocks} blocks (${fullTotal} Q)</button>
      </div>
      ${fullReady ? '' : `<p class="muted">The full exam unlocks when the bank has enough questions for every species quota (${bank.length} of ${fullTotal}+ written so far).</p>`}
      <p class="muted kbd">Keys: A–E or 1–5 to answer, N / P for next / previous, F to flag.</p>
    </div>
    <div class="panel">
      <h2>Please read</h2>
      <ul>
        <li><span class="badge draft">draft</span> All questions are original and AI-written. ${reviewed} of ${bank.length} have been approved by a veterinarian. Draft questions can contain errors, so check anything doubtful against your references.</li>
        <li>Species and competency weights follow the ICVA NAVLE blueprint.${EXAM_CONFIG.timingVerified ? '' : ' <span class="warn">Block count and timing are not yet confirmed against the ICVA Candidate Handbook.</span>'}</li>
        <li>Unlike the real NAVLE, you can pause a block. The timer keeps running, even with the tab closed, until you press Pause.</li>
      </ul>
    </div>
    <div class="panel">
      <h2>Reviewer mode</h2>
      <p class="muted">For the veterinary reviewer. After an exam is submitted, each question gets 👍 / 👎 buttons and a comment box. Ratings are saved in this browser; use “Export reviews” to send them in.</p>
      <div class="row">
        <label><input type="checkbox" id="revMode" ${settings.reviewerMode ? 'checked' : ''}> Reviewer mode on</label>
        <input type="text" id="revName" placeholder="Reviewer name" value="${esc(settings.reviewerName)}">
        <button id="exportReviews">Export reviews</button>
      </div>
    </div>
    <div class="panel">
      <h2>Your data</h2>
      <p class="muted">History and reviews are stored in this browser only. Export a backup to keep them safe or move them to another device.</p>
      <div class="row"><button id="exportAll">Export backup</button>
      <label class="btn">Import backup <input type="file" id="importAll" accept="application/json" hidden></label></div>
    </div>`;

  app.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => startExam(Number(b.dataset.start))));
  app.querySelector('#resumeExam')?.addEventListener('click', () => (location.hash = 'exam'));
  app.querySelector('#abandon')?.addEventListener('click', async () => {
    if (!confirm('Abandon this exam? Your answers will be discarded.')) return;
    session = null;
    await store.clearActiveSession();
    renderHome();
  });
  const saveSettings = async () => store.saveSettings({ reviewerMode: app.querySelector('#revMode').checked, reviewerName: app.querySelector('#revName').value.trim() });
  app.querySelector('#revMode').addEventListener('change', saveSettings);
  app.querySelector('#revName').addEventListener('change', saveSettings);
  app.querySelector('#exportReviews').addEventListener('click', exportReviews);
  app.querySelector('#exportAll').addEventListener('click', async () => download(`navle-backup-${today()}.json`, await store.exportAll()));
  app.querySelector('#importAll').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      await store.importAll(JSON.parse(await f.text()));
      alert('Backup imported.');
    } catch {
      alert('That file could not be read as a backup.');
    }
  });
}

function modeLabel(s) {
  return s.blocks.length === EXAM_CONFIG.fullExamBlocks ? 'Full exam' : `Practice (${s.blocks.length} block${s.blocks.length > 1 ? 's' : ''})`;
}

async function startExam(nBlocks) {
  const seen = await store.getSeenIds();
  const settings = await store.getSettings();
  const form = assemble({ bank, blueprint, blocks: nBlocks, perBlock: EXAM_CONFIG.questionsPerBlock, seen });
  if (form.shortfalls.length) {
    alert('Not enough questions yet for: ' + form.shortfalls.map((s) => `${lab('species', s.species)} (${s.have}/${s.need})`).join(', '));
    return;
  }
  session = {
    id: `s${Date.now()}`,
    createdAt: new Date().toISOString(),
    reviewer: settings.reviewerMode ? settings.reviewerName || 'reviewer' : null,
    items: form.items,
    blocks: form.blocks,
    currentBlock: 0,
    currentIndex: 0,
    answers: {},
    flags: {},
    timer: T.startTimer(EXAM_CONFIG.secondsPerBlock * 1000),
    blockTimeUsedMs: [],
    betweenBlocks: false,
  };
  await persist();
  location.hash = 'exam';
  if (location.hash === '#exam') route();
}

const persist = () => store.saveActiveSession(session);

// ---------- exam ----------
function itemFor(id) { return session.items.find((it) => it.id === id); }
function blockIds() { return session.blocks[session.currentBlock]; }

function renderExam() {
  if (session.betweenBlocks) return renderBetween();
  if (T.remaining(session.timer) <= 0) return submitBlock(true);
  if (session.reviewingBlock) return renderBlockReview();
  if (session.timer.status === 'paused') return renderPaused();

  const ids = blockIds();
  const id = ids[session.currentIndex];
  const q = bankById[id];
  const it = itemFor(id);
  const chosen = session.answers[id];
  const flagged = !!session.flags[id];

  app.innerHTML = `
    <div class="panel examhead">
      <strong>Block ${session.currentBlock + 1}/${session.blocks.length}</strong>
      <span>Question ${session.currentIndex + 1} of ${ids.length}</span>
      <span class="spacer"></span>
      <span class="timer" id="timer">${T.format(T.remaining(session.timer))}</span>
      <button id="pause">Pause</button>
    </div>
    <div class="panel">
      <div class="stem">${esc(q.stem)}</div>
      ${labsTable(q)}
      <ul class="options">
        ${it.optionOrder.map((orig, pos) => `<li><button class="opt ${chosen === orig ? 'selected' : ''}" data-orig="${orig}"><span class="letter">${LETTERS[pos]}.</span><span>${esc(q.options[orig])}</span></button></li>`).join('')}
      </ul>
    </div>
    <div class="panel row">
      <button id="prev" ${session.currentIndex === 0 ? 'disabled' : ''}>◀ Previous</button>
      <button id="flag" class="${flagged ? 'flag-on' : ''}">${flagged ? '⚑ Flagged' : '⚐ Flag'}</button>
      <span class="spacer"></span>
      ${session.currentIndex < ids.length - 1 ? '<button class="primary" id="next">Next ▶</button>' : ''}
      <button id="reviewBlock">Review block</button>
    </div>
    <div class="panel">${navGrid(ids)}</div>`;

  app.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.orig))));
  app.querySelector('#prev').addEventListener('click', () => go(session.currentIndex - 1));
  app.querySelector('#next')?.addEventListener('click', () => go(session.currentIndex + 1));
  app.querySelector('#flag').addEventListener('click', toggleFlag);
  app.querySelector('#reviewBlock').addEventListener('click', () => { session.reviewingBlock = true; persist(); renderExam(); });
  app.querySelector('#pause').addEventListener('click', doPause);
  bindNavGrid();
  startTick();
}

function labsTable(q) {
  if (!q.labs?.length) return '';
  return `<div class="labs table-wrap"><table><thead><tr><th>Test</th><th class="num">Result</th><th>Unit</th><th>Reference interval</th></tr></thead><tbody>
    ${q.labs.map((l) => `<tr><td>${esc(l.test)}</td><td class="num">${esc(l.value)}</td><td>${esc(l.unit)}</td><td>${esc(l.ref)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function navGrid(ids) {
  return `<div class="nav-grid">${ids.map((id, i) => `<button data-go="${i}" class="${session.answers[id] != null ? 'answered' : ''} ${session.flags[id] ? 'flagged' : ''} ${i === session.currentIndex && !session.reviewingBlock ? 'current' : ''}" aria-label="Question ${i + 1}${session.flags[id] ? ', flagged' : ''}${session.answers[id] != null ? ', answered' : ''}">${i + 1}</button>`).join('')}</div>`;
}
function bindNavGrid() {
  app.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { session.reviewingBlock = false; go(Number(b.dataset.go)); }));
}

function choose(orig) {
  session.answers[blockIds()[session.currentIndex]] = orig;
  persist();
  renderExam();
}
function go(i) {
  const n = blockIds().length;
  session.currentIndex = Math.max(0, Math.min(n - 1, i));
  persist();
  renderExam();
}
function toggleFlag() {
  const id = blockIds()[session.currentIndex];
  if (session.flags[id]) delete session.flags[id];
  else session.flags[id] = true;
  persist();
  renderExam();
}
function doPause() {
  session.timer = T.pause(session.timer);
  persist();
  renderExam();
}

function renderPaused() {
  app.innerHTML = `<div class="panel paused">
    <h1>Paused</h1>
    <p>Block ${session.currentBlock + 1} of ${session.blocks.length}. Time remaining: <strong>${T.format(session.timer.remainingMs)}</strong></p>
    <p class="muted">Questions are hidden while paused.</p>
    <button class="primary" id="resume">Resume</button></div>`;
  app.querySelector('#resume').addEventListener('click', () => {
    session.timer = T.resume(session.timer);
    persist();
    renderExam();
  });
}

function renderBlockReview() {
  const ids = blockIds();
  const unanswered = ids.filter((id) => session.answers[id] == null).length;
  const flagged = ids.filter((id) => session.flags[id]).length;
  app.innerHTML = `
    <div class="panel examhead">
      <strong>Block ${session.currentBlock + 1}/${session.blocks.length}: review</strong>
      <span class="spacer"></span>
      <span class="timer" id="timer">${T.format(T.remaining(session.timer))}</span>
      <button id="pause">Pause</button>
    </div>
    <div class="panel">
      <p>${ids.length - unanswered} answered, <span class="${unanswered ? 'bad' : ''}">${unanswered} unanswered</span>, ${flagged} flagged.
      Pick a number to go back to it. After you submit, you can't return to this block.</p>
      ${navGrid(ids)}
    </div>
    <div class="panel row">
      <button id="back">Back to questions</button>
      <span class="spacer"></span>
      <button class="primary" id="submit">Submit block ${session.currentBlock + 1}</button>
    </div>`;
  bindNavGrid();
  app.querySelector('#back').addEventListener('click', () => { session.reviewingBlock = false; persist(); renderExam(); });
  app.querySelector('#pause').addEventListener('click', doPause);
  app.querySelector('#submit').addEventListener('click', () => {
    const msg = unanswered ? `${unanswered} question(s) are unanswered and will be marked wrong. Submit this block?` : 'Submit this block? You will not be able to return to it.';
    if (confirm(msg)) submitBlock(false);
  });
  startTick();
}

async function submitBlock(timedOut) {
  stopTick();
  const used = EXAM_CONFIG.secondsPerBlock * 1000 - T.remaining(session.timer);
  session.blockTimeUsedMs[session.currentBlock] = Math.min(used, EXAM_CONFIG.secondsPerBlock * 1000);
  session.reviewingBlock = false;
  if (session.currentBlock === session.blocks.length - 1) return finishExam(timedOut);
  session.betweenBlocks = true;
  session.lastTimedOut = timedOut;
  await persist();
  renderExam();
}

function renderBetween() {
  const done = session.currentBlock + 1;
  app.innerHTML = `<div class="panel">
    <h1>Block ${done} submitted${session.lastTimedOut ? ' (time ran out)' : ''}</h1>
    <p>${session.blocks.length - done} block(s) left. Take a break if you need one; the next block's ${EXAM_CONFIG.secondsPerBlock / 60}-minute timer starts when you press Start.</p>
    <button class="primary" id="nextBlock">Start block ${done + 1}</button></div>`;
  app.querySelector('#nextBlock').addEventListener('click', async () => {
    session.currentBlock += 1;
    session.currentIndex = 0;
    session.betweenBlocks = false;
    session.timer = T.startTimer(EXAM_CONFIG.secondsPerBlock * 1000);
    await persist();
    renderExam();
  });
}

async function finishExam() {
  const s = score(session, bankById, blueprint);
  const entry = {
    id: session.id,
    createdAt: session.createdAt,
    finishedAt: new Date().toISOString(),
    mode: modeLabel(session),
    reviewer: session.reviewer,
    items: session.items,
    blocks: session.blocks,
    answers: session.answers,
    flags: session.flags,
    blockTimeUsedMs: session.blockTimeUsedMs,
    summary: { total: s.total, correct: s.correct, pct: s.pct },
  };
  await store.addHistory(entry);
  await store.addSeenIds(session.items.map((it) => it.id));
  await store.clearActiveSession();
  session = null;
  location.hash = `results/${entry.id}`;
}

function startTick() {
  stopTick();
  tickHandle = setInterval(() => {
    if (!session || session.timer.status !== 'running') return;
    const ms = T.remaining(session.timer);
    const el = document.getElementById('timer');
    if (el) {
      el.textContent = T.format(ms);
      el.classList.toggle('low', ms <= 5 * 60 * 1000);
    }
    if (ms <= 0) submitBlock(true);
  }, 250);
}
function stopTick() { if (tickHandle) clearInterval(tickHandle); tickHandle = null; }

function onKey(e) {
  if (!session || location.hash !== '#exam' || session.betweenBlocks || session.reviewingBlock || session.timer.status !== 'running') return;
  if (e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  const it = itemFor(blockIds()[session.currentIndex]);
  let pos = 'abcde'.indexOf(k);
  if (pos < 0 && /^[1-5]$/.test(k)) pos = Number(k) - 1;
  if (pos >= 0 && pos < it.optionOrder.length) return choose(it.optionOrder[pos]);
  if (k === 'n' || e.key === 'ArrowRight') return go(session.currentIndex + 1);
  if (k === 'p' || e.key === 'ArrowLeft') return go(session.currentIndex - 1);
  if (k === 'f') return toggleFlag();
}

// ---------- results ----------
async function renderResults(id) {
  const entry = (await store.listHistory()).find((h) => h.id === id);
  if (!entry) { app.innerHTML = '<div class="panel">Result not found.</div>'; return; }
  const missing = entry.items.filter((it) => !bankById[it.id]);
  const usable = { ...entry, items: entry.items.filter((it) => bankById[it.id]) };
  const s = score(usable, bankById, blueprint);
  const reviews = await store.getReviews();
  const settings = await store.getSettings();
  const reviewer = settings.reviewerMode;
  const state = { filter: 'all', species: '', system: '' };

  const breakdown = (title, data, group) => {
    const keys = Object.keys(data).sort((a, b) => data[a].pct - data[b].pct || lab(group, a).localeCompare(lab(group, b)));
    return `<div class="panel"><h2>${title}</h2><div class="table-wrap"><table>
      <thead><tr><th>${title.replace('By ', '')}</th><th class="num">Correct</th><th class="num">%</th><th></th></tr></thead><tbody>
      ${keys.map((k) => `<tr><td>${esc(lab(group, k))}</td><td class="num">${data[k].correct}/${data[k].n}</td><td class="num">${data[k].pct}%</td><td><div class="bar"><span style="width:${data[k].pct}%"></span></div></td></tr>`).join('')}
      </tbody></table></div><p class="muted">Sorted weakest first.</p></div>`;
  };

  const timeUsed = (entry.blockTimeUsedMs || []).map((ms, i) => `Block ${i + 1}: ${T.format(ms)}`).join(' · ');

  app.innerHTML = `
    <div class="panel">
      <h1>${esc(entry.mode)}: ${s.correct}/${s.total} (${s.pct}%)</h1>
      <p class="muted">${new Date(entry.finishedAt).toLocaleString()}${entry.reviewer ? ` · reviewer: ${esc(entry.reviewer)}` : ''}</p>
      <p>Time used: ${timeUsed || '—'}</p>
      ${missing.length ? `<p class="warn">${missing.length} question(s) from this attempt are no longer in the bank and are not shown.</p>` : ''}
      <p class="muted">This is a raw percentage. ICVA reports a scaled score and doesn't publish how raw scores convert, so this can't predict a pass or fail.</p>
    </div>
    ${breakdown('By species', s.bySpecies, 'species')}
    ${breakdown('By body system', s.bySystem, 'system')}
    ${breakdown('By competency domain', s.byDomain, 'domain')}
    ${breakdown('By subdomain', s.bySubdomain, 'subdomain')}
    <div class="panel">
      <h2>Question review</h2>
      <div class="row">
        <select id="fFilter"><option value="all">All</option><option value="wrong">Incorrect or unanswered</option><option value="flagged">Flagged</option>${reviewer ? '<option value="unrated">Not yet rated</option>' : ''}</select>
        <select id="fSpecies"><option value="">All species</option>${Object.keys(s.bySpecies).map((k) => `<option value="${k}">${esc(lab('species', k))}</option>`).join('')}</select>
        <select id="fSystem"><option value="">All body systems</option>${Object.keys(s.bySystem).map((k) => `<option value="${k}">${esc(lab('system', k))}</option>`).join('')}</select>
        ${reviewer ? '<span class="spacer"></span><button id="exportReviews">Export reviews</button>' : ''}
      </div>
    </div>
    <div id="reviewList"></div>`;

  const list = app.querySelector('#reviewList');
  const draw = () => {
    const rows = s.rows.filter((r) =>
      (state.filter === 'all' || (state.filter === 'wrong' && !r.correct) || (state.filter === 'flagged' && entry.flags[r.id]) ||
        (state.filter === 'unrated' && !(reviews[r.id] && reviews[r.id].version === bankById[r.id].version))) &&
      (!state.species || r.species === state.species) && (!state.system || r.system === state.system));
    list.innerHTML = rows.length ? rows.map((r) => reviewCard(r, entry, reviews, reviewer)).join('') : '<div class="panel muted">No questions match these filters.</div>';
    if (reviewer) bindReviewButtons(list, reviews, settings, draw);
  };
  app.querySelector('#fFilter').addEventListener('change', (e) => { state.filter = e.target.value; draw(); });
  app.querySelector('#fSpecies').addEventListener('change', (e) => { state.species = e.target.value; draw(); });
  app.querySelector('#fSystem').addEventListener('change', (e) => { state.system = e.target.value; draw(); });
  app.querySelector('#exportReviews')?.addEventListener('click', exportReviews);
  draw();
}

function reviewCard(r, entry, reviews, reviewer) {
  const q = bankById[r.id];
  const it = entry.items.find((x) => x.id === r.id);
  const num = entry.items.indexOf(it) + 1;
  const rev = reviews[r.id] && reviews[r.id].version === q.version ? reviews[r.id] : null;
  return `<div class="panel" id="q-${esc(q.id)}">
    <div class="row">
      <strong>Q${num}</strong>
      <span class="${r.correct ? 'good' : 'bad'}">${r.correct ? '✔ Correct' : r.chosen == null ? '✖ Unanswered' : '✖ Incorrect'}</span>
      ${entry.flags[r.id] ? '<span class="badge">flagged</span>' : ''}
      <span class="spacer"></span>
      <span class="badge">${esc(lab('species', q.species))}</span>
      <span class="badge">${esc(lab('system', q.system))}</span>
      <span class="badge">${esc(lab('subdomain', q.subdomain))}</span>
      <span class="badge ${q.review_status === 'reviewed' ? 'reviewed' : 'draft'}">${esc(q.review_status)}</span>
    </div>
    <div class="stem">${esc(q.stem)}</div>
    ${labsTable(q)}
    <ul class="options">
      ${it.optionOrder.map((orig, pos) => {
        const cls = orig === q.answer ? 'correct' : orig === r.chosen ? 'wrong' : '';
        const tag = orig === q.answer ? ' (correct answer)' : orig === r.chosen ? ' (your answer)' : '';
        return `<li><div class="opt btn ${cls}"><span class="letter">${LETTERS[pos]}.</span><span>${esc(q.options[orig])}<strong>${tag}</strong>${q.explanation.options?.[orig] ? `<br><span class="muted">${esc(q.explanation.options[orig])}</span>` : ''}</span></div></li>`;
      }).join('')}
    </ul>
    <div class="expl">
      <p><strong>Explanation:</strong> ${esc(q.explanation.correct)}</p>
      ${q.explanation.takeaway ? `<p><strong>Key point:</strong> ${esc(q.explanation.takeaway)}</p>` : ''}
      <p class="muted">Reference topic: ${esc(q.reference)} · ID ${esc(q.id)} v${q.version}</p>
    </div>
    ${reviewer ? `<div class="expl thumbs" data-id="${esc(q.id)}">
      <div class="row"><strong>Reviewer:</strong>
        <button data-rate="up" class="${rev?.rating === 'up' ? 'on-up' : ''}" aria-label="Thumbs up">👍 Accurate</button>
        <button data-rate="down" class="${rev?.rating === 'down' ? 'on-down' : ''}" aria-label="Thumbs down">👎 Needs revision</button>
        ${rev ? `<span class="muted">saved ${new Date(rev.at).toLocaleString()}</span>` : ''}</div>
      <div ${rev?.rating === 'down' ? '' : 'hidden'} class="cbox"><p class="muted">What's wrong? (stem, answer, distractor, explanation, or fact)</p>
        <textarea data-comment>${esc(rev?.comment || '')}</textarea>
        <button data-savecomment>Save comment</button></div>
    </div>` : ''}
  </div>`;
}

function bindReviewButtons(root, reviews, settings, redraw) {
  root.querySelectorAll('.thumbs').forEach((box) => {
    const id = box.dataset.id;
    const save = async (rating, comment) => {
      const rec = { itemId: id, version: bankById[id].version, rating, comment: comment ?? '', reviewer: settings.reviewerName || 'reviewer', at: new Date().toISOString() };
      reviews[id] = rec;
      await store.saveReview(id, rec);
    };
    box.querySelectorAll('[data-rate]').forEach((b) => b.addEventListener('click', async () => {
      const rating = b.dataset.rate;
      await save(rating, rating === 'down' ? box.querySelector('[data-comment]').value : '');
      redraw();
      if (rating === 'down') document.querySelector(`#q-${CSS.escape(id)} [data-comment]`)?.focus();
    }));
    box.querySelector('[data-savecomment]')?.addEventListener('click', async () => {
      await save('down', box.querySelector('[data-comment]').value);
      redraw();
    });
  });
}

async function exportReviews() {
  const settings = await store.getSettings();
  const reviews = await store.getReviews();
  const list = Object.values(reviews);
  if (!list.length) { alert('No reviews saved in this browser yet.'); return; }
  download(`navle-reviews-${(settings.reviewerName || 'reviewer').replace(/\W+/g, '_')}-${today()}.json`, {
    type: 'navle-review-export', exportedAt: new Date().toISOString(), reviewer: settings.reviewerName, reviews: list,
  });
}

// ---------- history ----------
async function renderHistory() {
  const h = await store.listHistory();
  app.innerHTML = `<div class="panel"><h1>History</h1>
    ${h.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Mode</th><th class="num">Score</th><th></th></tr></thead><tbody>
    ${h.map((e) => `<tr><td>${new Date(e.finishedAt).toLocaleString()}</td><td>${esc(e.mode)}${e.reviewer ? ' (review)' : ''}</td>
      <td class="num">${e.summary.correct}/${e.summary.total} (${e.summary.pct}%)</td>
      <td><a href="#results/${esc(e.id)}">Open</a> · <a href="#" data-del="${esc(e.id)}">Delete</a></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted">No finished exams yet.</p>'}</div>`;
  app.querySelectorAll('[data-del]').forEach((a) => a.addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm('Delete this attempt from history?')) { await store.deleteHistory(a.dataset.del); renderHistory(); }
  }));
}

// ---------- utils ----------
function today() { return new Date().toISOString().slice(0, 10); }
function download(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

boot();
