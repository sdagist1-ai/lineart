/**
 * Measurement for a film's rendered score. Pure functions over Float32Array
 * channels; no dependencies. audio.mjs drives these and draws the sheet,
 * render.mjs uses parseWav to check the muxed track's length.
 *
 * Loudness follows ITU-R BS.1770-4 (K-weighting, 400 ms blocks, -70 LUFS
 * absolute and -10 LU relative gates) and EBU Tech 3342 for loudness range.
 * True peak is 4x oversampled with a windowed-sinc polyphase filter, which
 * lands within about 0.1 dB of ffmpeg's ebur128 on the films measured here.
 */

/* ── WAV ─────────────────────────────────────────────────────────────────── */

/** Parse 16-bit or 32-bit float PCM WAV into per-channel Float32Arrays. */
export function parseWav(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a RIFF/WAVE file');
  let o = 12, fmt = null, data = null;
  while (o + 8 <= dv.byteLength) {
    const id = tag(o), size = dv.getUint32(o + 4, true);
    if (id === 'fmt ') fmt = { format: dv.getUint16(o + 8, true), channels: dv.getUint16(o + 10, true), rate: dv.getUint32(o + 12, true), bits: dv.getUint16(o + 22, true) };
    if (id === 'data') { data = { at: o + 8, size: Math.min(size, dv.byteLength - o - 8) }; }
    o += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error('WAV missing fmt or data chunk');
  const bytes = fmt.bits / 8, frames = Math.floor(data.size / (bytes * fmt.channels));
  const chs = Array.from({ length: fmt.channels }, () => new Float32Array(frames));
  for (let i = 0, p = data.at; i < frames; i++) {
    for (let c = 0; c < fmt.channels; c++, p += bytes) {
      chs[c][i] = fmt.bits === 16 ? dv.getInt16(p, true) / 32768
        : fmt.bits === 32 && fmt.format === 3 ? dv.getFloat32(p, true)
        : fmt.bits === 32 ? dv.getInt32(p, true) / 2147483648
        : fmt.bits === 24 ? ((dv.getUint8(p) | (dv.getUint8(p + 1) << 8) | (dv.getInt8(p + 2) << 16)) / 8388608)
        : 0;
    }
  }
  return { rate: fmt.rate, channels: fmt.channels, length: frames, duration: frames / fmt.rate, data: chs };
}

/* ── basics ──────────────────────────────────────────────────────────────── */

export const db = (x) => 20 * Math.log10(Math.max(x, 1e-10));
export const dbPower = (p) => 10 * Math.log10(Math.max(p, 1e-20));

export function samplePeak(chs) {
  let peak = 0, at = 0, clipped = 0;
  for (const ch of chs) for (let i = 0; i < ch.length; i++) {
    const v = Math.abs(ch[i]);
    if (v > peak) { peak = v; at = i; }
    if (v >= 0.999) clipped++;
  }
  return { peak, at, clipped };
}

export function dcOffset(chs) {
  return chs.map(ch => { let s = 0; for (let i = 0; i < ch.length; i++) s += ch[i]; return s / ch.length; });
}

export function mono(chs) {
  if (chs.length === 1) return chs[0];
  const m = new Float32Array(chs[0].length);
  for (let i = 0; i < m.length; i++) { let s = 0; for (const ch of chs) s += ch[i]; m[i] = s / chs.length; }
  return m;
}

/** Windowed RMS in dBFS: { t, db } at hop spacing. */
export function rmsWindows(chs, rate, win = 0.2, hop = 0.05) {
  const w = Math.max(1, Math.round(win * rate)), h = Math.max(1, Math.round(hop * rate));
  const n = chs[0].length, out = { t: [], db: [] };
  for (let s = 0; s + w <= n; s += h) {
    let acc = 0;
    for (const ch of chs) for (let i = s; i < s + w; i++) acc += ch[i] * ch[i];
    out.t.push((s + w / 2) / rate);
    out.db.push(dbPower(acc / (w * chs.length)));
  }
  return out;
}

/* ── loudness (BS.1770) ──────────────────────────────────────────────────── */

/** K-weighting biquads for any rate; at 48 kHz these match BS.1770 Table 1 and 2. */
export function kWeighting(rate) {
  const shelf = (() => {
    const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
    const K = Math.tan(Math.PI * f0 / rate), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    const a0 = 1 + K / Q + K * K;
    return { b0: (Vh + Vb * K / Q + K * K) / a0, b1: 2 * (K * K - Vh) / a0, b2: (Vh - Vb * K / Q + K * K) / a0,
      a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0 };
  })();
  const hp = (() => {
    const f0 = 38.13547087602444, Q = 0.5003270373238773;
    const K = Math.tan(Math.PI * f0 / rate), a0 = 1 + K / Q + K * K;
    return { b0: 1, b1: -2, b2: 1, a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0 };
  })();
  return [shelf, hp];
}

export function biquad(x, c) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/**
 * Integrated, momentary (400 ms) and short-term (3 s) loudness plus loudness range.
 * Channel weights are 1 for the L/R pair this project renders.
 */
export function loudness(chs, rate) {
  const [c1, c2] = kWeighting(rate);
  const k = chs.map(ch => biquad(biquad(ch, c1), c2));
  const n = k[0].length;
  // Prefix sums of squared K-weighted samples per channel make any window O(1).
  const prefix = k.map(ch => { const p = new Float64Array(n + 1); for (let i = 0; i < n; i++) p[i + 1] = p[i] + ch[i] * ch[i]; return p; });
  const meanSquare = (a, b) => { let s = 0; for (const p of prefix) s += (p[b] - p[a]) / (b - a); return s; };
  const series = (win, hop) => {
    const w = Math.round(win * rate), h = Math.round(hop * rate), out = { t: [], lufs: [], z: [] };
    for (let s = 0; s + w <= n; s += h) {
      const z = meanSquare(s, s + w);
      out.t.push((s + w) / rate); out.z.push(z); out.lufs.push(-0.691 + dbPower(z));
    }
    return out;
  };
  const momentary = series(0.4, 0.1), shortTerm = series(3, 0.1);

  const gatedMean = (ser, relLU) => {
    const abs = ser.z.filter((_, i) => ser.lufs[i] > -70);
    if (!abs.length) return { mean: 0, threshold: -Infinity, kept: [] };
    const absMean = abs.reduce((a, b) => a + b, 0) / abs.length;
    const threshold = -0.691 + dbPower(absMean) + relLU;
    const kept = ser.z.filter((_, i) => ser.lufs[i] > -70 && ser.lufs[i] > threshold);
    const mean = kept.length ? kept.reduce((a, b) => a + b, 0) / kept.length : 0;
    return { mean, threshold, kept };
  };
  const g = gatedMean(momentary, -10);
  const integrated = g.kept.length ? -0.691 + dbPower(g.mean) : -Infinity;

  // Loudness range (EBU Tech 3342): short-term values, -20 LU relative gate, P10..P95.
  const r = gatedMean(shortTerm, -20);
  const keptLufs = shortTerm.lufs.filter((l, i) => l > -70 && l > r.threshold).sort((a, b) => a - b);
  const pct = (p) => keptLufs.length ? keptLufs[Math.min(keptLufs.length - 1, Math.floor(p * (keptLufs.length - 1) + 0.5))] : -Infinity;
  const lra = keptLufs.length ? pct(0.95) - pct(0.10) : 0;

  return { integrated, gateThreshold: g.threshold, lra, lraLow: pct(0.10), lraHigh: pct(0.95), momentary, shortTerm };
}

/** True peak in dBTP by 4x polyphase oversampling (windowed sinc, 48 taps). */
export function truePeak(chs, rate) {
  const L = 4, taps = 48, half = (taps - 1) / 2, h = new Float64Array(taps);
  for (let m = 0; m < taps; m++) {
    const x = (m - half) / L, sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * m / (taps - 1)) + 0.08 * Math.cos(4 * Math.PI * m / (taps - 1));
    h[m] = sinc * w;
  }
  const phases = Array.from({ length: L }, (_, p) => {
    const ph = []; for (let k = 0; k < taps / L; k++) ph.push(h[k * L + p]);
    const s = ph.reduce((a, b) => a + b, 0); return ph.map(v => v / s);
  });
  let peak = 0, at = 0;
  for (const ch of chs) {
    const n = ch.length, K = taps / L;
    for (let i = 0; i < n; i++) {
      for (let p = 0; p < L; p++) {
        let acc = 0;
        for (let k = 0; k < K; k++) { const j = i - k + (K >> 1); if (j >= 0 && j < n) acc += phases[p][k] * ch[j]; }
        const v = Math.abs(acc); if (v > peak) { peak = v; at = i; }
      }
    }
  }
  return { linear: peak, dbtp: db(peak), t: at / rate };
}

