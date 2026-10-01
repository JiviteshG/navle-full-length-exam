import test from 'node:test';
import assert from 'node:assert/strict';
import { bank, blueprint } from './helpers.js';
import { speciesQuotas, subdomainQuotas, quotaKey } from '../js/quota.js';

const species = new Set(blueprint.species.map((s) => s.key));
const subdomains = new Set(blueprint.subdomains.map((s) => s.key));
const systems = new Set(blueprint.systems.map((s) => s.key));

test('every question has a valid schema', () => {
  const ids = new Set();
  for (const q of bank) {
    const where = q.id ?? JSON.stringify(q).slice(0, 60);
    assert.ok(q.id && !ids.has(q.id), `unique id: ${where}`);
    ids.add(q.id);
    assert.ok(species.has(q.species), `species ${q.species} in ${where}`);
    assert.ok(subdomains.has(q.subdomain), `subdomain ${q.subdomain} in ${where}`);
    assert.ok(systems.has(q.system), `system ${q.system} in ${where}`);
    assert.equal(q.options.length, 5, `5 options in ${where}`);
    assert.equal(new Set(q.options).size, 5, `distinct options in ${where}`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 5, `answer index in ${where}`);
    assert.ok(q.stem.length > 40, `stem in ${where}`);
    assert.ok(q.explanation?.correct, `explanation in ${where}`);
    assert.equal(q.explanation.options?.length, 5, `per-option explanations in ${where}`);
    assert.ok(q.reference, `reference in ${where}`);
    assert.ok(['draft', 'reviewed', 'needs_revision'].includes(q.review_status), `review_status in ${where}`);
    assert.ok(Number.isInteger(q.version) && q.version >= 1, `version in ${where}`);
  }
});

test('blueprint percentages sum to 100', () => {
  const sum = (a) => Math.round(a.reduce((s, x) => s + x.pct, 0) * 10) / 10;
  assert.equal(sum(blueprint.species), 100);
  assert.equal(sum(blueprint.domains), 100);
  assert.equal(sum(blueprint.subdomains), 100);
  for (const d of blueprint.domains) {
    const sub = blueprint.subdomains.filter((s) => s.domain === d.key).reduce((s, x) => s + x.pct, 0);
    assert.equal(Math.round(sub * 10) / 10, d.pct, `subdomains of ${d.key}`);
  }
});

test('bank covers at least the 2-block practice quotas exactly on both axes', () => {
  const spQ = speciesQuotas(blueprint, 60);
  for (const [k, n] of Object.entries(spQ)) {
    assert.ok(bank.filter((q) => q.species === k).length >= n, `species ${k} needs ${n}`);
  }
  const sdQ = subdomainQuotas(blueprint, 60);
  const counts = {};
  for (const q of bank) { const g = quotaKey(blueprint, q.subdomain); counts[g] = (counts[g] ?? 0) + 1; }
  for (const [k, n] of Object.entries(sdQ)) assert.ok((counts[k] ?? 0) >= n, `subdomain ${k} needs ${n}, has ${counts[k] ?? 0}`);
});
