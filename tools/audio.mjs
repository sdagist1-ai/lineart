/**
 * Render a film's score alone and measure it -- the contact sheet for sound.
 * Seconds instead of a full frame render, so a score can be iterated on.
 *
 *   node audio.mjs <film.html>                              # WAV, report, sheet
 *   node audio.mjs <film.html> --marks 6,16,18,22.14        # visible events to check sync against
 *   node audio.mjs <film.html> --around 22.14 --window 1    # zoomed strip across one handoff
 *   node audio.mjs <film.html> --twice                      # render twice, compare bytes
 *   node audio.mjs <film.html> --ffmpeg                     # cross-check with ffmpeg ebur128
 *   node audio.mjs --wav ../out/lumen.wav --duration 28     # measure an existing WAV
 *
 * Writes out/<film>.wav (the same file render.mjs muxes), out/<film>/_audio.json
 * and out/<film>/_audio.png. Exit 1 on a contract failure: no renderAudio(),
 * length not matching the film, clipped samples, or a non-deterministic render.
 * Levels outside --target/--ceiling are warnings; a film may choose its dynamics.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { launch, openFilm, args } from './lib/browser.mjs';
import * as A from './lib/audio.mjs';

const a = args(process.argv.slice(2));
const film = a._[0];
if (!film && !a.wav) { console.error('usage: node audio.mjs <film.html> [--marks a,b] [--around t --window w] [--twice] [--ffmpeg] [--engine firefox]'); process.exit(1); }

const engine = a.engine || 'chromium';
const target = Number(a.target ?? -16), ceiling = Number(a.ceiling ?? -1);
const marks = a.marks ? String(a.marks).split(',').map(Number).filter(n => !Number.isNaN(n)) : [];
const filmName = film ? path.basename(path.dirname(path.resolve(film))) : path.basename(a.wav, '.wav');
const outDir = path.resolve(a.out || path.join('..', 'out', filmName));
fs.mkdirSync(outDir, { recursive: true });

let failures = 0;
const fail = (m) => { failures++; console.log(`  FAIL ${m}`); };
const warn = (m) => console.log(`  WARN ${m}`);
const info = (m) => console.log(`  ${m}`);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);

/* ── get the WAV ─────────────────────────────────────────────────────────── */

let wavPath, filmDuration, browser = null, hashes = [], determinism = '';
if (a.wav) {
  wavPath = path.resolve(a.wav);
  filmDuration = a.duration ? Number(a.duration) : null;
} else {
  browser = await launch(engine);
  const renderOnce = async () => {
    const { page, duration, errors } = await openFilm(browser, film, {});
    const b64 = await page.evaluate(async () => window.__film.renderAudio ? window.__film.renderAudio() : null);
    // A film may publish its visible event times as window.__film.marks; --marks overrides.
    const filmMarks = await page.evaluate(() => Array.isArray(window.__film.marks) ? window.__film.marks.map(Number) : []);
    await page.close();
    return { buf: b64 ? Buffer.from(b64, 'base64') : null, duration, errors, filmMarks };
  };
  const t0 = Date.now();
  const first = await renderOnce();
  filmDuration = first.duration;
  if (first.errors.length) warn(`${first.errors.length} page error(s): ${first.errors[0]}`);
  if (!first.buf) { fail(`${filmName} has no window.__film.renderAudio(); nothing to measure`); await browser.close(); process.exit(1); }
  console.log(`${filmName}: renderAudio() in ${((Date.now() - t0) / 1000).toFixed(1)}s (${engine}), film duration ${filmDuration}s`);
  if (!marks.length && first.filmMarks.length) { marks.push(...first.filmMarks); info(`${marks.length} marks from window.__film.marks`); }
  hashes.push(sha(first.buf));
  if (a.twice) {
    const second = await renderOnce();
    hashes.push(sha(second.buf));
    if (hashes[0] === hashes[1]) { determinism = 'byte-identical'; info(`deterministic: two cold renders byte-identical (${hashes[0]})`); }
    else {
      // Chromium sums a node's inputs in unordered-set order, so two renders of
      // one graph differ by a 16-bit LSB in a few samples. Anything bigger means
      // a synthesis path read unseeded state. Firefox renders are byte-identical.
      const x = A.parseWav(first.buf), y = A.parseWav(second.buf);
      let maxDiff = 0, n = 0;
      for (let c = 0; c < x.channels; c++) for (let i = 0; i < x.length; i++) { const d = Math.abs(x.data[c][i] - y.data[c][i]); if (d > 0) n++; if (d > maxDiff) maxDiff = d; }
      // The jitter also moves the post-render loudness gain by a hair, so a big
      // graph shows a few LSB across a few percent of samples; real unseeded
      // state shows up 40 dB louder than that.
      const lsb = 1 / 32768, share = n / (x.length * x.channels);
      if (maxDiff <= lsb * 4.5) { determinism = 'LSB jitter'; info(`deterministic to a few 16-bit LSB: ${n} samples (${(share * 100).toFixed(1)}%) differ by up to ${Math.round(maxDiff / lsb)} step(s) (${engine} summation-order jitter, inaudible); use --engine firefox for byte-identical output`); }
      else { determinism = 'NON-DETERMINISTIC'; fail(`two cold renders differ: ${n} samples (${(share * 100).toFixed(1)}%), max ${A.db(maxDiff).toFixed(1)} dBFS; a synthesis path is consuming unseeded state`); }
    }
  }
  wavPath = path.resolve(path.join('..', 'out', `${filmName}.wav`));
  fs.mkdirSync(path.dirname(wavPath), { recursive: true });
  fs.writeFileSync(wavPath, first.buf);
  info(`wav -> ${wavPath}`);
}