/* ── spectrum ────────────────────────────────────────────────────────────── */

/** In-place radix-2 FFT. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

export const BANDS = [['sub', 0, 60], ['low', 60, 250], ['lowmid', 250, 1000], ['mid', 1000, 4000], ['high', 4000, 10000], ['air', 10000, 1e9]];

/**
 * Log-frequency spectrogram over [from, to] seconds as a rows x cols Uint8Array
 * (0..255 = -dynamic..0 dB relative to the loudest cell), plus energy per band.
 */
export function spectrogram(x, rate, { from = 0, to = x.length / rate, cols = 1600, rows = 256, nfft = 2048, fmin = 30, fmax = 16000, dynamic = 80 } = {}) {
  const s0 = Math.max(0, Math.floor(from * rate)), s1 = Math.min(x.length, Math.ceil(to * rate));
  const span = Math.max(nfft, s1 - s0), hop = Math.max(1, (span - nfft) / Math.max(1, cols - 1));
  const win = new Float64Array(nfft); for (let i = 0; i < nfft; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (nfft - 1));
  const re = new Float64Array(nfft), im = new Float64Array(nfft), bins = nfft / 2;
  const binHz = rate / nfft, power = new Float64Array(cols * bins), bandSum = new Float64Array(BANDS.length);
  const bandOf = new Int8Array(bins);
  for (let b = 0; b < bins; b++) { const f = b * binHz; bandOf[b] = BANDS.findIndex(([, lo, hi]) => f >= lo && f < hi); }
  for (let c = 0; c < cols; c++) {
    const start = Math.floor(s0 + c * hop);
    for (let i = 0; i < nfft; i++) { const j = start + i; re[i] = j < s1 ? x[j] * win[i] : 0; im[i] = 0; }
    fft(re, im);
    for (let b = 0; b < bins; b++) { const p = re[b] * re[b] + im[b] * im[b]; power[c * bins + b] = p; if (bandOf[b] >= 0) bandSum[bandOf[b]] += p; }
  }
  // Rows on a log axis; each row averages the bins it spans (at least one).
  const rowLo = new Int32Array(rows), rowHi = new Int32Array(rows);
  for (let r = 0; r < rows; r++) {
    const fa = fmin * Math.pow(fmax / fmin, r / rows), fb = fmin * Math.pow(fmax / fmin, (r + 1) / rows);
    rowLo[r] = Math.max(1, Math.floor(fa / binHz)); rowHi[r] = Math.max(rowLo[r] + 1, Math.ceil(fb / binHz));
  }
  const cell = new Float64Array(rows * cols); let max = 1e-20;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    let acc = 0, k = 0;
    for (let b = rowLo[r]; b < rowHi[r] && b < bins; b++, k++) acc += power[c * bins + b];
    const v = acc / Math.max(1, k); cell[r * cols + c] = v; if (v > max) max = v;
  }
  const img = new Uint8Array(rows * cols);
  for (let i = 0; i < img.length; i++) img[i] = Math.round(Math.max(0, Math.min(1, 1 + dbPower(cell[i] / max) / dynamic)) * 255);
  const total = bandSum.reduce((a, b) => a + b, 0) || 1;
  const bands = {}; BANDS.forEach(([name], i) => { bands[name] = +(100 * bandSum[i] / total).toFixed(2); });
  return { img, rows, cols, fmin, fmax, from: s0 / rate, to: s1 / rate, bands };
}

