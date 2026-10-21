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

function beep(ctx: AudioContext, frequency: number, start: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.12, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.start(start);
  osc.stop(start + duration);
}

export function playScanSound(ok: boolean) {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const start = ctx.currentTime;
  if (ok) {
    beep(ctx, 1760, start, 0.08);
    return;
  }
  beep(ctx, 220, start, 0.09);
  beep(ctx, 180, start + 0.11, 0.11);
}
