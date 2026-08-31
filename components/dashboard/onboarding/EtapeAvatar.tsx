'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { AVATAR_PRESETS } from '@/lib/onboarding/parcours';
import OnboardingShell, { ONB_ACCENT, OnboardingPrimaryButton } from './OnboardingShell';

async function compressSquare(file: File, size = 384): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression impossible'))),
      'image/jpeg',
      0.85,
    );
  });
}

/**
 * Écran 4 — avatar. Photo (crop carré) ou illustrations /avatars/avatar-01…12.
 */
export default function EtapeAvatar({
  rang,
  total,
  initials,
  initialUrl,
  onSuivant,
}: {
  rang: number;
  total: number;
  initials: string;
  initialUrl: string | null;
  onSuivant: (avatarUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  async function onFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const blob = await compressSquare(file);
      const body = new FormData();
      body.append('file', blob, 'avatar.jpg');
      const res = await fetch('/api/dashboard/profile/avatar', { method: 'POST', body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Envoi impossible');
      setSelected(data.url);
    } catch {
      /* toast optionnel — on garde le choix précédent */
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <OnboardingShell
      rang={rang}
      total={total}
      titre="Choisissez votre avatar."
      compact
      action={
        <OnboardingPrimaryButton
          disabled={uploading}
          onClick={() => onSuivant(selected)}
        >
          Continuer
        </OnboardingPrimaryButton>
      }
    >
      <div
        className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label="Avatars"
      >
        <button
          type="button"
          role="option"
          aria-selected={false}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex size-[72px] shrink-0 items-center justify-center rounded-full border border-dashed border-black/20 bg-white text-[28px] font-light text-[#8A8A8A] transition hover:border-[color:var(--onb-accent)] hover:text-[#E8743C]"
          style={{ '--onb-accent': ONB_ACCENT } as CSSProperties}
          aria-label="Ajouter une photo"
        >
          +
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />

        {/* Aperçu upload / sélection courante si URL custom */}
        {selected && !AVATAR_PRESETS.includes(selected) ? (
          <button
            type="button"
            role="option"
            aria-selected
            onClick={() => setSelected(selected)}
            className="relative size-[72px] shrink-0 overflow-hidden rounded-full"
            style={{ boxShadow: `0 0 0 2px ${ONB_ACCENT}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected} alt="" className="size-full object-cover" />
          </button>
        ) : null}

        {AVATAR_PRESETS.map((src) => {
          const actif = selected === src;
          const dead = broken[src];
          return (
            <button
              key={src}
              type="button"
              role="option"
              aria-selected={actif}
              onClick={() => setSelected(src)}
              className="relative size-[72px] shrink-0 overflow-hidden rounded-full bg-[#EDEBE8]"
              style={actif ? { boxShadow: `0 0 0 2px ${ONB_ACCENT}` } : undefined}
            >
              {dead ? (
                <span className="flex size-full items-center justify-center text-[13px] font-semibold text-[#6B6B6B]">
                  {initials}
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  className="size-full object-cover"
                  onError={() => setBroken((b) => ({ ...b, [src]: true }))}
                />
              )}
            </button>
          );
        })}

        <button
          type="button"
          role="option"
          aria-selected={selected === null}
          onClick={() => setSelected(null)}
          className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-[#E8E6E3] text-[15px] font-semibold text-[#1A1A1A]"
          style={selected === null ? { boxShadow: `0 0 0 2px ${ONB_ACCENT}` } : undefined}
          aria-label="Garder les initiales"
        >
          {initials}
        </button>
      </div>
      <p className="mt-3 text-[12.5px] text-[#8A8A8A]">
        Sans choix, vos initiales restent affichées partout.
      </p>
    </OnboardingShell>
  );
}
