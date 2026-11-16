// NEON DRIFT — an original arcade survival shooter.
// Pilot a hover-craft on a neon grid, shoot drifters, chain combos, survive waves.
// Keyboard: WASD/arrows move, mouse aims, click/space fires, P pauses.
//
// Screenshot support: ?shot=start|play|end&seed=N renders a deterministic frame for the
// maker's screenshots. Without it the game starts normally at the title screen.

import { Audio } from './audio.js';
import { Stars } from './stars.js';
import { Nebula } from './nebula.js';

const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');
const W = cvs.width, H = cvs.height;

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const seed = Number(params.get('seed') || 1);

// deterministic RNG (xorshift) so a shot seed always builds the same frame
let s = seed >>> 0 || 1;
function rnd() { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }

const state = {
  scene: 'title', t: 0, score: 0, wave: 1, combo: 1, comboTimer: 0, lives: 3, paused: false,
  best: 0, shot: SHOT || null, shake: 0,
};
try { state.best = Number(localStorage.getItem('neondrift_best') || 0); } catch { state.best = 0; }

const player = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 15, angle: 0, fireCd: 0, inv: 0, trail: [], thrust: 0 };
let bullets = [], enemies = [], particles = [], pickups = [], floaters = [], rings = [];

const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyP' && state.scene === 'play') state.paused = !state.paused;
  if ((e.code === 'Space' || e.code === 'Enter') && state.scene !== 'play') startGame();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
const mouse = { x: W / 2, y: H / 2, down: false };
cvs.addEventListener('mousemove', (e) => {
  const b = cvs.getBoundingClientRect();
  mouse.x = (e.clientX - b.left) * (W / b.width);
  mouse.y = (e.clientY - b.top) * (H / b.height);
});
cvs.addEventListener('mousedown', () => {
  mouse.down = true;
  if (state.scene !== 'play') startGame();
});
addEventListener('mouseup', () => { mouse.down = false; });

function startGame() {
  state.scene = 'play'; state.score = 0; state.wave = 1; state.combo = 1;
  state.comboTimer = 0; state.lives = 3; state.paused = false; state.shake = 0;
  bullets = []; enemies = []; particles = []; pickups = []; floaters = []; rings = [];
  player.x = W / 2; player.y = H / 2; player.vx = 0; player.vy = 0;
  player.inv = 90; player.trail = []; player.thrust = 0;
  Audio.start();
  spawnWave();
}

// ---------- waves & enemies ----------
function spawnWave() {
  const n = 4 + Math.floor(state.wave * 1.6);
  for (let i = 0; i < n; i++) {
    const kind = state.wave >= 3 && rnd() < 0.18 ? 'weaver' : rnd() < 0.3 ? 'dart' : 'drifter';
    const a = rnd() * Math.PI * 2;
    const d = 380 + rnd() * 200;
    enemies.push(makeEnemy(W / 2 + Math.cos(a) * d, H / 2 + Math.sin(a) * d, kind, state.wave));
  }
  if (state.wave % 5 === 0) {
    const a = rnd() * Math.PI * 2;
    enemies.push(makeEnemy(W / 2 + Math.cos(a) * 450, H / 2 + Math.sin(a) * 450, 'boss', state.wave));
  }
}

function makeEnemy(x, y, kind, wave) {
  const hp = kind === 'boss' ? 18 + wave * 4 : kind === 'weaver' ? 2 : 1;
  const speed = kind === 'dart' ? 2.6 + wave * 0.1 : kind === 'boss' ? 0.9 : 1.1 + wave * 0.06;
  const r = kind === 'boss' ? 38 : kind === 'weaver' ? 12 : kind === 'dart' ? 10 : 16;
  return {
    x, y, kind, hp, maxHp: hp, r, speed, phase: rnd() * Math.PI * 2, spin: 0,
    color: kind === 'boss' ? '#ff2d55' : kind === 'weaver' ? '#c084fc' : kind === 'dart' ? '#ffd23e' : '#22f5a8',
  };
}

// ---------- effects ----------
function boom(x, y, color, n = 16) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 0.8 + Math.random() * 5;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 24 + Math.random() * 26, max: 50, color });
  }
}
function ring(x, y, color, r0 = 6, rr = 3) { rings.push({ x, y, r: r0, vr: rr, life: 26, color }); }
function float(x, y, text, color = '#fff') { floaters.push({ x, y, text, color, life: 56 }); }