/* ── events ──────────────────────────────────────────────────────────────── */

/** Sample-to-sample jumps large against the local level: candidate clicks. */
export function clicks(chs, rate, { minJump = 0.12, ratio = 6, local = 0.02, keep = 12 } = {}) {
  const w = Math.round(local * rate), found = [];
  chs.forEach((ch, c) => {
    let acc = 0; for (let i = 0; i < Math.min(w, ch.length); i++) acc += ch[i] * ch[i];
    for (let i = 1; i < ch.length; i++) {
      if (i >= w) { acc += ch[i] * ch[i] - ch[i - w] * ch[i - w]; }
      const rms = Math.sqrt(Math.max(acc, 0) / w), jump = Math.abs(ch[i] - ch[i - 1]);
      if (jump > minJump && jump > ratio * rms) found.push({ t: i / rate, ch: c, jump: +jump.toFixed(3) });
    }
  });
  found.sort((a, b) => b.jump - a.jump);
  const out = [];
  for (const f of found) { if (!out.some(o => Math.abs(o.t - f.t) < 0.005)) out.push(f); if (out.length >= keep) break; }
  return out.sort((a, b) => a.t - b.t);
}

/** Spans where momentary loudness stays under `threshold` LUFS for at least `minDur` s. */
export function silences(momentary, { threshold = -60, minDur = 0.4 } = {}) {
  const out = []; let start = null;
  for (let i = 0; i <= momentary.t.length; i++) {
    const quiet = i < momentary.t.length && momentary.lufs[i] < threshold;
    if (quiet && start === null) start = momentary.t[i] - 0.4;
    if (!quiet && start !== null) { const end = momentary.t[i - 1]; if (end - start >= minDur) out.push({ from: +start.toFixed(2), to: +end.toFixed(2) }); start = null; }
  }
  return out;
}

