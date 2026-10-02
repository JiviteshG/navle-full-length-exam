import { speciesQuotas, subdomainQuotas, quotaKey } from './quota.js';

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Builds an exam form: species quotas are met exactly; within each species, items are chosen
// to bring subdomain counts as close to target as the bank allows. Unseen items are preferred.
// Returns { items, blocks, quotas, shortfalls }.
export function assemble({ bank, blueprint, blocks, perBlock, seen = new Set(), excludeIds = new Set(), rand = Math.random }) {
  const total = blocks * perBlock;
  const spQ = speciesQuotas(blueprint, total);
  const sdQ = subdomainQuotas(blueprint, total);
  const pool = bank.filter((q) => !excludeIds.has(q.id));

  const shortfalls = [];
  for (const [sp, n] of Object.entries(spQ)) {
    const have = pool.filter((q) => q.species === sp).length;
    if (have < n) shortfalls.push({ species: sp, need: n, have });
  }
  if (shortfalls.length) return { items: [], blocks: [], quotas: { species: spQ, subdomain: sdQ }, shortfalls };

  const sdCount = Object.fromEntries(Object.keys(sdQ).map((k) => [k, 0]));
  const picked = [];
  // Fill scarce species first so they don't lose the subdomains they can uniquely supply.
  const speciesOrder = Object.keys(spQ)
    .filter((sp) => spQ[sp] > 0)
    .sort((a, b) => pool.filter((q) => q.species === a).length / spQ[a] - pool.filter((q) => q.species === b).length / spQ[b]);

  for (const sp of speciesOrder) {
    let candidates = shuffle(pool.filter((q) => q.species === sp), rand);
    for (let k = 0; k < spQ[sp]; k++) {
      let best = null;
      let bestScore = -Infinity;
      for (const q of candidates) {
        const g = quotaKey(blueprint, q.subdomain);
        const deficit = (sdQ[g] ?? 0) - (sdCount[g] ?? 0);
        const score = deficit * 10 + (seen.has(q.id) ? 0 : 1);
        if (score > bestScore) { best = q; bestScore = score; }
      }
      picked.push(best);
      const g = quotaKey(blueprint, best.subdomain);
      sdCount[g] = (sdCount[g] ?? 0) + 1;
      candidates = candidates.filter((q) => q !== best);
    }
  }

  // Repair pass: swap within a species to move items from over-quota to under-quota subdomains.
  const gOf = (q) => quotaKey(blueprint, q.subdomain);
  for (let guard = 0; guard < 500; guard++) {
    const over = Object.keys(sdCount).filter((g) => sdCount[g] > (sdQ[g] ?? 0));
    const under = Object.keys(sdQ).filter((g) => (sdCount[g] ?? 0) < sdQ[g]);
    if (!over.length || !under.length) break;
    const inForm = new Set(picked);
    let swapped = false;
    for (let i = 0; i < picked.length && !swapped; i++) {
      const q = picked[i];
      if (!over.includes(gOf(q))) continue;
      const r = pool.find((x) => !inForm.has(x) && x.species === q.species && under.includes(gOf(x)));
      if (r) {
        picked[i] = r;
        sdCount[gOf(q)] -= 1;
        sdCount[gOf(r)] = (sdCount[gOf(r)] ?? 0) + 1;
        swapped = true;
      }
    }
    // Two-step chain: q (over) -> r in group X, then q2 (group X, other species) -> r2 (under).
    for (let i = 0; i < picked.length && !swapped; i++) {
      const q = picked[i];
      if (!over.includes(gOf(q))) continue;
      for (const r of pool) {
        if (swapped) break;
        if (inForm.has(r) || r.species !== q.species || gOf(r) === gOf(q)) continue;
        for (let j = 0; j < picked.length; j++) {
          const q2 = picked[j];
          if (j === i || gOf(q2) !== gOf(r)) continue;
          const r2 = pool.find((x) => !inForm.has(x) && x !== r && x.species === q2.species && under.includes(gOf(x)));
          if (r2) {
            picked[i] = r; picked[j] = r2;
            sdCount[gOf(q)] -= 1; sdCount[gOf(r2)] = (sdCount[gOf(r2)] ?? 0) + 1;
            swapped = true;
            break;
          }
        }
      }
    }
    if (!swapped) break;
  }

  const ordered = shuffle(picked, rand);
  const items = ordered.map((q) => ({ id: q.id, version: q.version, optionOrder: shuffle(q.options.map((_, i) => i), rand) }));
  const blockList = [];
  for (let b = 0; b < blocks; b++) blockList.push(items.slice(b * perBlock, (b + 1) * perBlock).map((it) => it.id));
  return { items, blocks: blockList, quotas: { species: spQ, subdomain: sdQ }, subdomainActual: sdCount, shortfalls: [] };
}