/* ── measure ─────────────────────────────────────────────────────────────── */

const wav = A.parseWav(fs.readFileSync(wavPath));
const chs = wav.data, rate = wav.rate;
const loud = A.loudness(chs, rate);
const tp = A.truePeak(chs, rate);
const sp = A.samplePeak(chs);
const rms200 = A.rmsWindows(chs, rate, 0.2, 0.05);
const rms1s = A.rmsWindows(chs, rate, 1, 1);
const m = A.mono(chs);
const around = a.around !== undefined ? Number(a.around) : null;
const win = Number(a.window || 1);
const range = around !== null ? [Math.max(0, around - win), Math.min(wav.duration, around + win)] : [0, wav.duration];
const spec = A.spectrogram(m, rate, { from: range[0], to: range[1], cols: 1600, rows: 240, nfft: around !== null ? 1024 : 2048 });
const full = around !== null ? A.spectrogram(m, rate, { cols: 400, rows: 32 }) : spec;   // bands always over the whole score
// --around lists every discontinuity inside its window; the whole film keeps the 12 largest.
const clicks = around !== null
  ? A.clicks(chs, rate, { keep: Infinity }).filter(c => c.t >= range[0] && c.t <= range[1])
  : A.clicks(chs, rate);
const silences = A.silences(loud.momentary);
const valleys = A.valleys(rms200);
const edges = A.edges(chs, rate);
const st = A.stereo(chs);
const dc = A.dcOffset(chs);
const allMarks = [...new Set([...marks, ...(around !== null && !marks.includes(around) ? [around] : [])])].sort((x, y) => x - y);
const markRows = allMarks.length ? A.marksReport(chs, rate, allMarks, loud) : [];

/* ── report ──────────────────────────────────────────────────────────────── */

