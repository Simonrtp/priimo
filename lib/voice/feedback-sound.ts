/**
 * Petits repères sonores de la dictée. Synthétisés à la volée : aucun fichier à
 * charger, aucune latence au premier clic.
 */

type Blip = { frequency: number; startAt: number; duration: number };

const START_BLIPS: Blip[] = [
  { frequency: 660, startAt: 0, duration: 0.09 },
  { frequency: 880, startAt: 0.08, duration: 0.12 },
];

const STOP_BLIPS: Blip[] = [
  { frequency: 740, startAt: 0, duration: 0.09 },
  { frequency: 494, startAt: 0.08, duration: 0.14 },
];

const PEAK_GAIN = 0.07;

function play(blips: Blip[]): void {
  if (typeof window === 'undefined') return;

  const AudioCtor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;

  let ctx: AudioContext;
  try {
    ctx = new AudioCtor();
  } catch {
    return;
  }

  void ctx.resume();
  const now = ctx.currentTime;

  for (const { frequency, startAt, duration } of blips) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    const begin = now + startAt;
    const end = begin + duration;

    // Enveloppe douce : sans elle, l'oreille entend un clic à l'attaque.
    gain.gain.setValueAtTime(0, begin);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, begin + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(begin);
    oscillator.stop(end);
  }

  const total = blips.reduce((max, b) => Math.max(max, b.startAt + b.duration), 0);
  window.setTimeout(() => void ctx.close(), (total + 0.2) * 1000);
}

/** Deux notes montantes : l'enregistrement démarre. */
export function playRecordStartSound(): void {
  play(START_BLIPS);
}

/** Deux notes descendantes : l'enregistrement s'arrête. */
export function playRecordStopSound(): void {
  play(STOP_BLIPS);
}
