import { chromium, firefox } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

export const ENGINES = { chromium, firefox };

/**
 * Canvas 2D drawn in software in both engines. On a Mac both draw it on the GPU, and parallel
 * workers holding large canvases run graphics memory out: frames come back blank, or with an
 * earlier frame showing through. Software is also what Linux and every check here draw with.
 */
const SOFTWARE = {
  chromium: { args: ['--disable-gpu', '--disable-accelerated-2d-canvas', '--disable-gpu-compositing'] },
  firefox: { firefoxUserPrefs: { 'gfx.canvas.accelerated': false, 'layers.acceleration.disabled': true } },
};

export async function launch(engine = 'chromium') {
  const type = ENGINES[engine];
  if (!type) throw new Error(`unknown engine "${engine}" (use: ${Object.keys(ENGINES).join(', ')})`);
  try {
    return await type.launch(SOFTWARE[engine]);
  } catch (e) {
    if (/Executable doesn't exist/.test(e.message)) {
      throw new Error(`${engine} is not installed for playwright-core; run \`npm run setup\` in tools/`);
    }
    throw e;
  }
}

/**
 * A work's frame from `<meta name="frame" content="1080x1920@405x720">` near the top of its source:
 * backing store, then the CSS size its canvas is shown at. Without one, 1080 square at 720 px.
 */
export function frameOf(filmPath) {
  const fd = fs.openSync(filmPath, 'r'), head = Buffer.alloc(16384);
  const n = fs.readSync(fd, head, 0, head.length, 0);
  fs.closeSync(fd);
  const m = head.toString('utf8', 0, n).match(/<meta name="frame" content="(\d+)x(\d+)@(\d+)x(\d+)"/);
  return m ? { width: +m[1], height: +m[2], cssWidth: +m[3], cssHeight: +m[4] }
    : { width: 1080, height: 1080, cssWidth: 720, cssHeight: 720 };
}

/**
 * Open a film and wait for its bake to finish.
 * The film must expose window.__film = { duration, ready, seek(t) }.
 * `size` is the captured width; the default is the frame's own, so capture is 1:1.
 */
export async function openFilm(browser, filmPath, { size, query = '', timeout = 180000 } = {}) {
  // The film styles its canvas at its CSS size but renders a larger backing store.
  // Screenshotting at CSS size would downscale it and soften every line,
  // so scale the viewport up to capture the backing store 1:1.
  const frame = frameOf(filmPath);
  const page = await browser.newPage({
    viewport: { width: frame.cssWidth, height: frame.cssHeight },
    deviceScaleFactor: (size || frame.width) / frame.cssWidth,
  });
  const errors = [];
  let errored;
  const firstError = new Promise(res => { errored = res; });
  page.on('pageerror', e => { errors.push(String(e)); errored(); });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // A deliverable makes no network calls. Abort instead of allowing, so every tool renders
  // what an offline viewer sees and reports the request as a page error.
  await page.route(u => !/^(file|data|blob|about):/.test(u.href), r => {
    errors.push(`network request blocked: ${r.request().url()}`);
    return r.abort();
  });

  const href = url.pathToFileURL(path.resolve(filmPath)).href + (query ? '?' + query : '');
  await page.goto(href, { waitUntil: 'load' });
  // An uncaught error before ready (a syntax error, a throw while baking) usually means the film
  // never gets there. Allow 5 s for an error that is not fatal, then report it instead of waiting
  // out the timeout.
  const ready = page.waitForFunction(() => window.__film && window.__film.ready === true, null, { timeout })
    .then(() => 'ready', () => 'timeout');
  const broken = firstError.then(() => new Promise(res => setTimeout(res, 5000, 'error').unref()));
  const outcome = await Promise.race([ready, broken]);
  if (outcome !== 'ready') {
    const hint = errors.length ? `\n  page errors:\n   - ${errors.join('\n   - ')}` : '';
    throw new Error(outcome === 'error'
      ? `film failed to load: it threw before setting window.__film.ready${hint}`
      : `film never reported window.__film.ready within ${timeout}ms${hint}`);
  }

  const duration = await page.evaluate(() => window.__film.duration);
  return { page, duration, errors };
}

