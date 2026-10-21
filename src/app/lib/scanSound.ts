let audio: AudioContext | null = null;

function audioContext() {
  const Host = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Host) return null;
  if (!audio) audio = new Host();
  return audio;
}

/** Hay que llamarlo en el toque o la tecla, porque el teléfono bloquea el audio después. */
export function unlockScanSound() {
  const ctx = audioContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

function beep(ctx: AudioContext, frequency: number, start: number, duration: number, peak: number) {
  const tone = ctx.createOscillator();
  const gain = ctx.createGain();
  tone.type = 'sine';
  tone.frequency.value = frequency;
  tone.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  tone.start(start);
  tone.stop(start + duration + 0.02);
}

export function playScanSound(ok: boolean) {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const start = ctx.currentTime;
  if (ok) {
    beep(ctx, 523, start, 0.18, 0.42);
    beep(ctx, 659, start + 0.1, 0.22, 0.36);
    return;
  }
  beep(ctx, 349, start, 0.2, 0.32);
  beep(ctx, 294, start + 0.14, 0.22, 0.28);
}
