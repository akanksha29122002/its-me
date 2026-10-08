// Run with: npm test   (Node 18+, no dependencies)
// Numbers are synthetic test values, not profile stats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSnapshot } from '../scripts/snapshot-profiles.mjs';
import { PROFILES } from '../js/profile-sources.mjs';

const now = new Date('2026-01-02T03:04:05.000Z');
const old = { fetchedAt: '2026-01-01T00:00:00.000Z', data: { handle: PROFILES.codechef.handle, rating: 1500 } };

test('a fresh result replaces the previous entry and gets the current time', () => {
  const out = mergeSnapshot({ profiles: { codechef: old } }, { codechef: { data: { handle: PROFILES.codechef.handle, rating: 1600 } } }, now);
  assert.deepEqual(out.profiles.codechef, { fetchedAt: now.toISOString(), data: { handle: PROFILES.codechef.handle, rating: 1600 } });
});

test('a failed platform keeps its previous entry with its original fetchedAt', () => {
  const out = mergeSnapshot({ profiles: { codechef: old } }, { codechef: { error: new Error('blocked') } }, now);
  assert.deepEqual(out.profiles.codechef, old);
});

test('a previous entry for a different handle is dropped, not shown as current', () => {
  const stale = { fetchedAt: old.fetchedAt, data: { handle: 'someone-else', rating: 1500 } };
  const out = mergeSnapshot({ profiles: { codechef: stale } }, { codechef: { error: new Error('blocked') } }, now);
  assert.equal(out.profiles.codechef, undefined);
});

test('no previous file and every platform failing yields an empty snapshot', () => {
  const failed = Object.fromEntries(Object.keys(PROFILES).map((p) => [p, { error: new Error('down') }]));
  assert.deepEqual(mergeSnapshot(null, failed, now), { profiles: {} });
});