Audio.init(() => ({ shoot: [760, 0.05], hit: [420, 0.06], boom: [150, 0.24], hurt: [90, 0.32], pick: [1020, 0.09] }));

// ---------- update ----------
function update() {
  state.t++;
  if (state.shake > 0) state.shake *= 0.9;
  if (state.scene !== 'play' || state.paused) return;

  const ax = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const ay = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  player.vx += ax * 0.6; player.vy += ay * 0.6;
  player.vx *= 0.92; player.vy *= 0.92;
  player.x = Math.max(player.r, Math.min(W - player.r, player.x + player.vx));
  player.y = Math.max(player.r, Math.min(H - player.r, player.y + player.vy));
  player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  player.thrust = Math.min(1, Math.hypot(player.vx, player.vy) / 6);
  player.trail.push({ x: player.x, y: player.y, life: 16 });
  if (player.trail.length > 28) player.trail.shift();
  if (player.inv > 0) player.inv--;

  player.fireCd--;
  if ((mouse.down || keys.Space) && player.fireCd <= 0) {
    player.fireCd = 8;
    const sp = 12, spread = (Math.random() - 0.5) * 0.06;
    bullets.push({
      x: player.x + Math.cos(player.angle) * 20, y: player.y + Math.sin(player.angle) * 20,
      vx: Math.cos(player.angle + spread) * sp, vy: Math.sin(player.angle + spread) * sp, life: 70,
    });
    // muzzle flash
    for (let i = 0; i < 3; i++) {
      const a = player.angle + (Math.random() - 0.5) * 0.7;
      particles.push({ x: player.x + Math.cos(player.angle) * 22, y: player.y + Math.sin(player.angle) * 22,
        vx: Math.cos(a) * 2.4, vy: Math.sin(a) * 2.4, life: 10, max: 10, color: '#8ff2ff' });
    }
    Audio.play('shoot');
  }

  if (state.comboTimer > 0) { state.comboTimer--; if (state.comboTimer === 0) state.combo = 1; }

  bullets = bullets.filter((b) => {
    b.x += b.vx; b.y += b.vy; b.life--;
    return b.life > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20;
  });

  for (const e of enemies) {
    e.phase += 0.03; e.spin += 0.01 + e.speed * 0.004;
    const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (e.kind === 'weaver') {
      e.x += (dx / d) * e.speed + Math.cos(e.phase * 3) * 2.2;
      e.y += (dy / d) * e.speed + Math.sin(e.phase * 3) * 2.2;
    } else if (e.kind === 'dart') {
      if (Math.sin(e.phase * 2) > 0.6) { e.x += (dx / d) * e.speed * 2.5; e.y += (dy / d) * e.speed * 2.5; }
    } else {
      e.x += (dx / d) * e.speed; e.y += (dy / d) * e.speed;
    }
    if (d < e.r + player.r && player.inv <= 0) {
      state.lives--; player.inv = 100; state.combo = 1; state.shake = 9;
      boom(player.x, player.y, '#38b6ff', 34); ring(player.x, player.y, '#ff2d55', 10, 5);
      Audio.play('hurt');
      if (state.lives <= 0) gameOver();
    }
  }

  for (const b of bullets) {
    for (const e of enemies) {
      if (e.hp > 0 && Math.hypot(b.x - e.x, b.y - e.y) < e.r + 4) {
        e.hp--; b.life = 0;
        boom(b.x, b.y, e.color, 5);
        Audio.play(e.hp <= 0 ? 'boom' : 'hit');
        if (e.hp <= 0) {
          state.combo = Math.min(state.combo + 1, 20);
          state.comboTimer = 190;
          const pts = (e.kind === 'boss' ? 500 : e.kind === 'weaver' ? 150 : e.kind === 'dart' ? 120 : 100) * state.combo;
          state.score += pts;
          float(e.x, e.y, '+' + pts, e.color);
          boom(e.x, e.y, e.color, e.kind === 'boss' ? 64 : 22);
          ring(e.x, e.y, e.color, e.r, e.kind === 'boss' ? 7 : 3.4);
          if (e.kind === 'boss') state.shake = 14;
          if (rnd() < 0.22) pickups.push({ x: e.x, y: e.y, kind: rnd() < 0.35 ? 'life' : 'nuke', life: 420 });
        }
        break;
      }
    }
  }
  enemies = enemies.filter((e) => e.hp > 0);

  pickups = pickups.filter((p) => {
    p.life--;
    if (Math.hypot(p.x - player.x, p.y - player.y) < player.r + 16) {
      Audio.play('pick'); ring(p.x, p.y, p.kind === 'life' ? '#22f5a8' : '#ffd23e', 8, 4);
      if (p.kind === 'life') { state.lives = Math.min(state.lives + 1, 6); float(p.x, p.y, '+LIFE', '#22f5a8'); }
      else {
        for (const e of enemies) { state.score += 60 * state.combo; boom(e.x, e.y, e.color, 12); }
        enemies = []; float(player.x, player.y - 34, 'NUKE!', '#ffd23e');
        state.shake = 12; Audio.play('boom');
      }
      return false;
    }
    return p.life > 0;
  });

  particles = particles.filter((p) => { p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; return --p.life > 0; });
  floaters = floaters.filter((f) => { f.y -= 0.7; return --f.life > 0; });
  rings = rings.filter((r) => { r.r += r.vr; r.vr *= 0.97; return --r.life > 0; });
  for (const tr of player.trail) tr.life--;

  if (enemies.length === 0) { state.wave++; spawnWave(); float(W / 2, H / 2 - 70, 'WAVE ' + state.wave, '#38b6ff'); }
}

