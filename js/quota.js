// Turns blueprint percentages into whole-item quotas that sum exactly to `total`
// (largest-remainder method; ties go to the earlier entry in blueprint order).
export function largestRemainder(entries, total) {
  const sum = entries.reduce((s, e) => s + e.pct, 0);
  const raw = entries.map((e) => (e.pct / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((s, n) => s + n, 0);
  const order = raw
    .map((r, i) => ({ i, rem: r - Math.floor(r) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; k < left; k++) out[order[k].i] += 1;
  return Object.fromEntries(entries.map((e, i) => [e.key, out[i]]));
}

export function speciesQuotas(blueprint, total) {
  return largestRemainder(blueprint.species, total);
}

// Subdomain quotas. Subdomains with a quotaGroup (epidemiology -> public_health) share that
// group's quota, so only weighted subdomains get their own entry.
export function subdomainQuotas(blueprint, total) {
  return largestRemainder(blueprint.subdomains.filter((s) => s.pct > 0), total);
}

export function quotaKey(blueprint, subdomainKey) {
  const s = blueprint.subdomains.find((x) => x.key === subdomainKey);
  return s && s.quotaGroup ? s.quotaGroup : subdomainKey;
}
