// NEON DRIFT background: soft nebula clouds behind the grid, drawn once per frame from
// pre-baked offscreen blobs (deterministic, no randomness per frame).
let baked = null;
export const Nebula = {
  build(w, h, seed) {
    let s = (seed >>> 0) || 3;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    baked = document.createElement('canvas');
    baked.width = w; baked.height = h;
    const bx = baked.getContext('2d');
    bx.globalCompositeOperation = 'lighter';
    const blobs = [
      [0.25, 0.3, 320, 'rgba(60,60,180,0.10)'],
      [0.75, 0.25, 280, 'rgba(150,60,200,0.08)'],
      [0.6, 0.75, 360, 'rgba(20,140,180,0.09)'],
      [0.15, 0.8, 240, 'rgba(180,80,60,0.06)'],
    ];
    for (const [fx, fy, r, color] of blobs) {
      const g = bx.createRadialGradient(fx * w, fy * h, 0, fx * w, fy * h, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      bx.fillStyle = g;
      bx.fillRect(0, 0, w, h);
    }
  },
  draw(ctx, w, h, t) {
    if (!baked) Nebula.build(w, h, 3);
    // slow drift for life
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.translate(Math.sin(t * 0.004) * 12, Math.cos(t * 0.003) * 10);
    ctx.drawImage(baked, 0, 0);
    ctx.restore();
  },
};