console.log(`\n${filmName}.wav: ${wav.duration.toFixed(3)}s, ${rate} Hz, ${wav.channels} ch, ${wav.length} frames`);
if (filmDuration !== null) {
  const delta = wav.duration - filmDuration;
  if (Math.abs(delta) > 1 / 30 + 1e-6) fail(`audio is ${delta > 0 ? 'longer' : 'shorter'} than the film by ${Math.abs(delta).toFixed(3)}s; render.mjs muxes with -shortest, so the surplus is cut or the tail goes silent`);
  else info(`length matches film duration (${delta >= 0 ? '+' : ''}${(delta * 1000).toFixed(1)} ms)`);
}
if (rate !== 48000) warn(`sample rate ${rate}; the AAC mux resamples anything but 48000`);
info(`integrated ${loud.integrated.toFixed(1)} LUFS (target ${target}), range ${loud.lra.toFixed(1)} LU (${loud.lraLow.toFixed(1)}..${loud.lraHigh.toFixed(1)})`);
if (Math.abs(loud.integrated - target) > 1) warn(`integrated loudness is ${(loud.integrated - target).toFixed(1)} LU from target; scale the rendered buffer once, after render`);
info(`true peak ${tp.dbtp.toFixed(2)} dBTP at ${tp.t.toFixed(2)}s, sample peak ${A.db(sp.peak).toFixed(2)} dBFS, clipped ${sp.clipped}`);
if (sp.clipped) fail(`${sp.clipped} clipped sample(s)`);
if (tp.dbtp > ceiling) warn(`true peak above ${ceiling} dBTP; AAC reconstruction can overshoot further`);
info(`bands % sub ${full.bands.sub} low ${full.bands.low} lowmid ${full.bands.lowmid} mid ${full.bands.mid} high ${full.bands.high} air ${full.bands.air}`);
info(`stereo correlation ${st.correlation}, side/mid ${st.widthDb} dB${st.correlation > 0.98 ? ' (nearly mono)' : ''}`);
if (Math.max(...dc.map(Math.abs)) > 0.01) warn(`DC offset ${dc.map(v => v.toFixed(3)).join('/')}`);
if (edges.first10msDb > -40) warn(`starts at ${edges.first10msDb} dBFS in the first 10 ms; the opening needs a ramp from silence`);
if (edges.last10msDb > -40) warn(`ends at ${edges.last10msDb} dBFS in the last 10 ms; the tail is cut rather than released`);
if (silences.length) info(`near-silence (< -60 LUFS momentary): ${silences.map(s => `${s.from}-${s.to}s`).join(', ')}`);
if (valleys.length) info(`valleys (200 ms RMS >= 10 dB under the surrounding 4 s): ${valleys.map(v => `${v.t}s (-${v.depth})`).join(', ')}`);
if (around !== null && !clicks.length) info(`no discontinuities in ${range[0].toFixed(2)}-${range[1].toFixed(2)}s`);
if (clicks.length) info(`discontinuities: ${clicks.map(c => `${c.t.toFixed(3)}s`).join(', ')} -- fine at a designed tick, a bug at a note start or stop`);
if (markRows.length) {
  console.log('\n  mark     onset      peak       before -> after LUFS   quietest 200 ms nearby');
  const ms = (v) => v === null ? '   --  ' : String(v).padStart(5) + ' ms';
  for (const r of markRows) console.log(`  ${String(r.t).padEnd(8)} ${ms(r.onsetOffsetMs)}   ${ms(r.peakOffsetMs)}    ${String(r.beforeLufs).padStart(6)} -> ${String(r.afterLufs).padStart(6)}        ${r.quietest200msDb} dB at ${r.quietestAt}s`);
}

if (a.ffmpeg) {
  try {
    const { FFMPEG } = await import('./lib/ffmpeg.mjs');
    // ebur128 prints its summary on stderr.
    const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', wavPath, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
    const tail = (r.stderr || '').split(/\r?\n/).filter(l => !l.includes('TARGET') && /^\s+(I|LRA|Peak):/.test(l)).map(l => l.trim().replace(/\s+/g, ' ')).join('  ');
    info(`ffmpeg ebur128: ${tail || 'no summary; ' + (r.stderr || '').split(/\r?\n/).slice(-2).join(' ')}`);
  } catch (e) { warn(`ffmpeg check failed: ${e.message.split('\n')[0]}`); }
}

const report = {
  film: filmName, wav: wavPath, engine: a.wav ? null : engine, hashes, filmDuration,
  duration: wav.duration, rate, channels: wav.channels,
  integratedLufs: +loud.integrated.toFixed(2), lra: +loud.lra.toFixed(2), truePeakDbtp: +tp.dbtp.toFixed(2),
  samplePeakDbfs: +A.db(sp.peak).toFixed(2), clipped: sp.clipped, bands: full.bands, stereo: st, dc, edges,
  rmsBySecondDb: rms1s.db.map(v => +v.toFixed(1)), silences, valleys, clicks, marks: markRows, failures,
};
const jsonPath = path.join(outDir, around !== null ? `_audio_${around.toFixed(2)}.json` : '_audio.json');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');

/* ── sheet ───────────────────────────────────────────────────────────────── */