function gameOver() {
  state.scene = 'over';
  if (state.score > state.best) {
    state.best = state.score;
    try { localStorage.setItem('neondrift_best', String(state.best)); } catch { /* storage may be blocked */ }
  }
  Audio.play('boom');
}

// ---------- draw ----------
function drawGrid() {
  const off = (state.t * 0.5) % 64;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(70,170,255,0.10)';
  ctx.beginPath();
  for (let x = -64 + off; x < W + 64; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = -64 + off; y < H + 64; y += 64) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  // horizon glow lines
  ctx.strokeStyle = 'rgba(140,90,255,0.10)';
  ctx.beginPath();
  for (let y = H * 0.55; y < H; y += 26) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}

function glowPoly(x, y, r, sides, color, rot = 0, fillAlpha = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (fillAlpha > 0) {
    ctx.fillStyle = color;
    ctx.globalAlpha = fillAlpha; ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.shadowColor = color; ctx.shadowBlur = 22;
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.restore();
}

function drawShip() {
  // engine trail
  for (const tr of player.trail) {
    if (tr.life <= 0) continue;
    ctx.globalAlpha = (tr.life / 18) * 0.22;
    ctx.fillStyle = '#2fa8ff';
    ctx.beginPath(); ctx.arc(tr.x, tr.y, 8 * (tr.life / 18), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(player.x, player.y); ctx.rotate(player.angle);
  // thruster
  const th = 10 + player.thrust * 16 + Math.random() * 5;
  const grad = ctx.createLinearGradient(-10, 0, -10 - th, 0);
  grad.addColorStop(0, 'rgba(140,240,255,0.95)');
  grad.addColorStop(1, 'rgba(60,120,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(-9, -5); ctx.lineTo(-10 - th, 0); ctx.lineTo(-9, 5); ctx.closePath(); ctx.fill();

  ctx.shadowColor = '#38b6ff'; ctx.shadowBlur = 26;
  ctx.fillStyle = 'rgba(56,182,255,0.28)';
  ctx.strokeStyle = '#8ff2ff'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(21, 0); ctx.lineTo(-13, 12); ctx.lineTo(-6, 0); ctx.lineTo(-13, -12);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // cockpit
  ctx.shadowBlur = 10; ctx.fillStyle = '#ecfbff';
  ctx.beginPath(); ctx.arc(2, 0, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;
}

function draw() {
  ctx.fillStyle = '#04050d';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  if (state.shake > 0.4) ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);

  Nebula.draw(ctx, W, H, state.t);
  Stars.draw(ctx, W, H, state.t);
  drawGrid();

  // additive pass: particles, rings, bullets
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.9;
    ctx.fillStyle = p.color;
    const sz = 2 + (p.life / p.max) * 2.5;
    ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
  }
  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life / 26) * 0.7;
    ctx.strokeStyle = r.color; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  for (const b of bullets) {
    ctx.globalAlpha = 1;
    ctx.shadowColor = '#9ef7ff'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#dffbff';
    ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // pickups
  for (const p of pickups) {
    const pulse = 1 + Math.sin(state.t * 0.15) * 0.18;
    glowPoly(p.x, p.y, 11 * pulse, p.kind === 'life' ? 4 : 3, p.kind === 'life' ? '#22f5a8' : '#ffd23e', state.t * 0.05, 0.18);
    ctx.fillStyle = '#04121b'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(p.kind === 'life' ? '+' : 'N', p.x, p.y + 4);
  }

  if (state.scene === 'play' || state.scene === 'over') {
    for (const e of enemies) {
      const sides = e.kind === 'boss' ? 6 : e.kind === 'weaver' ? 5 : e.kind === 'dart' ? 3 : 4;
      glowPoly(e.x, e.y, e.r, sides, e.color, e.spin, e.kind === 'boss' ? 0.22 : 0.14);
      // inner core
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#04050d';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (e.kind === 'boss' && e.hp < e.maxHp) {
        ctx.fillStyle = 'rgba(255,45,85,0.25)'; ctx.fillRect(e.x - 34, e.y - e.r - 16, 68, 7);
        ctx.fillStyle = '#ff2d55'; ctx.fillRect(e.x - 34, e.y - e.r - 16, 68 * (e.hp / e.maxHp), 7);
      }
    }
    if (state.scene === 'play') {
      const blink = player.inv > 0 && Math.floor(state.t / 4) % 2 === 0;
      if (!blink) drawShip();
    }
  }

  ctx.textAlign = 'center';
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life / 30);
    ctx.fillStyle = f.color; ctx.font = 'bold 17px monospace';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  drawHud();
  if (state.scene === 'title') drawTitle();
  if (state.scene === 'over') drawOver();
  if (state.paused) drawCenter('PAUSED — press P');
}

function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(8,14,28,0.72)';
  ctx.strokeStyle = 'rgba(90,180,255,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  const r = 10;
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

function drawHud() {
  if (state.scene !== 'play' && state.scene !== 'over') return;
  panel(20, 18, 250, 74);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#eaf6ff'; ctx.font = 'bold 26px monospace';
  ctx.fillText(String(state.score).padStart(6, '0'), 36, 50);
  ctx.fillStyle = '#38b6ff'; ctx.font = '13px monospace';
  ctx.fillText('SCORE  ·  WAVE ' + state.wave, 36, 74);
  if (state.combo > 1) {
    ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 20px monospace';
    ctx.shadowColor = '#ffd23e'; ctx.shadowBlur = 12;
    ctx.fillText('x' + state.combo + ' COMBO', 36, 112);
    ctx.shadowBlur = 0;
  }
  // lives
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9fb6d0'; ctx.font = '12px monospace';
  ctx.fillText('SHIPS', W - 24, 34);
  for (let i = 0; i < state.lives; i++) {
    const a = i / Math.max(1, state.lives - 1);
    const x = W - 34 - i * 26, y = 58;
    ctx.fillStyle = `rgba(${Math.round(56 + a * 120)},${Math.round(200 - a * 90)},255,0.9)`;
    ctx.beginPath(); ctx.moveTo(x + 9, y); ctx.lineTo(x - 7, y + 7); ctx.lineTo(x - 3, y); ctx.lineTo(x - 7, y - 7);
    ctx.closePath(); ctx.fill();
  }
}

function drawTitle() {
  ctx.textAlign = 'center';
  const t = state.t * 0.03;
  ctx.save();
  ctx.translate(W / 2, 200);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i === 0 ? '#38b6ff' : i === 1 ? '#c084fc' : '#22f5a8';
    ctx.globalAlpha = 0.55 - i * 0.16;
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 40;
    ctx.font = 'bold 86px monospace';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText('NEON DRIFT', Math.sin(t + i) * (i + 1) * 4, Math.cos(t * 1.3 + i) * (i + 1) * 3);
  }
  ctx.restore();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  ctx.fillStyle = '#8fa9c6'; ctx.font = '16px monospace';
  ctx.fillText('WASD / arrows to move   ·   mouse to aim   ·   click or SPACE to fire', W / 2, 285);
  ctx.fillText('chain kills fast for a COMBO   ·   grab  +  for a ship,  N  for a nuke', W / 2, 313);

  const pulse = 0.65 + Math.sin(t * 2.2) * 0.35;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#eaf6ff'; ctx.font = 'bold 26px monospace';
  ctx.shadowColor = '#38b6ff'; ctx.shadowBlur = 18;
  ctx.fillText('CLICK OR PRESS SPACE TO LAUNCH', W / 2, 400);
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;

  if (state.best > 0) {
    ctx.fillStyle = '#5e7799'; ctx.font = '14px monospace';
    ctx.fillText('BEST ' + state.best, W / 2, 448);
  }
  ctx.fillStyle = '#3f5470'; ctx.font = '12px monospace';
  ctx.fillText('an original arcade shooter', W / 2, H - 34);
}

