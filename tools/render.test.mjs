// Render regressions: parallel order, segment resume, --patch (local, growing, refused, score-only)
// and the score slice under a section; blank frames redrawn; parallel stills; a broken film fails fast. Disposable films
// under out/; Chromium only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {FFMPEG} from './lib/ffmpeg.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.resolve(here,'../out'),{recursive:true});
const temp=fs.mkdtempSync(path.resolve(here,'../out/render-test-'));
function run(args,success=true,tool='render.mjs'){
  const r=spawnSync(process.execPath,[path.join(here,tool),...args],{cwd:here,encoding:'utf8'});
  assert.equal(r.status===0,success,r.stdout+'\n'+r.stderr);return r.stdout+r.stderr;
}
// Each frame prints its own number in binary as eight bands; MARK ranges fill the lower half;
// the score is a 10 ms tone burst at each CLICK time.
const film=path.join(temp,'counter','index.html');
fs.mkdirSync(path.dirname(film));
const write=(mark,clicks)=>fs.writeFileSync(film,`<style>body{margin:0}</style><canvas width="1080" height="1080" style="width:720px;height:720px"></canvas><script>
const g=document.querySelector('canvas').getContext('2d'),MARK=${JSON.stringify(mark)},CLICKS=${JSON.stringify(clicks)},DUR=4.2;
window.__film={duration:DUR,ready:true,seek(t){const f=Math.round(t*30);g.fillStyle='#F2EDE3';g.fillRect(0,0,1080,1080);g.fillStyle='#2E3192';
for(let k=0;k<8;k++)if(f>>k&1)g.fillRect(k*135,0,135,540);if(MARK.some(([a,b])=>t>=a&&t<b))g.fillRect(0,540,1080,540);},
async renderAudio(){const sr=48000,n=Math.round(DUR*sr),dv=new DataView(new ArrayBuffer(44+n*4)),s=(o,x)=>[...x].forEach((c,i)=>dv.setUint8(o+i,c.charCodeAt(0)));
s(0,'RIFF');dv.setUint32(4,36+n*4,true);s(8,'WAVEfmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,2,true);dv.setUint32(24,sr,true);
dv.setUint32(28,sr*4,true);dv.setUint16(32,4,true);dv.setUint16(34,16,true);s(36,'data');dv.setUint32(40,n*4,true);
for(const c of CLICKS)for(let i=0;i<480;i++){const v=Math.round(16000*Math.sin(2*Math.PI*1000*i/sr)),j=Math.round(c*sr)+i;dv.setInt16(44+j*4,v,true);dv.setInt16(46+j*4,v,true);}
let b='';const u=new Uint8Array(dv.buffer);for(let i=0;i<u.length;i+=32768)b+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(b);}};
</script>`);
// Decoded frames as [frame number, marked] read back from the bands.
function frames(mp4){
  const r=spawnSync(FFMPEG,['-v','error','-i',mp4,'-vf','scale=64:64:flags=area,format=gray','-f','rawvideo','-'],{maxBuffer:1<<28});
  const out=[];for(let o=0;o<r.stdout.length;o+=4096){const px=(x,y)=>r.stdout[o+y*64+x];
    out.push([[...Array(8)].reduce((n,_,k)=>n|(px(k*8+4,16)<128)<<k,0),px(32,48)<128]);}
  return out;
}
// Onsets of the bursts in a render's audio, in seconds.
function onsets(mp4){
  const r=spawnSync(FFMPEG,['-v','error','-i',mp4,'-map','0:a','-ac','1','-ar','48000','-f','s16le','-'],{maxBuffer:1<<28});
  const pcm=new Int16Array(r.stdout.buffer,r.stdout.byteOffset,r.stdout.length>>1),out=[];
  for(let i=0;i<pcm.length;i++)if(Math.abs(pcm[i])>4000&&(!out.length||i/48000-out.at(-1)>0.1))out.push(i/48000);
  return out;
}
const near=(got,want)=>assert.ok(got.length===want.length&&got.every((t,i)=>Math.abs(t-want[i])<0.01),`onsets ${got} != ${want}`);
const mp4=path.join(temp,'counter.mp4'),cache=path.join(temp,'.render-cache','counter');
const expect=(mark)=>Array.from({length:126},(_,f)=>[f,mark.some(([a,b])=>f/30>=a&&f/30<b)]);

write([],[1,2.5,3.8]);
let log=run([film,'--out',mp4,'--workers','3']);
assert.doesNotMatch(log,/capturing by screenshot/);
assert.deepEqual(frames(mp4),expect([]),'parallel workers deliver every frame once, in order');
near(onsets(mp4),[1,2.5,3.8]);

// An interrupted render resumes from the segments it finished.
fs.rmSync(path.join(cache,'seg-00001.mp4'));
log=run([film,'--out',mp4]);
assert.match(log,/resuming: 2 of 3 segments cached/);assert.match(log,/60 of 126 frames drawn/);
assert.deepEqual(frames(mp4),expect([]));