const W = 1600, cols = W;
const lane = (ch) => {
  const s0 = Math.floor(range[0] * rate), s1 = Math.ceil(range[1] * rate), per = (s1 - s0) / cols, lo = new Array(cols), hi = new Array(cols);
  for (let c = 0; c < cols; c++) {
    let mn = 1, mx = -1;
    for (let i = Math.floor(s0 + c * per), e = Math.max(i + 1, Math.floor(s0 + (c + 1) * per)); i < e && i < ch.length; i++) { if (ch[i] < mn) mn = ch[i]; if (ch[i] > mx) mx = ch[i]; }
    lo[c] = +mn.toFixed(3); hi[c] = +mx.toFixed(3);
  }
  return { lo, hi };
};
const sheetData = {
  title: `${filmName}  ·  ${wav.duration.toFixed(2)} s  ·  ${rate} Hz  ·  I ${loud.integrated.toFixed(1)} LUFS  ·  LRA ${loud.lra.toFixed(1)} LU  ·  TP ${tp.dbtp.toFixed(1)} dBTP  ·  clipped ${sp.clipped}${determinism ? '  ·  ' + determinism : ''}`,
  range, target, ceiling,
  lanes: chs.slice(0, 2).map(lane),
  spec: { img: Buffer.from(spec.img).toString('base64'), rows: spec.rows, cols: spec.cols, fmin: spec.fmin, fmax: spec.fmax },
  momentary: loud.momentary, shortTerm: loud.shortTerm,
  rms: around !== null ? A.rmsWindows(chs, rate, 0.02, 0.005) : rms200,
  marks: allMarks, silences, valleys, clicks: clicks.map(c => c.t),
  markRows,
};
const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#1b1b1b}canvas{display:block}</style>
<canvas id=c></canvas><script>const D=${JSON.stringify(sheetData)};</script><script>
const W=${W},PAD=64,H_WAVE=200,H_SPEC=${spec.rows},H_LOUD=190,H_HEAD=34,H_AXIS=28,H_TABLE=D.markRows.length?24+D.markRows.length*18:0;
const c=document.getElementById('c');c.width=W+PAD+16;c.height=H_HEAD+H_WAVE+H_SPEC+H_LOUD+H_AXIS+H_TABLE+40;
const g=c.getContext('2d');g.fillStyle='#1b1b1b';g.fillRect(0,0,c.width,c.height);
g.font='12px ui-monospace,monospace';g.fillStyle='#ddd';g.fillText(D.title,PAD,22);
const [t0,t1]=D.range,X=t=>PAD+(t-t0)/(t1-t0)*W;
let y=H_HEAD;
// waveform: L above, R below the centre line
g.fillStyle='#111';g.fillRect(PAD,y,W,H_WAVE);
D.lanes.forEach((L,i)=>{const cy=y+H_WAVE*(i+.5)/D.lanes.length,h=H_WAVE/D.lanes.length*.48;g.fillStyle=i?'#5aa0d8':'#7cc4ff';
  for(let x=0;x<L.lo.length;x++){g.fillRect(PAD+x,cy-L.hi[x]*h,1,Math.max(1,(L.hi[x]-L.lo[x])*h));}
  g.fillStyle='#333';g.fillRect(PAD,cy,W,1);});
g.fillStyle='#888';g.fillText('L',PAD-16,y+H_WAVE*.25+4);g.fillText('R',PAD-16,y+H_WAVE*.75+4);
y+=H_WAVE+6;
// spectrogram, log frequency, low at the bottom
const bin=atob(D.spec.img),img=g.createImageData(D.spec.cols,D.spec.rows);
for(let r=0;r<D.spec.rows;r++)for(let x=0;x<D.spec.cols;x++){const v=bin.charCodeAt(r*D.spec.cols+x)/255,o=((D.spec.rows-1-r)*D.spec.cols+x)*4;
  // dark -> indigo -> orange -> paper, a print-friendly ramp
  const rr=v<.5?v*2*90:90+(v-.5)*2*165,gg=v<.5?v*2*40:40+(v-.5)*2*190,bb=v<.6?v/.6*140:140+(v-.6)/.4*90;
  img.data[o]=rr;img.data[o+1]=gg;img.data[o+2]=bb;img.data[o+3]=255;}
g.putImageData(img,PAD,y);
g.fillStyle='#888';[50,100,200,500,1000,2000,5000,10000].forEach(f=>{if(f<D.spec.fmin||f>D.spec.fmax)return;const fy=y+H_SPEC-Math.log(f/D.spec.fmin)/Math.log(D.spec.fmax/D.spec.fmin)*H_SPEC;
  g.fillText(f>=1000?(f/1000)+'k':String(f),PAD-34,fy+4);g.fillStyle='#ffffff30';g.fillRect(PAD,fy,W,1);g.fillStyle='#888';});
