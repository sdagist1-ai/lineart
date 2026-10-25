/**
 * Shoot stills from a film at exact times, and optionally compose a contact sheet.
 *
 *   node shoot.mjs <film.html> --times 0.3,1.8,3.0
 *   node shoot.mjs <film.html> --range 13.4:14.4:0.25 --sheet
 *   node shoot.mjs <film.html> --around 6.0 --window 0.5 --step 0.25 --sheet
 *   node shoot.mjs <film.html> --engine firefox --size 1080 --workers 4
 *
 * Times come from window.__film.seek(t), so a still is the exact frame the
 * renderer produces at t -- not a realtime sample that may have drifted.
 * Several browsers shoot at once: one per core (--workers), at most one per four stills.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, openFilm, frameOf, frameAt, parseTimes, pool, args } from './lib/browser.mjs';

const a = args(process.argv.slice(2));
const film = a._[0];
if (!film) { console.error('usage: node shoot.mjs <film.html> [--times|--range|--around] [--sheet]'); process.exit(1); }

const frame = frameOf(film), size = Number(a.size || frame.width);
const engine = a.engine || 'chromium';
const outDir = path.resolve(a.out || path.join('..', 'out', path.basename(path.dirname(path.resolve(film)))));
fs.mkdirSync(outDir, { recursive: true });

const opts = { size, query: a.query || '' };
const browser = await launch(engine), browsers = [browser];
const { page, duration, errors: firstErrors } = await openFilm(browser, film, opts);
const errorLists = [firstErrors];

let times;
if (a.around !== undefined) {
  const c = Number(a.around), w = Number(a.window || 0.5), s = Number(a.step || 0.25);
  times = parseTimes({ range: `${(c - w).toFixed(4)}:${(c + w).toFixed(4)}:${s}` }, duration);
} else {
  times = parseTimes(a, duration);
}
times = times.filter(t => t >= 0 && t <= duration);

// Below four stills a page per still costs more to open than it saves.
const workers = Math.min(Number(a.workers || os.availableParallelism()), Math.ceil(times.length / 4));
const pages = [page, ...await Promise.all(Array.from({ length: workers - 1 }, async () => {
  const b = await launch(engine);
  browsers.push(b);
  const opened = await openFilm(b, film, opts);
  errorLists.push(opened.errors);
  return opened.page;
}))];
const shots = times.map(t => ({ t, name: `t_${t.toFixed(3).padStart(7, '0')}.png` }));
await pool(pages, shots, async (p, s) => {
  fs.writeFileSync(path.join(outDir, s.name), await frameAt(p, s.t));
  process.stdout.write(`  ${s.name}\n`);
});

if (a.sheet && shots.length) {
  const cols = Number(a.cols || Math.min(8, Math.ceil(Math.sqrt(shots.length))));
  const cell = Number(a.cell || 220), cellH = Math.round(cell * frame.height / frame.width);
  const rows = Math.ceil(shots.length / cols);
  const html = `<!doctype html><meta charset=utf-8><style>
    body{margin:0;background:#1b1b1b;font:11px ui-monospace,monospace;color:#bbb}
    .g{display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:6px;padding:6px}
    figure{margin:0}img{width:${cell}px;height:${cellH}px;display:block;background:#000}
    figcaption{text-align:center;padding:2px 0}</style>
    <div class=g>${shots.map(s =>
      `<figure><img src="${s.name}"><figcaption>${s.t.toFixed(2)}s</figcaption></figure>`).join('')}</div>`;
  const sheetHtml = path.join(outDir, '_sheet.html');
  fs.writeFileSync(sheetHtml, html);
  const sp = await browser.newPage({
    viewport: { width: cols * (cell + 6) + 6, height: rows * (cellH + 22) + 6 },
  });
  await sp.goto(pathToFileURL(sheetHtml).href, { waitUntil: 'load' });
  const sheetPath = path.join(outDir, a.sheetName || 'sheet.png');
  await sp.screenshot({ path: sheetPath, fullPage: true });
  console.log(`sheet -> ${sheetPath}`);
}

const errors = [...new Set(errorLists.flat())];
if (errors.length) console.error(`\n!! ${errors.length} page error(s):\n - ${errors.slice(0, 10).join('\n - ')}`);
console.log(`${shots.length} still(s) by ${pages.length} worker(s) -> ${outDir}`);
await Promise.all(browsers.map(b => b.close()));