// A local edit: only the touched segment is drawn; a change at its edge grows the patch.
write([[1.5,2.6]],[1,2.5,3.8]);
log=run([film,'--out',mp4,'--patch','2.1:2.3']);
assert.match(log,/2 spot check\(s\) outside the range unchanged/);
assert.match(log,/also redrawing 0\.00-2\.00s/);
assert.match(log,/33 of 120 redrawn frames changed, 1\.500-2\.567s/);
assert.deepEqual(frames(mp4),expect([[1.5,2.6]]));

// An edit outside the patch is refused before anything is drawn or replaced.
const before=fs.readFileSync(mp4);
write([[1.5,2.6],[0.9,1.1]],[1,2.5,3.8]);
log=run([film,'--out',mp4,'--patch','3:3.5'],false);
assert.match(log,/frames outside its range changed \(t=1\.000\)/);
assert.deepEqual(fs.readFileSync(mp4),before);

// A score-only edit: --patch alone checks every segment, draws nothing and muxes the new score.
write([[1.5,2.6]],[0.5,3]);
log=run([film,'--out',mp4,'--patch']);
assert.match(log,/3 spot check\(s\) outside the range unchanged/);assert.match(log,/0 of 126 frames drawn/);
near(onsets(mp4),[0.5,3]);

// Without --patch a changed source draws everything again.
write([],[0.5,3]);
log=run([film,'--out',mp4]);
assert.match(log,/source changed since the cached render/);assert.match(log,/126 of 126 frames drawn/);

// A section carries its own span of the score; a draft halves the frames.
const section=path.join(temp,'section.mp4');run([film,'--from','2','--to','4','--out',section]);
assert.deepEqual(frames(section).map(([f])=>f),Array.from({length:60},(_,k)=>60+k));
near(onsets(section),[1]);
const draft=path.join(temp,'draft.mp4');run([film,'--draft','--out',draft]);
assert.deepEqual(frames(draft).map(([f])=>f),Array.from({length:63},(_,k)=>2*k));
// A vertical frame renders at its own size, read back 1:1.
const tall=path.join(temp,'tall','index.html');fs.mkdirSync(path.dirname(tall));
fs.writeFileSync(tall,fs.readFileSync(film,'utf8').replace('<style>body{margin:0}</style><canvas width="1080" height="1080" style="width:720px;height:720px">',
  '<meta name="frame" content="1080x1920@405x720"><style>body{margin:0}</style><canvas width="1080" height="1920" style="width:405px;height:720px">').replace('g.fillRect(0,0,1080,1080)','g.fillRect(0,0,1080,1920)'));
const tallMp4=path.join(temp,'tall.mp4');log=run([tall,'--from','1','--to','2','--out',tallMp4]);
assert.match(log,/1080x1920/);assert.doesNotMatch(log,/capturing by screenshot/);
assert.match(spawnSync(FFMPEG,['-hide_banner','-i',tallMp4],{encoding:'utf8'}).stderr,/1080x1920/);
assert.deepEqual(frames(tallMp4).map(([f])=>f),Array.from({length:30},(_,k)=>30+k));

// A browser that drops the canvas (graphics memory on a Mac) returns blank frames: each is drawn
// again, so the render still holds every frame, in order, and says how many it redrew.
const flaky=path.join(temp,'flaky','index.html');fs.mkdirSync(path.dirname(flaky));
fs.writeFileSync(flaky,fs.readFileSync(film,'utf8').replace('seek(t){const f=Math.round(t*30);',
  'seek(t){const f=Math.round(t*30);if(f%7===3&&!(window.__seen??=new Set).has(f)){window.__seen.add(f);g.clearRect(0,0,1080,1080);return;}'));
log=run([flaky,'--workers','2','--no-audio','--out',path.join(temp,'flaky.mp4')]);
assert.match(log,/redrew 18 frame\(s\) the browser returned blank/);
assert.deepEqual(frames(path.join(temp,'flaky.mp4')),expect([]));

// Stills from several workers land at their own times.
const shots=path.join(temp,'shots'),times=[0.1,0.5,0.9,1.3,1.7,2.1,2.5,2.9,3.3,3.7,4.1,4.2];
assert.match(run([film,'--times',times.join(','),'--workers','3','--out',shots],true,'shoot.mjs'),/12 still\(s\) by 3 worker\(s\)/);
for(const t of times)assert.equal(frames(path.join(shots,`t_${t.toFixed(3).padStart(7,'0')}.png`))[0][0],Math.round(t*30));

// A film that throws before it is ready is reported in seconds, not after the 3-minute timeout.
const broken=path.join(temp,'broken','index.html');fs.mkdirSync(path.dirname(broken));
fs.writeFileSync(broken,fs.readFileSync(film,'utf8').replace('seek(t){','seek(t){{'));
const t0=Date.now();log=run([broken,'--times','1','--out',path.join(temp,'broken-shots')],false,'shoot.mjs');
assert.match(log,/film failed to load[\s\S]*SyntaxError/);assert.ok(Date.now()-t0<30000,`took ${Date.now()-t0} ms`);
console.log(`PASS: parallel order, resume, local patch grown at its edge, non-local patch refused, score-only patch, re-render on change, section score slice, draft, vertical frame, blank frames redrawn, parallel stills, broken film fails fast.\nEvidence: ${temp}`);
