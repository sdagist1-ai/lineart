/**
 * Render a film to MP4 by seeking every frame -- no realtime capture, so no
 * dropped or duplicated frames and the output is bit-identical between runs.
 *
 *   node render.mjs <film.html> --fps 30 --size 1080 --out ../out/film.mp4
 *   node render.mjs <film.html> --from 6 --to 9        a section, with its slice of the score
 *   node render.mjs <film.html> --draft                15 fps and a fast encode, to judge pace and sync
 *   node render.mjs <film.html> --patch 19.5:21        after a local edit, redraw only that range
 *   node render.mjs <film.html> --patch                after a score-only edit: picture reused, new audio
 *   node render.mjs <film.html> --no-audio --workers 2
 *
 * seek(t) is pure in t, so several browsers draw frames at once (--workers) and the encoder takes
 * them in order. Video is encoded in 2 s segments kept in .render-cache/<name>/ beside the output,
 * with a hash of every frame: an interrupted render resumes, and --patch redraws only the segments
 * its ranges touch. A patch first redraws the middle frame of every other segment and refuses if any
 * changed (the edit was not local), then grows past its edges while their frames still differ.
 *
 * Audio is optional: if the film exposes window.__film.renderAudio() returning
 * a base64 WAV (built offline with OfflineAudioContext), it is muxed in.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { launch, openFilm, frameOf, capture, captureMode, pool, args } from './lib/browser.mjs';
import { pipeFrames, run, FFMPEG } from './lib/ffmpeg.mjs';
import { parseWav } from './lib/audio.mjs';

const a = args(process.argv.slice(2));
const film = a._[0];
if (!film) { console.error('usage: node render.mjs <film.html> [--from a --to b] [--fps 30] [--size 1080] [--draft] [--patch a:b,c:d] [--workers n] [--no-audio] [--out x.mp4]'); process.exit(1); }

const draft = Boolean(a.draft);
const fps = Number(a.fps || (draft ? 15 : 30));
const frame = frameOf(film);
const size = Number(a.size || frame.width), height = Math.round(size * frame.height / frame.width);
const engine = a.engine || 'chromium';
const workers = Math.max(1, Number(a.workers || os.availableParallelism()));
const encoder = draft ? ['-crf', '18', '-preset', 'veryfast'] : ['-crf', '16', '-preset', 'slow'];
const filmName = path.basename(path.dirname(path.resolve(film)));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const source = sha(fs.readFileSync(film));
const t0 = Date.now();

const browsers = [], errorLists = [];
const open = async browser => {
  const opened = await openFilm(browser, film, { size });
  errorLists.push(opened.errors);
  return opened;
};
const openWorker = async () => { const b = await launch(engine); browsers.push(b); return open(b); };

try {
  const first = await openWorker();
  const { duration } = first;
  const from = Number(a.from || 0);
  const to = Math.min(Number(a.to || duration), duration);
  const whole = from === 0 && to === duration;
  if (!(to > from && from >= 0)) throw Error(`--from/--to must lie within 0..${duration}`);
  const out = path.resolve(a.out || path.join('..', 'out',
    `${filmName}${whole ? '' : `.${from}-${to}`}${draft ? '.draft' : ''}.mp4`));
  const total = Math.round((to - from) * fps);
  const segFrames = Math.round(2 * fps), nSeg = Math.ceil(total / segFrames);
  const segOf = s => ({ lo: s * segFrames, hi: Math.min(total, (s + 1) * segFrames) });
  const framesOf = ss => ss.flatMap(s => { const { lo, hi } = segOf(s); return Array.from({ length: hi - lo }, (_, k) => lo + k); });
  const timeOf = f => from + f / fps;
  const span = ss => ss.map(s => `${timeOf(segOf(s).lo).toFixed(2)}-${timeOf(segOf(s).hi).toFixed(2)}s`).join(', ');
  console.log(`${filmName}: ${from}-${to}s @ ${fps}fps = ${total} frames, ${size}x${height} (${engine}${draft ? ', draft' : ''})`);

  // The score renders on its own page while the workers draw.
  const audio = a['no-audio'] ? Promise.resolve(null) : (async () => {
    const { page } = await open(browsers[0]);
    const wav = await page.evaluate(async () => window.__film.renderAudio ? window.__film.renderAudio() : null)
      .catch(e => { console.error(`  audio render failed: ${e.message}`); return null; });
    await page.close();
    return wav && Buffer.from(wav, 'base64');
  })();
  audio.catch(() => {});

  // A cache holds one film's frames for one frame grid, encoder and capture method; the source
  // hash says whether they still show the film as it is now.
  const cache = path.join(path.dirname(out), '.render-cache', path.basename(out, '.mp4'));
  const manifestPath = path.join(cache, 'manifest.json');
  await first.page.evaluate(t => window.__film.seek(t), from);
  await capture(first.page);
  const params = { film: path.resolve(film), fps, size, height, engine, from, to, total, segFrames, encoder, capture: captureMode(first.page) };
  if (params.capture !== 'canvas') console.log('  capturing by screenshot: the canvas is not exactly what the viewport shows');
  let manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
  const differs = manifest ? Object.keys(params).filter(k => JSON.stringify(manifest.params[k]) !== JSON.stringify(params[k])) : [];
  const compatible = manifest && !differs.length;
  const segFile = s => path.join(cache, `seg-${String(s).padStart(5, '0')}.mp4`);
  const done = s => { const { lo, hi } = segOf(s); return fs.existsSync(segFile(s)) && manifest.frames.slice(lo, hi).every(Boolean); };
  const save = () => { fs.writeFileSync(manifestPath + '.part', JSON.stringify(manifest)); fs.renameSync(manifestPath + '.part', manifestPath); };

  const patch = a.patch === undefined ? null : a.patch === true ? [] : String(a.patch).split(',').map(r => r.split(':').map(Number));
  if (patch) {
    if (!compatible) throw Error(`--patch needs an earlier render with these settings in ${cache}${differs.length ? ` (${differs.join(', ')} differ)` : ''}; render without --patch first`);
    if (patch.some(([lo, hi]) => !(lo < hi && lo >= from && hi <= to))) throw Error(`--patch takes ranges a:b within ${from}..${to}`);
  } else if (!compatible || manifest.source !== source) {
    if (manifest) console.log(`  ${compatible ? 'source changed since' : `${differs.join(', ')} differ from`} the cached render: drawing every segment (after a local edit, --patch a:b redraws only that range)`);
    fs.rmSync(cache, { recursive: true, force: true });
    manifest = null;
  }
  fs.mkdirSync(cache, { recursive: true });
  manifest ??= { params, source, frames: Array(total).fill(null) };
  const old = [...manifest.frames];
  const segs = Array.from({ length: nSeg }, (_, s) => s);
  let todo = segs.filter(s => !done(s) || patch?.some(([lo, hi]) => timeOf(segOf(s).lo) < hi && timeOf(segOf(s).hi) > lo));
  const checks = patch ? segs.filter(s => !todo.includes(s)).map(s => { const { lo, hi } = segOf(s); return lo + ((hi - lo) >> 1); }) : [];
  if (!patch && todo.length < nSeg) console.log(`  resuming: ${nSeg - todo.length} of ${nSeg} segments cached`);

  const jobs = Math.max(checks.length, framesOf(todo).length);
  const pages = [first.page, ...(await Promise.all(Array.from({ length: Math.min(workers, jobs) - 1 }, openWorker))).map(o => o.page)];
  const draw = async (page, f) => { await page.evaluate(t => window.__film.seek(t), timeOf(f)); return capture(page); };

  if (checks.length) {
    const changed = [];
    await pool(pages, checks, async (page, f) => { if (sha(await draw(page, f)) !== old[f]) changed.push(timeOf(f)); });
    if (changed.length) throw Error(`--patch: frames outside its range changed (t=${changed.sort((x, y) => x - y).slice(0, 6).map(t => t.toFixed(3)).join(', ')}${changed.length > 6 ? ', …' : ''}), so the edit is not local; widen --patch to cover them or render without it`);
    console.log(`  patch: ${checks.length} spot check(s) outside the range unchanged`);
  }
  manifest.source = source;

  const tDraw = Date.now(), ahead = pages.length * 8, redrawn = new Set();
  let drawn = 0;
  while (todo.length) {
    for (const s of todo) { fs.rmSync(segFile(s), { force: true }); const { lo, hi } = segOf(s); manifest.frames.fill(null, lo, hi); }
    save();
    const frames = framesOf(todo), ready = new Map(), wake = [];
    const settle = () => wake.splice(0).forEach(f => f());
    const until = cond => new Promise(res => { const check = () => (cond() ? res() : wake.push(check)); check(); });
    let written = 0;
    const writer = async () => {
      for (const s of todo) {
        const { lo, hi } = segOf(s), part = segFile(s).replace(/\.mp4$/, '.part.mp4');
        const ff = pipeFrames(['-f', 'image2pipe', '-framerate', String(fps), '-i', 'pipe:0',
          '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...encoder, '-y', part]);
        for (let f = lo; f < hi; f++) {
          await until(() => ready.has(f));
          const png = ready.get(f);
          ready.delete(f);
          manifest.frames[f] = sha(png);
          await ff.write(png);
          written++; drawn++; settle();
          if (written % 60 === 0 || written === frames.length) {
            const eta = ((Date.now() - tDraw) / drawn * (frames.length - written) / 1000).toFixed(0);
            process.stdout.write(`  frame ${written}/${frames.length} (${(written / frames.length * 100).toFixed(0)}%) eta ${eta}s\n`);
          }
        }
        await ff.end();
        fs.renameSync(part, segFile(s));
        save();
      }
    };
    await Promise.all([
      // The gate holds a page back until the writer catches up.
      pool(pages, frames, async (page, f) => { ready.set(f, await draw(page, f)); settle(); }, i => until(() => i < written + ahead)),
      writer(),
    ]);
    todo.forEach(s => redrawn.add(s));
    // A changed frame at a patch's edge means the change may run on into the next segment.
    todo = !patch ? [] : [...new Set([...redrawn].flatMap(s => {
      const { lo, hi } = segOf(s), grow = [];
      if (s > 0 && !redrawn.has(s - 1) && old[lo] && manifest.frames[lo] !== old[lo]) grow.push(s - 1);
      if (s < nSeg - 1 && !redrawn.has(s + 1) && old[hi - 1] && manifest.frames[hi - 1] !== old[hi - 1]) grow.push(s + 1);
      return grow;
    }))].sort((x, y) => x - y);
    if (todo.length) console.log(`  patch: the change reaches the range's edge; also redrawing ${span(todo)}`);
  }
  if (patch && redrawn.size) {
    const diff = framesOf([...redrawn].sort((x, y) => x - y)).filter(f => manifest.frames[f] !== old[f]);
    console.log(diff.length
      ? `  patch: ${diff.length} of ${framesOf([...redrawn]).length} redrawn frames changed, ${timeOf(diff[0]).toFixed(3)}-${timeOf(diff.at(-1)).toFixed(3)}s`
      : '  patch: no redrawn frame changed; the edit may be elsewhere (--patch with no range spot-checks the whole film)');
  }

  let wav = await audio;
  if (wav) {
    const p = whole ? out.replace(/\.mp4$/, '.wav') : path.join(cache, 'audio.wav');
    fs.writeFileSync(p, wav);
    // The mux trims a longer score and leaves a shorter one silent at the end.
    const parsed = parseWav(wav), delta = parsed.duration - duration;
    if (Math.abs(delta) > 1 / fps) console.error(`  !! audio is ${delta > 0 ? 'longer' : 'shorter'} than the film by ${Math.abs(delta).toFixed(3)}s`);
    if (parsed.rate !== 48000) console.error(`  !! audio is ${parsed.rate} Hz; the AAC mux resamples anything but 48000`);
    if (whole) console.log(`  audio -> ${p}`);
    wav = p;
  } else if (!a['no-audio']) console.log('  no window.__film.renderAudio(); rendering silent');

  // Segments join by stream copy; the score is cut to the picture's span (-shortest drops frames
  // across segment joins).
  const list = path.join(cache, 'concat.txt'), part = out.replace(/\.mp4$/, '.part.mp4');
  fs.writeFileSync(list, segs.map(s => `file '${path.basename(segFile(s))}'\n`).join(''));
  await run(['-f', 'concat', '-safe', '0', '-i', list,
    ...(wav ? ['-ss', String(from), '-t', String(total / fps), '-i', wav,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k'] : ['-c', 'copy']),
    '-movflags', '+faststart', '-y', part]);
  fs.renameSync(part, out);
  // One framecrc line per video packet, read without decoding.
  const packets = spawnSync(FFMPEG, ['-v', 'error', '-i', out, '-map', '0:v:0', '-c', 'copy', '-f', 'framecrc', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const frames = packets.stdout.split('\n').filter(l => /^\d/.test(l)).length;
  if (frames !== total) throw Error(`${out} holds ${frames} frames, expected ${total}`);
  if (wav) {
    // AAC can raise the true peak, so read the muxed file, not the WAV.
    const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
    const summary = (r.stderr || '').split(/\r?\n/).filter(l => !l.includes('TARGET') && /^\s+(I|LRA|Peak):/.test(l)).map(l => l.trim().replace(/\s+/g, ' ')).join('  ');
    if (summary) console.log(`  muxed audio: ${summary}`);
  }

  const errors = [...new Set(errorLists.flat())];
  if (errors.length) console.error(`\n!! ${errors.length} page error(s):\n - ${errors.slice(0, 10).join('\n - ')}`);
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${drawn} of ${total} frames drawn by ${pages.length} worker(s) -> ${out}`);
} catch (e) {
  console.error(`render: ${e.message}`);
  process.exitCode = 1;
} finally {
  await Promise.all(browsers.map(b => b.close()));
}
// An encoder left waiting on a failed render would keep the process alive.
process.exit();
