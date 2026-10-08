/* ================================================================
   PROFILE SNAPSHOT - writes data/profiles.json, the last-known stats
   the page falls back to when a platform can't be read live.

   Why this exists: CodeChef and GeeksforGeeks block cross-origin browser
   requests, and GitHub Pages / a local preview have no serverless proxy.
   Node can read them directly, so this script does it ahead of time.

   Run with: npm run snapshot   (the Pages deploy workflow runs it on
   every deploy and once a day). A platform that fails keeps its previous
   entry with its original fetchedAt, so "synced N ago" stays truthful.
   ================================================================ */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROFILES, PLATFORMS, SERVER_SOURCES } from '../js/profile-sources.mjs';

const OUT = fileURLToPath(new URL('../data/profiles.json', import.meta.url));

const sameHandle = (data, platform) =>
  String((data && data.handle) || '').toLowerCase() === PROFILES[platform].handle.toLowerCase();

/** results: { [platform]: { data } | { error } }. Pure, so it can be tested.
    An old entry is only kept if it belongs to the current handle. */
export function mergeSnapshot(previous, results, now = new Date()) {
  const prev = previous && previous.profiles && typeof previous.profiles === 'object' ? previous.profiles : {};
  const profiles = {};
  for (const p of PLATFORMS) {
    const r = results[p];
    if (r && r.data) profiles[p] = { fetchedAt: now.toISOString(), data: r.data };
    else if (prev[p] && sameHandle(prev[p].data, p)) profiles[p] = prev[p];
  }
  return { profiles };
}

async function readPrevious() {
  try {
    return JSON.parse(await fs.readFile(OUT, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const previous = await readPrevious();
  const results = {};
  await Promise.all(PLATFORMS.map(async (p) => {
    try {
      results[p] = { data: await SERVER_SOURCES[p]() };
      console.log(`[snapshot] ${PROFILES[p].label}: ok`);
    } catch (err) {
      results[p] = { error: err };
      console.warn(`[snapshot] ${PROFILES[p].label}: failed (${err && err.message}) - keeping previous entry`);
    }
  }));

  const next = mergeSnapshot(previous, results);
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(next, null, 2) + '\n');
  console.log(`[snapshot] wrote data/profiles.json (${Object.keys(next.profiles).length}/${PLATFORMS.length} platforms)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('[snapshot]', err);
    process.exitCode = 1;
  });
}
