'use client';

import { useEffect, useRef } from 'react';

const BAR_COUNT = 16;
const MIN_HEIGHT = 4;
const MAX_HEIGHT = 52;

/** Nouvelle valeur poussée dans l'onde ~8 fois par seconde : le tracé défile calmement. */
const FRAMES_PER_SAMPLE = 7;
/** Interpolation vers la cible à chaque image : le déplacement reste continu. */
const EASING = 0.16;

/** Plancher de référence : un souffle de silence ne doit pas remplir les barres. */
const NOISE_FLOOR = 0.02;
/** La référence bouge doucement, sinon l'échelle sursaute à chaque syllabe. */
const REFERENCE_RISE = 0.08;
const REFERENCE_DECAY = 0.997;

/**
 * Onde vocale défilante : chaque barre garde une mesure passée et glisse vers
 * la gauche. Au repos ce sont des points ; la voix les étire en vagues.
 */
export default function VoiceWaveform({
  stream,
  compact = false,
}: {
  stream: MediaStream | null;
  compact?: boolean;
}) {
  const barCount = compact ? 12 : BAR_COUNT;
  const minHeight = compact ? 3 : MIN_HEIGHT;
  const maxHeight = compact ? 22 : MAX_HEIGHT;
  const barWidth = compact ? '3px' : '4px';
  const gap = compact ? '3px' : '5px';
  const containerClass = compact ? 'flex h-8 items-center justify-center' : 'flex h-14 items-center justify-center';
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef(0);
  const heightsRef = useRef<number[]>(Array<number>(barCount).fill(minHeight));
  const targetsRef = useRef<number[]>(Array<number>(barCount).fill(minHeight));
  const referenceRef = useRef(NOISE_FLOOR);

  useEffect(() => {
    if (!stream) return;

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.9;
    source.connect(analyser);

    const timeData = new Uint8Array(analyser.fftSize);
    const bars = barsRef.current;
    const heights = heightsRef.current;
    const targets = targetsRef.current;
    let frame = 0;

    const tick = () => {
      analyser.getByteTimeDomainData(timeData);
      let sumSquares = 0;
      for (let i = 0; i < timeData.length; i++) {
        const amp = ((timeData[i] ?? 128) - 128) / 128;
        sumSquares += amp * amp;
      }
      const rms = Math.sqrt(sumSquares / timeData.length);

      const reference =
        rms > referenceRef.current
          ? referenceRef.current + (rms - referenceRef.current) * REFERENCE_RISE
          : referenceRef.current * REFERENCE_DECAY;
      referenceRef.current = Math.max(NOISE_FLOOR, reference);

      if (frame % FRAMES_PER_SAMPLE === 0) {
        const normalized = Math.min(1, Math.sqrt(rms / referenceRef.current));
        targets.copyWithin(0, 1);
        targets[barCount - 1] = minHeight + normalized * (maxHeight - minHeight);
      }
      frame++;

      for (let i = 0; i < barCount; i++) {
        const el = bars[i];
        if (!el) continue;
        heights[i] += (targets[i] - heights[i]) * EASING;
        el.style.height = `${heights[i].toFixed(1)}px`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    void ctx.resume();
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      void ctx.close();
    };
  }, [stream, barCount, minHeight, maxHeight]);

  return (
    <div className={containerClass} style={{ gap }} aria-hidden>
      {Array.from({ length: barCount }).map((_, i) => (
        <div key={i} className="flex h-full items-center">
          <div
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            className={`rounded-full ${compact ? 'bg-accent' : 'bg-blue'}`}
            style={{ height: minHeight, width: barWidth }}
          />
        </div>
      ))}
    </div>
  );
}
