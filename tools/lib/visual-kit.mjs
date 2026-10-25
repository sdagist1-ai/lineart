// Pure geometry and timing. new-riso.mjs embeds this module into a self-contained HTML.
// Coordinates: world +Y up; camera depth positive forward; image +Y down. No renderer state.
const add3 = (a, b) => a.map((v, i) => v + b[i]);
const sub3 = (a, b) => a.map((v, i) => v - b[i]);
const mul3 = (a, k) => a.map(v => v * k);
const dot3 = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
const cross3 = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit3 = a => { const n = Math.hypot(...a); if (n < 1e-10) throw Error('Degenerate camera basis'); return mul3(a, 1/n); };
const bound01 = x => Math.max(0, Math.min(1, x));

/** Look-at camera; focal in image pixels. Clipping happens BEFORE perspective division. */
export function camera({eye, target, up = [0,1,0], focal = 1100, cx = 540, cy = 540, near = 1}) {
  if (!(focal > 0 && near > 0)) throw Error('focal and near must be positive');
  const forward = unit3(sub3(target, eye));
  const right = unit3(cross3(forward, up));
  const vertical = cross3(right, forward);
  const view = p => { const d = sub3(p, eye); return [dot3(d,right), dot3(d,vertical), dot3(d,forward)]; };
  const screen = p => [cx + focal*p[0]/p[2], cy - focal*p[1]/p[2]];
  const project = p => { const q = view(p); return q[2] < near ? null : screen(q); };
  function clip(points, closed) {
    const out = [], ps = points.map(view);
    if (!ps.length) return out;
    const hit = (a,b) => { const u = (near-a[2])/(b[2]-a[2]); return a.map((v,i)=>v+(b[i]-v)*u); };
    if (!closed) {
      if (ps.length !== 2) throw Error('line expects two points');
      let [a,b] = ps;
      if (a[2]<near && b[2]<near) return [];
      if (a[2]<near) a=hit(a,b);
      if (b[2]<near) b=hit(a,b);
      return [screen(a),screen(b)];
    }
    for (let i=0;i<ps.length;i++) {
      const a=ps[i], b=ps[(i+1)%ps.length], ain=a[2]>=near, bin=b[2]>=near;
      if (ain) out.push(a);
      if (ain!==bin) out.push(hit(a,b));
    }
    return out.map(screen);
  }
  return { project, view, polygon: ps => clip(ps,true), line: (a,b) => clip([a,b],false),
    depth: p => view(p)[2], focal, cx, cy, near };
}

/** A planar surface in WORLD space. Project its points; screen-space bilerp is not perspective. */
export function plane(origin, uAxis, vAxis) {
  return (u,v) => add3(origin, add3(mul3(uAxis,u),mul3(vAxis,v)));
}

/** Length table over a sampled 2D or 3D curve. Sample curved geometry densely before calling. */
export function pathByLength(points) {
  if (points.length < 2 || points.some(p=>p.length!==points[0].length || p.some(v=>!Number.isFinite(v))))
    throw Error('path needs at least two finite points of equal dimension');
  const ps = points.map(p=>p.slice()), lengths=[0];
  for (let i=1;i<ps.length;i++) lengths.push(lengths[i-1]+Math.hypot(...sub3(ps[i],ps[i-1])));
  const length=lengths.at(-1);
  if (length<=0) throw Error('path has no length');
  function sample(distance) {
    const d=Math.max(0,Math.min(length,distance));
    let lo=1, hi=lengths.length-1;
    while(lo<hi) { const mid=(lo+hi)>>1; if(lengths[mid]<d) lo=mid+1; else hi=mid; }
    while(lo<lengths.length-1 && lengths[lo]===lengths[lo-1]) lo++;
    const span=lengths[lo]-lengths[lo-1], u=span ? (d-lengths[lo-1])/span : 0;
    return {point:ps[lo-1].map((v,i)=>v+(ps[lo][i]-v)*u), index:lo, distance:d};
  }
  const prefix = d => { const s=sample(d); return [...ps.slice(0,s.index),s.point]; };
  return { length, sample, prefix };
}

/** Exactly one of speed (world units/sec) and duration (sec). Unclipped event time is explicit. */
export function travel(path, {start=0, speed, duration, ease=u=>u}) {
  if ((speed===undefined)===(duration===undefined)) throw Error('choose speed OR duration');
  const seconds=duration===undefined ? path.length/speed : duration;
  if (!(seconds>0 && Number.isFinite(seconds))) throw Error('travel duration must be positive');
  return { start, end:start+seconds, duration:seconds,
    at(t) { const u=bound01((t-start)/seconds), distance=path.length*bound01(ease(u));
      return {...path.sample(distance), u, active:t>=start&&t<start+seconds}; } };
}

/** Cubic Hermite with velocities in units/second. Neighbouring segments share endpoint velocities. */
export function hermite(a,b,va,vb,seconds,u) {
  u=bound01(u); const u2=u*u,u3=u2*u;
  return a.map((v,i)=>(2*u3-3*u2+1)*v+(u3-2*u2+u)*seconds*va[i]
    +(-2*u3+3*u2)*b[i]+(u3-u2)*seconds*vb[i]);
}

/** Analytic flight: evaluate age from event birth, never accumulate dt. */
export function ballistic(origin, velocity, acceleration, age) {
  const t=Math.max(0,age);
  return origin.map((v,i)=>v+velocity[i]*t+0.5*acceleration[i]*t*t);
}
