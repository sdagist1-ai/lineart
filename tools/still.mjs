// Export native canvas pixels. Browser viewport/CSS scaling cannot change this PNG.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {args,launch,openFilm} from './lib/browser.mjs';
const a=args(process.argv.slice(2)),film=a._[0],t=Number(a.at??0);
if(!film||!a.out||!Number.isFinite(t)){console.error('usage: node still.mjs <index.html> --at 0 --out ../out/name.png [--engine firefox]');process.exit(1);}
const browser=await launch(a.engine||'firefox');
try {
  const {page,duration,errors}=await openFilm(browser,film);
  if(t<0||t>duration)throw Error(`--at must be within 0..${duration}`);
  const get=async()=>page.evaluate(time=>{window.__film.seek(time);const c=document.querySelector('canvas');return {url:c.toDataURL('image/png'),width:c.width,height:c.height};},t);
  const first=await get();
  await page.evaluate(d=>window.__film.seek(d*.713),duration);
  const second=await get();
  if(first.url!==second.url)throw Error('Still changes after a seek; fix determinism before delivery');
  if(errors.length)throw Error(errors.join('\n'));
  const bytes=Buffer.from(first.url.split(',')[1],'base64'),out=path.resolve(a.out);
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,bytes);
  console.log(`${first.width}x${first.height} native PNG, repeatable: ${out}\nsha256 ${crypto.createHash('sha256').update(bytes).digest('hex')}`);
} finally {await browser.close();}
