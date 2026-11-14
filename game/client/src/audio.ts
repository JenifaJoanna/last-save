// Tiny WebAudio synth for game feedback (no audio files). Starts on first user gesture.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function unlockAudio(): void {
  if (ctx) { void ctx.resume(); return; }
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  } catch { ctx = null; }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number): void {
  if (!ctx || !master) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start();
}

export const sfx = {
  collect: (big = false) => { tone(big ? 520 : 880, 0.09, "triangle", 0.25, big ? 1040 : 1320); if (big) tone(780, 0.18, "sine", 0.2, 1560, 0.06); },
  dash: () => { noise(0.18, 0.35, 2400); tone(220, 0.16, "sawtooth", 0.06, 520); },
  hit: (p: number) => { noise(0.05, 0.3 + p * 0.3, 5200); noise(0.14, 0.25 + p * 0.4, 900); tone(120, 0.12, "square", 0.08 + p * 0.1, 60); tone(72, 0.18, "sine", 0.3 + p * 0.3, 38); },
  ko: () => { noise(0.08, 0.5, 6000); noise(0.5, 0.6, 600); tone(300, 0.6, "sawtooth", 0.12, 40); tone(58, 0.7, "sine", 0.5, 28); tone(880, 0.25, "triangle", 0.08, 1760, 0.12); },
  count: (go = false) => { tone(go ? 880 : 440, go ? 0.3 : 0.12, "square", 0.12); if (go) { tone(1320, 0.35, "triangle", 0.1, undefined, 0.02); tone(110, 0.4, "sine", 0.3, 55); } },
  results: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.22, "triangle", 0.18, undefined, i * 0.09)); },
  lost: () => tone(880, 1.4, "sine", 0.12, 870),
};