/** Local minima of a short-window RMS series that sit far below their surroundings. */
export function valleys(rms, { depthDb = 10, span = 2, keep = 10 } = {}) {
  const out = [], hop = rms.t.length > 1 ? rms.t[1] - rms.t[0] : 1, k = Math.round(span / hop);
  for (let i = 1; i < rms.db.length - 1; i++) {
    if (!(rms.db[i] <= rms.db[i - 1] && rms.db[i] <= rms.db[i + 1])) continue;
    const around = [];
    for (let j = Math.max(0, i - k); j <= Math.min(rms.db.length - 1, i + k); j++) if (Math.abs(j - i) > 2) around.push(rms.db[j]);
    around.sort((a, b) => a - b);
    const median = around[around.length >> 1], depth = median - rms.db[i];
    if (depth >= depthDb) out.push({ t: +rms.t[i].toFixed(2), db: +rms.db[i].toFixed(1), depth: +depth.toFixed(1) });
  }
  out.sort((a, b) => b.depth - a.depth);
  const kept = [];
  for (const v of out) { if (!kept.some(o => Math.abs(o.t - v.t) < span / 2)) kept.push(v); if (kept.length >= keep) break; }
  return kept.sort((a, b) => a.t - b.t);
}

/**
 * For each mark (a visible event's time): where the onset lands (the steepest
 * rise in 20 ms RMS, which is what fuses with the picture), where the energy
 * peak lands (later when a swell or a room builds), how loudness changes across
 * it, and the quietest 200 ms nearby.
 */
export function marksReport(chs, rate, marks, loud) {
  const fine = rmsWindows(chs, rate, 0.02, 0.005), coarse = rmsWindows(chs, rate, 0.2, 0.02);
  const nearest = (ser, t) => { let b = 0; for (let i = 1; i < ser.t.length; i++) if (Math.abs(ser.t[i] - t) < Math.abs(ser.t[b] - t)) b = i; return b; };
  const meanLufs = (a, b) => { const v = loud.momentary.lufs.filter((_, i) => loud.momentary.t[i] > a && loud.momentary.t[i] <= b); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : -Infinity; };
  return marks.map(m => {
    let best = -1, bestDb = -Infinity, onset = -1, rise = 0;
    for (let i = 2; i < fine.t.length; i++) {
      if (Math.abs(fine.t[i] - m) > 0.3) continue;
      if (fine.db[i] > bestDb) { bestDb = fine.db[i]; best = i; }
      const d = fine.db[i] - fine.db[i - 2];                       // rise over 10 ms
      if (d > rise && d > 3) { rise = d; onset = i - 1; }
    }
    let lo = nearest(coarse, m), loDb = Infinity;
    for (let i = 0; i < coarse.t.length; i++) if (Math.abs(coarse.t[i] - m) <= 0.5 && coarse.db[i] < loDb) { loDb = coarse.db[i]; lo = i; }
    return {
      t: m,
      onsetOffsetMs: onset >= 0 ? Math.round((fine.t[onset] - m) * 1000) : null,
      peakOffsetMs: best >= 0 ? Math.round((fine.t[best] - m) * 1000) : null,
      peakDb: best >= 0 ? +bestDb.toFixed(1) : null,
      beforeLufs: +meanLufs(m - 1, m).toFixed(1),
      afterLufs: +meanLufs(m, m + 1).toFixed(1),
      quietest200msDb: +loDb.toFixed(1),
      quietestAt: +coarse.t[lo].toFixed(2),
    };
  });
}

export function stereo(chs) {
  if (chs.length < 2) return { correlation: 1, widthDb: -Infinity };
  const [l, r] = chs; let ll = 0, rr = 0, lr = 0, mid = 0, side = 0;
  for (let i = 0; i < l.length; i++) {
    ll += l[i] * l[i]; rr += r[i] * r[i]; lr += l[i] * r[i];
    const m = (l[i] + r[i]) / 2, s = (l[i] - r[i]) / 2; mid += m * m; side += s * s;
  }
  return { correlation: +(lr / Math.sqrt(ll * rr || 1)).toFixed(3), widthDb: +(dbPower(side / (mid || 1))).toFixed(1) };
}

/** Level at the very start and end, where a click or a truncated tail would show. */
export function edges(chs, rate) {
  const ms = (a, b) => { let acc = 0, k = 0; for (const ch of chs) for (let i = a; i < b && i < ch.length; i++, k++) acc += ch[i] * ch[i]; return dbPower(acc / Math.max(1, k)); };
  const n = chs[0].length, w = Math.round(0.01 * rate);
  return {
    firstSample: +Math.max(...chs.map(c => Math.abs(c[0]))).toFixed(4),
    first10msDb: +ms(0, w).toFixed(1),
    last10msDb: +ms(n - w, n).toFixed(1),
    lastSample: +Math.max(...chs.map(c => Math.abs(c[n - 1]))).toFixed(4),
  };
}