function drawOver() {
  ctx.fillStyle = 'rgba(4,5,13,0.74)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff2d55'; ctx.shadowColor = '#ff2d55'; ctx.shadowBlur = 30;
  ctx.font = 'bold 68px monospace';
  ctx.fillText('SHIP DOWN', W / 2, 280);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#eaf6ff'; ctx.font = 'bold 34px monospace';
  ctx.fillText(String(state.score), W / 2, 350);
  ctx.fillStyle = '#38b6ff'; ctx.font = '16px monospace';
  ctx.fillText('WAVE ' + state.wave + '   ·   BEST ' + state.best, W / 2, 386);
  const pulse = 0.65 + Math.sin(state.t * 0.08) * 0.35;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#eaf6ff'; ctx.font = 'bold 22px monospace';
  ctx.fillText('CLICK OR SPACE TO FLY AGAIN', W / 2, 452);
  ctx.globalAlpha = 1;
}

function drawCenter(text) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaf6ff'; ctx.font = 'bold 34px monospace';
  ctx.fillText(text, W / 2, H / 2 - 40);
}

function loop() {
  try { update(); draw(); } catch (err) { document.title = 'ERR: ' + err.message; }
  requestAnimationFrame(loop);
}
loop();

// ---------- deterministic frames for the maker's screenshots ----------
if (SHOT === 'play') {
  startGame();
  for (let i = 0; i < 300; i++) {
    mouse.x = W / 2 + Math.cos(i * 0.045) * 260;
    mouse.y = H / 2 + Math.sin(i * 0.06) * 190;
    mouse.down = i % 22 < 14;
    keys.KeyD = i % 120 < 60; keys.KeyW = i % 90 < 45;
    update();
  }
  mouse.down = true;
  player.inv = 0; state.combo = 7; state.comboTimer = 150; state.score = 42600; state.wave = 4;
  player.x = W / 2 - 120; player.y = H / 2 + 90; player.vx = 0; player.vy = 0;
  player.angle = -0.5; player.trail = []; player.thrust = 0.7;
  // a lively frame: enemies closing in, one pick-up, fresh tracers
  enemies = [];
  const ring1 = [[-300, -150, 'drifter'], [240, -210, 'weaver'], [330, 90, 'dart'], [-210, 180, 'drifter'], [120, 240, 'weaver'], [-360, 60, 'dart']];
  for (const [dx, dy, k] of ring1) enemies.push(makeEnemy(W / 2 + dx * 1.1, H / 2 + dy, k, 4));
  enemies.push(makeEnemy(W / 2 + 60, H / 2 - 330, 'boss', 4));
  pickups.push({ x: W / 2 - 250, y: H / 2 + 230, kind: 'life', life: 400 });
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.22;
    bullets.push({ x: player.x + Math.cos(a) * (60 + i * 46), y: player.y + Math.sin(a) * (60 + i * 46), vx: 12, vy: 0, life: 60 });
  }
  boom(W / 2 + 190, H / 2 - 120, '#22f5a8', 46); ring(W / 2 + 190, H / 2 - 120, '#22f5a8', 12, 4);
  boom(W / 2 - 380, H / 2 - 260, '#ffd23e', 34); ring(W / 2 - 380, H / 2 - 260, '#ffd23e', 10, 3.5);
  boom(W / 2 + 300, H / 2 + 180, '#c084fc', 30); ring(W / 2 + 300, H / 2 + 180, '#c084fc', 9, 3);
  ring(player.x + 60, player.y - 40, '#8ff2ff', 6, 3);
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 3.4;
    particles.push({ x: player.x + Math.cos(a) * 30, y: player.y + Math.sin(a) * 30,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 26 + Math.random() * 20, max: 46, color: i % 3 ? '#38b6ff' : '#8ff2ff' });
  }
  state.paused = false;
  draw();
} else if (SHOT === 'end') {
  startGame();
  state.score = 128500; state.wave = 7; state.lives = 0;
  gameOver();
  draw();
} // 'start' shows the title screen
