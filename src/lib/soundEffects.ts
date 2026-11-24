const SOUND_KEY = "buensoft-trivia-sound";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!isSoundEnabled()) return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
  } catch {
    // ignorar
  }
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gainVal = 0.14,
  delay = 0
) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playTick(urgent = false): void {
  playTone(urgent ? 980 : 660, urgent ? 0.09 : 0.05, urgent ? "triangle" : "sine", urgent ? 0.12 : 0.06);
}

export function playCorrect(streak = 1): void {
  const boost = Math.min(streak - 1, 5) * 35;
  playTone(523.25 + boost, 0.14, "triangle", 0.14, 0);
  playTone(659.25 + boost, 0.16, "triangle", 0.15, 0.08);
  playTone(783.99 + boost, 0.28, "triangle", 0.16, 0.16);
}

export function playWrong(): void {
  playTone(230, 0.18, "sawtooth", 0.11, 0);
  playTone(175, 0.3, "sawtooth", 0.12, 0.14);
}

export function playLifeline(): void {
  playTone(440, 0.1, "sine", 0.12, 0);
  playTone(660, 0.1, "sine", 0.13, 0.07);
  playTone(990, 0.22, "triangle", 0.14, 0.14);
}

export function playRankUp(): void {
  playTone(587.33, 0.1, "sine", 0.1, 0);
  playTone(880, 0.2, "triangle", 0.12, 0.09);
}

export function playVictory(): void {
  playTone(523.25, 0.14, "triangle", 0.14, 0);
  playTone(659.25, 0.14, "triangle", 0.14, 0.11);
  playTone(783.99, 0.16, "triangle", 0.15, 0.22);
  playTone(1046.5, 0.42, "triangle", 0.18, 0.34);
}
