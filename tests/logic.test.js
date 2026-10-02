import test from 'node:test';
import assert from 'node:assert/strict';
import { bank, blueprint } from './helpers.js';
import { largestRemainder, speciesQuotas, subdomainQuotas, quotaKey } from '../js/quota.js';
import { assemble } from '../js/assembler.js';
import * as T from '../js/timer.js';
import { score } from '../js/scoring.js';

test('quotas match the published plan', () => {
  assert.deepEqual(Object.values(speciesQuotas(blueprint, 360)), [92, 88, 53, 48, 18, 12, 12, 8, 7, 7, 6, 5, 4]);
  assert.deepEqual(Object.values(speciesQuotas(blueprint, 60)), [15, 15, 9, 8, 3, 2, 2, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(Object.values(speciesQuotas(blueprint, 30)), [8, 7, 4, 4, 1, 1, 1, 1, 1, 1, 1, 0, 0]);
  assert.deepEqual(subdomainQuotas(blueprint, 360), {
    data_gathering: 126, health_maintenance: 126, animal_welfare: 22, environmental_health: 18, public_health: 14,
    comm_clients: 18, comm_professionals: 11, practice_management: 14, professional_development: 11,
  });
  assert.equal(quotaKey(blueprint, 'epidemiology'), 'public_health');
});

test('largestRemainder always sums to total', () => {
  for (const n of [1, 7, 30, 60, 99, 360]) {
    const q = largestRemainder(blueprint.species, n);
    assert.equal(Object.values(q).reduce((a, b) => a + b, 0), n);
  }
});

function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

test('2-block form meets species and subdomain quotas exactly', () => {
  const f = assemble({ bank, blueprint, blocks: 2, perBlock: 30, rand: seeded(1) });
  assert.equal(f.shortfalls.length, 0);
  assert.equal(f.items.length, 60);
  assert.equal(f.blocks.length, 2);
  assert.equal(new Set(f.items.map((i) => i.id)).size, 60);
  const byId = Object.fromEntries(bank.map((q) => [q.id, q]));
  const sp = {};
  for (const it of f.items) sp[byId[it.id].species] = (sp[byId[it.id].species] ?? 0) + 1;
  for (const [k, n] of Object.entries(f.quotas.species)) assert.equal(sp[k] ?? 0, n, k);
  assert.deepEqual(f.subdomainActual, f.quotas.subdomain);
  for (const it of f.items) assert.deepEqual([...it.optionOrder].sort(), [0, 1, 2, 3, 4]);
});

test('1-block form meets species quotas', () => {
  const f = assemble({ bank, blueprint, blocks: 1, perBlock: 30, rand: seeded(7) });
  assert.equal(f.items.length, 30);
  assert.equal(f.shortfalls.length, 0);
});

test('full exam reports shortfalls when bank is too small', () => {
  const f = assemble({ bank, blueprint, blocks: 12, perBlock: 30 });
  if (bank.length < 360) assert.ok(f.shortfalls.length > 0);
});

test('timer pauses, resumes and keeps running while closed', () => {
  let t = T.startTimer(60000, 0);
  assert.equal(T.remaining(t, 10000), 50000);
  t = T.pause(t, 10000);
  assert.equal(T.remaining(t, 999999), 50000);
  t = T.resume(t, 500000);
  assert.equal(T.remaining(t, 520000), 30000);
  assert.equal(T.remaining(t, 999999), 0);
  assert.equal(T.format(65000), '01:05');
});

test('scoring counts every item and breaks down by axis', () => {
  const items = bank.slice(0, 3).map((q) => ({ id: q.id }));
  const answers = { [bank[0].id]: bank[0].answer, [bank[1].id]: (bank[1].answer + 1) % 5 };
  const byId = Object.fromEntries(bank.map((q) => [q.id, q]));
  const s = score({ items, answers }, byId, blueprint);
  assert.equal(s.total, 3);
  assert.equal(s.correct, 1);
  assert.equal(Object.values(s.bySpecies).reduce((a, b) => a + b.n, 0), 3);
});

test('practice forms hit subdomain quotas exactly across many seeds', () => {
  for (let s = 1; s <= 100; s++) {
    for (const blocks of [1, 2]) {
      const f = assemble({ bank, blueprint, blocks, perBlock: 30, rand: seeded(s) });
      assert.equal(f.shortfalls.length, 0, `seed ${s}`);
      for (const [k, n] of Object.entries(f.quotas.subdomain)) assert.equal(f.subdomainActual[k] ?? 0, n, `seed ${s} blocks ${blocks} ${k}`);
    }
  }
});
