// NEON DRIFT background: a slow parallax starfield, deterministic per seed.
const stars = [];
export const Stars = {
  build(w, h, n, seed) {
    let s = seed >>> 0 || 7;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    stars.length = 0;
    for (let i = 0; i < n; i++) stars.push({ x: rnd() * w, y: rnd() * h, z: rnd(), tw: rnd() * Math.PI * 2 });
  },
  draw(ctx, w, h, t) {
    if (!stars.length) Stars.build(w, h, 90, 7);
    for (const st of stars) {
      const a = 0.25 + st.z * 0.5 + Math.sin(t * 0.02 + st.tw) * 0.15;
      ctx.globalAlpha = Math.max(0.05, a);
      ctx.fillStyle = st.z > 0.8 ? '#bfe3ff' : '#8ea6c9';
      const sz = 1 + st.z * 1.6;
      ctx.fillRect(st.x, st.y, sz, sz);
    }
    ctx.globalAlpha = 1;
  },
};