/**
 * Render one exact frame and return its PNG buffer. A frame read back with unpainted pixels (a
 * browser that dropped the canvas) is drawn again, up to three times in all, and counted.
 */
export async function frameAt(page, t) {
  for (let tries = 1; ; tries++) {
    await page.evaluate(time => window.__film.seek(time), t);
    try { return await capture(page); } catch (e) {
      if (!(e instanceof BlankFrame)) throw e;
      if (tries === 3) throw new Error(`t=${t}: the canvas came back with unpainted pixels 3 times: the browser dropped it (try fewer --workers), or the work leaves part of its frame unpainted`);
      redraws.push(t);
    }
  }
}
/** Times frameAt drew again because the first read came back blank. */
export const redraws = [];
export class BlankFrame extends Error {}

/**
 * PNG of what the viewport shows. Reading the canvas back costs ~80 ms against ~530 ms for a
 * screenshot, so it is used whenever it is provably the same image: the first <canvas> fills the
 * viewport 1:1 and, decoded, the screenshot matches the canvas pixel for pixel. Anything else
 * (another layer on top, a scaled capture from --size, transparency, no 2D context) screenshots.
 * Decided once per film, viewport and engine.
 */
const captureModes = new Map();
const modeKey = page => `${page.context().browser().browserType().name()} ${page.url()} ${JSON.stringify(page.viewportSize())}`;
export async function capture(page) {
  const key = modeKey(page);
  if (!captureModes.has(key)) captureModes.set(key, await canvasIsScreen(page) ? 'canvas' : 'screenshot');
  if (captureModes.get(key) === 'screenshot') return page.screenshot({ type: 'png' });
  // Read back only an opaque canvas: canvas mode was chosen on one, and every work paints its
  // paper first, so a transparent pixel means the browser lost the drawing.
  const png = await page.evaluate(() => {
    const c = document.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4 * 61) if (d[i] !== 255) return null;
    return c.toDataURL('image/png');
  });
  if (!png) throw new BlankFrame('the canvas came back with unpainted pixels');
  return Buffer.from(png.slice(png.indexOf(',') + 1), 'base64');
}

/** 'canvas' or 'screenshot': how capture() reads this page. */
export const captureMode = page => captureModes.get(modeKey(page));

async function canvasIsScreen(page) {
  const shot = (await page.screenshot({ type: 'png' })).toString('base64');
  return page.evaluate(async b64 => {
    const c = document.querySelector('canvas'), r = c?.getBoundingClientRect();
    const w = Math.round(innerWidth * devicePixelRatio), h = Math.round(innerHeight * devicePixelRatio);
    if (!c || r.left || r.top || r.width !== innerWidth || r.height !== innerHeight || c.width !== w || c.height !== h) return false;
    const g = c.getContext('2d');
    if (!g) return false;
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    if (bmp.width !== w || bmp.height !== h) return false;
    const o = new OffscreenCanvas(w, h).getContext('2d');
    o.drawImage(bmp, 0, 0);
    const a = o.getImageData(0, 0, w, h).data, b = g.getImageData(0, 0, w, h).data;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }, shot).catch(() => false);
}

/**
 * Run `work(page, item)` over `items`, each page taking the next item as it frees up. seek(t) is
 * pure, so any page can draw any frame. `gate(i)` can hold a page back before item i.
 */
export async function pool(pages, items, work, gate = async () => {}) {
  let next = 0;
  await Promise.all(pages.map(async page => {
    while (next < items.length) { const i = next++; await gate(i); await work(page, items[i]); }
  }));
}

/** Parse --range a:b:step or --times a,b,c into a sorted time list. */
export function parseTimes({ range, times }, duration) {
  if (times) return times.split(',').map(Number).filter(n => !Number.isNaN(n));
  if (range) {
    const [a, b, step = 0.25] = range.split(':').map(Number);
    const out = [];
    for (let t = a; t <= b + 1e-9; t += step) out.push(Number(t.toFixed(4)));
    return out;
  }
  const out = [];
  for (let t = 0; t < duration; t += 1) out.push(t);
  return out;
}

/** Minimal --flag value / --flag=value parser. */
export function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq > -1) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}
