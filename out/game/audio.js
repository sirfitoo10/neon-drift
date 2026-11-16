// NEON DRIFT audio: tiny WebAudio blips, initialized lazily on first user gesture.
// tones: name -> [frequency, duration seconds]

let ctxA = null;
let tones = {};
let started = false;

export const Audio = {
  init(map) { tones = map(); },
  start() {
    if (started) return;
    try {
      ctxA = new (window.AudioContext || window.webkitAudioContext)();
      started = true;
    } catch { /* audio unavailable: the game plays silently */ }
  },
  play(name) {
    if (!started || !ctxA) return;
    const t = tones[name];
    if (!t) return;
    const [freq, dur] = t;
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(freq, ctxA.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), ctxA.currentTime + dur);
    g.gain.setValueAtTime(0.06, ctxA.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + dur);
    o.connect(g).connect(ctxA.destination);
    o.start();
    o.stop(ctxA.currentTime + dur);
  },
};