y+=H_SPEC+6;
// loudness: momentary thin, short-term bold, rms faint; target band shaded
g.fillStyle='#111';g.fillRect(PAD,y,W,H_LOUD);const LO=-60,HI=0,Y=l=>y+(HI-Math.max(LO,Math.min(HI,l)))/(HI-LO)*H_LOUD;
g.fillStyle='#2a3a2a';g.fillRect(PAD,Y(D.target+1),W,Y(D.target-1)-Y(D.target+1));
g.fillStyle='#888';for(let l=-10;l>LO;l-=10){g.fillStyle='#ffffff18';g.fillRect(PAD,Y(l),W,1);g.fillStyle='#888';g.fillText(String(l),PAD-30,Y(l)+4);}
g.fillStyle='#ff6c2f80';g.fillRect(PAD,Y(D.ceiling),W,1);
const line=(s,col,w)=>{g.strokeStyle=col;g.lineWidth=w;g.beginPath();let first=true;for(let i=0;i<s.t.length;i++){const t=s.t[i];if(t<t0||t>t1)continue;const v=s.lufs?s.lufs[i]:s.db[i];if(first){g.moveTo(X(t),Y(v));first=false;}else g.lineTo(X(t),Y(v));}g.stroke();};
line(D.rms,'#5a5a7a',1);line(D.momentary,'#ffe800',1);line(D.shortTerm,'#ff48b0',2.2);
g.fillStyle='#ffe800';g.fillText('momentary',PAD+W-250,y+14);g.fillStyle='#ff48b0';g.fillText('short-term',PAD+W-170,y+14);g.fillStyle='#8a8aaa';g.fillText('rms',PAD+W-90,y+14);
g.fillStyle='#ff48b040';D.silences.forEach(s=>g.fillRect(X(Math.max(t0,s.from)),y,Math.max(1,X(Math.min(t1,s.to))-X(Math.max(t0,s.from))),H_LOUD));
g.fillStyle='#ff6c2f';D.valleys.forEach(v=>{if(v.t>=t0&&v.t<=t1){g.beginPath();g.moveTo(X(v.t),Y(v.db)-10);g.lineTo(X(v.t)-5,Y(v.db)-18);g.lineTo(X(v.t)+5,Y(v.db)-18);g.fill();}});
g.fillStyle='#ff4040';D.clicks.forEach(t=>{if(t>=t0&&t<=t1)g.fillRect(X(t)-1,y+H_LOUD-6,3,6);});
y+=H_LOUD+4;
// time axis and marks through every panel
const span=t1-t0,step=span>120?10:span>40?5:span>8?1:span>2?.25:.1;
g.fillStyle='#888';for(let t=Math.ceil(t0/step)*step;t<=t1+1e-9;t+=step){g.fillRect(X(t),y,1,6);g.fillText(t.toFixed(step<1?2:0),X(t)-10,y+20);}
let lastLabel=-1e9;D.marks.forEach(t=>{if(t<t0||t>t1)return;g.fillStyle='#00a95c';g.fillRect(X(t),H_HEAD,1,y-H_HEAD);if(X(t)-lastLabel>44){g.fillText(t.toFixed(2),X(t)+3,H_HEAD+12);lastLabel=X(t);}});
y+=H_AXIS;
const ms=v=>v===null?'   --   ':String(v).padStart(5)+' ms ';
if(D.markRows.length){g.fillStyle='#bbb';g.fillText('mark      onset      peak       before -> after LUFS    quietest 200 ms nearby',PAD,y+12);y+=18;
  D.markRows.forEach(r=>{g.fillText(String(r.t).padEnd(9)+ms(r.onsetOffsetMs)+'  '+ms(r.peakOffsetMs)+'     '+String(r.beforeLufs).padStart(6)+' -> '+String(r.afterLufs).padStart(6)+'          '+r.quietest200msDb+' dB at '+r.quietestAt+'s',PAD,y+12);y+=18;});}
</script>`;
const sheetHtml = path.join(outDir, '_audio.html');
fs.writeFileSync(sheetHtml, html);
if (!browser) browser = await launch('chromium');
const sp2 = await browser.newPage({ viewport: { width: W + 80, height: 400 } });
await sp2.goto('file:///' + sheetHtml.replace(/\\/g, '/'));
const pngPath = path.join(outDir, around !== null ? `_audio_${around.toFixed(2)}.png` : '_audio.png');
const cv = await sp2.$('canvas');
await cv.screenshot({ path: pngPath });
fs.unlinkSync(sheetHtml);
await browser.close();
console.log(`\n  report -> ${jsonPath}\n  sheet  -> ${pngPath}`);
if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
