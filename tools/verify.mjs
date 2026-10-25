/**
 * Gate the film contract. Everything downstream assumes these hold.
 *
 *   node verify.mjs <film.html> [--times 0.3,1.8,3.0] [--engine chromium|firefox]
 *
 * Samples repeatability on consecutive and reordered seeks, and against a fresh page drawn in
 * reverse, in both browsers at once (--engine checks one while iterating; delivery needs both).
 * On failure, names what poisons the first failing time.
 * Reports cross-engine hashes; antialiasing differences are not failures.
 * This does not prove continuity, absence of time-seeded crawl, or artistic quality;
 * `review.mjs --mp4` measures stillness.
 */
import crypto from 'node:crypto';
import { launch, openFilm, frameAt, args } from './lib/browser.mjs';

const a = args(process.argv.slice(2));
const film = a._[0];
if (!film) { console.error('usage: node verify.mjs <film.html> [--times ...]'); process.exit(1); }
const explicitTimes = a.times ? a.times.split(',').map(Number) : null;
const size = a.size ? Number(a.size) : undefined;
const sum = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);

/** Hashes of `ts` drawn in order on a newly loaded page, with no state left by earlier seeks. */
async function drawFresh(browser, ts) {
  const { page } = await openFilm(browser, film, { size });
  try {
    const out = [];
    for (const t of ts) out.push(sum(await frameAt(page, t)));
    return out;
  } finally { await page.close(); }
}

/**
 * Name the cause of a failing time. Drawing t twice on a fresh page isolates state that advances
 * per seek. Drawing one candidate before t, each on its own fresh page, finds the frame whose
 * drawing changes t: a cache filled by whichever frame came first. Stops at the first culprit,
 * since each candidate costs a page load and bake.
 */
async function diagnose(browser, t, candidates) {
  const [cold, again] = await drawFresh(browser, [t, t]);
  if (again !== cold)
    return `t=${t} changes when drawn twice on a fresh page: something advances per seek (a counter, an undrawn canvas, an rng not re-seeded from its key)`;
  for (const p of candidates) {
    if (p !== t && (await drawFresh(browser, [p, t]))[1] !== cold)
      return `t=${t} changes when t=${p} is drawn first: a cache or variable written at ${p} is read at ${t}; a cache key must name everything its pixels depend on`;
  }
  return `t=${t} matches its fresh-page draw after each single candidate; the failure needs a longer seek history`;
}

/** Every check in one engine. Output is collected so the two engines can run at once. */
async function check(engine) {
  const lines = [], log = m => lines.push(m);
  let failures = 0;
  const fail = (m) => { failures++; log(`  FAIL ${m}`); };
  const browser = await launch(engine);
  const { page, duration, errors } = await openFilm(browser, film, { size });
  if (!(duration > 0 && Number.isFinite(duration))) throw Error('duration must be finite and positive');
  const shotTimes = await page.evaluate(() => (window.__film.shots || []).flatMap(s =>
    [s.start, s.readAt, s.end - 1/30]).filter(Number.isFinite));
  // Cover the actual duration: the old defaults silently stopped at 27 seconds.
  const times = explicitTimes || [...new Set([
    ...[0,.07,.2,.4,.6,.8,1].map(u => Math.min(duration-1/30, u*duration)),
    ...shotTimes,
  ].map(t => Number(Math.max(0,t).toFixed(6))))].sort((x,y)=>x-y);
  if (times.some(t => !Number.isFinite(t) || t<0 || t>duration))
    throw Error(`Inspection times must be within 0..${duration}`);
  log(`${engine}: duration ${duration}s`);
  if (errors.length) fail(`${errors.length} page error(s): ${errors[0]}`);
  // Within one page, a cache filled by the first frame drawn agrees with itself forever.
  // A new page drawn in reverse order fills it from the other end; it runs alongside.
  const reversed = [...times].reverse(), fresh = drawFresh(browser, reversed);
  fresh.catch(() => {});

  const base = {}, bad = [];
  const failAt = (t, m) => { fail(m); if (!bad.includes(t)) bad.push(t); };
  const wander = (t) => [(t + 9.3) % duration, (t + 17.1) % duration];
  for (const t of times) {
    base[t] = sum(await frameAt(page, t));
    // Consecutive repeats catch short state cycles that a whole-list repeat can alias.
    if (sum(await frameAt(page, t)) !== base[t]) failAt(t, `t=${t} not repeatable on consecutive seeks`);
  }

  for (const t of times) {                       // repeat seek
    if (sum(await frameAt(page, t)) !== base[t]) failAt(t, `t=${t} not repeatable`);
  }
  for (const t of times) {                       // cold jump after wandering
    for (const w of wander(t)) await page.evaluate(time => window.__film.seek(time), w);
    if (sum(await frameAt(page, t)) !== base[t]) failAt(t, `t=${t} depends on seek history`);
  }
  (await fresh).forEach((h, i) => { if (h !== base[reversed[i]]) failAt(reversed[i], `t=${reversed[i]} differs on a fresh page drawn in reverse order`); });
  if (bad.length) log(`  DIAGNOSIS ${await diagnose(browser, bad[0], [...times, ...wander(bad[0])])}`);
  const hashes = `  ${times.map(t => `${t}:${base[t].slice(0, 6)}`).join('  ')}`;
  if (errors.length) fail(`page error during inspection: ${errors.at(-1)}`);
  await browser.close();
  return { lines, hashes, failures, base, times };
}

const engines = a.engine ? [a.engine] : ['chromium', 'firefox'];
const results = await Promise.all(engines.map(check));
const lines = results.flatMap(r => [...r.lines, r.hashes]);
if (results.length === 2) {
  const [chromium, firefox] = results, same = firefox.times.filter(t => chromium.base[t] === firefox.base[t]).length;
  lines.splice(lines.length - 1, 0, `  cross-engine: ${same}/${firefox.times.length} frames pixel-identical to chromium`);
} else lines.push(`  checked in ${engines[0]} only; delivery needs both engines`);
console.log(lines.join('\n'));
const failures = results.reduce((n, r) => n + r.failures, 0);
console.log(failures ? `\n${failures} failure(s)` : '\nseek is pure in t; contract holds');
process.exit(failures ? 1 : 0);
