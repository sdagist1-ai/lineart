import { spawn } from 'node:child_process';
import fs from 'node:fs';
import ffmpegStatic from 'ffmpeg-static';

/** Full ffmpeg build with libx264. Playwright's bundled one is webm-only and cannot make MP4. */
function resolve() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  if (ffmpegStatic && fs.existsSync(ffmpegStatic)) return ffmpegStatic;
  throw new Error('no ffmpeg found; run `npm install` in tools/ or set FFMPEG=<path to ffmpeg>');
}

export const FFMPEG = resolve();

export function run(fnArgs) {
  return new Promise((res, rej) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', ...fnArgs], { stdio: 'inherit' });
    p.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`))));
  });
}

/** Feed PNG buffers to ffmpeg over stdin; resolves when the muxer finishes. */
export function pipeFrames(fnArgs) {
  const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', ...fnArgs], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const done = new Promise((res, rej) =>
    p.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  return {
    write: buf => new Promise(res => (p.stdin.write(buf) ? res() : p.stdin.once('drain', res))),
    end: () => { p.stdin.end(); return done; },
  };
}
