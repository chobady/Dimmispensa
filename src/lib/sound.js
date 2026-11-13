// Effetti sonori a 8 bit generati al volo (niente file audio).
let ctx = null;
let enabled = true;
try {
  enabled = localStorage.getItem('dm_sound') !== 'off';
} catch {}

export const soundOn = () => enabled;
export function setSound(on) {
  enabled = on;
  try {
    localStorage.setItem('dm_sound', on ? 'on' : 'off');
  } catch {}
}

function tone(freq, start, dur, type = 'square', vol = 0.05) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + start);
  g.gain.setValueAtTime(vol, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

const SOUNDS = {
  tap: [[660, 0, 0.05]],
  add: [[523, 0, 0.07], [784, 0.07, 0.07], [1047, 0.14, 0.12]],
  eat: [[392, 0, 0.06], [330, 0.06, 0.06], [262, 0.12, 0.1]],
  error: [[196, 0, 0.12], [147, 0.12, 0.18]],
  roll: [[440, 0, 0.04], [554, 0.05, 0.04], [659, 0.1, 0.04], [880, 0.15, 0.1]],
  open: [[330, 0, 0.05], [494, 0.05, 0.08]],
};

export function play(name) {
  if (!enabled) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    for (const [f, s, d] of SOUNDS[name] || []) tone(f, s, d);
  } catch {}
}
