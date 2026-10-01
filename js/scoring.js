// Scores a finished session. Every item counts (no unscored pretest items).
function tally(rows, keyFn) {
  const out = {};
  for (const r of rows) {
    const k = keyFn(r);
    out[k] ??= { n: 0, correct: 0 };
    out[k].n += 1;
    if (r.correct) out[k].correct += 1;
  }
  for (const v of Object.values(out)) v.pct = v.n ? Math.round((v.correct / v.n) * 100) : 0;
  return out;
}

export function score(session, bankById, blueprint) {
  const domainOf = Object.fromEntries(blueprint.subdomains.map((s) => [s.key, s.domain]));
  const rows = session.items.map((it) => {
    const q = bankById[it.id];
    const chosen = session.answers[it.id];
    return {
      id: it.id,
      species: q.species,
      system: q.system,
      subdomain: q.subdomain,
      domain: domainOf[q.subdomain],
      chosen: chosen ?? null,
      correct: chosen === q.answer,
    };
  });
  const correct = rows.filter((r) => r.correct).length;
  return {
    total: rows.length,
    correct,
    pct: rows.length ? Math.round((correct / rows.length) * 100) : 0,
    rows,
    bySpecies: tally(rows, (r) => r.species),
    bySystem: tally(rows, (r) => r.system),
    byDomain: tally(rows, (r) => r.domain),
    bySubdomain: tally(rows, (r) => r.subdomain),
  };
}
