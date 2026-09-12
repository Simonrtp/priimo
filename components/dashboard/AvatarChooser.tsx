'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { AVATAR_PERSONNAGES, AVATAR_PRESETS } from '@/lib/onboarding/avatars';

const ACCENT = '#E8743C';

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
 * Grille d’avatars : photo, icônes, ou initiales.
 * L’upload photo écrit déjà le profil ; `dejaEnregistre` le signale au parent.
 */
export default function AvatarChooser({
  initials,
  selected,
  onChange,
  disabled = false,
  onBusy,
}: {
  initials: string;
  selected: string | null;
  onChange: (url: string | null, opts?: { dejaEnregistre?: boolean }) => void;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const busy = disabled || uploading;

  async function onFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    onBusy?.(true);
    try {
      const blob = await compressSquare(file);
      const body = new FormData();
      body.append('file', blob, 'avatar.jpg');
      const res = await fetch('/api/dashboard/profile/avatar', { method: 'POST', body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Envoi impossible');
      onChange(data.url, { dejaEnregistre: true });
    } catch {
      /* le parent annonce l’échec s’il le souhaite */
    } finally {
      setUploading(false);
      onBusy?.(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div
      className="grid grid-cols-4 gap-2.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7"
      role="listbox"
      aria-label="Avatars"
      style={{ '--avatar-accent': ACCENT } as CSSProperties}
    >
      <button
        type="button"
        role="option"
        aria-selected={false}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex aspect-square items-center justify-center rounded-full border border-dashed border-black/20 bg-white text-[28px] font-light text-[#8A8A8A] transition-colors duration-fluid-subtle ease-soft hover:border-[color:var(--avatar-accent)] hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
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

      {selected && !AVATAR_PRESETS.includes(selected) ? (
        <button
          type="button"
          role="option"
          aria-selected
          onClick={() => onChange(selected)}
          className="relative aspect-square overflow-hidden rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ boxShadow: `0 0 0 2px ${ACCENT}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected} alt="" className="size-full object-cover" />
        </button>
      ) : null}

      {AVATAR_PERSONNAGES.map(({ id, nom, src }) => {
        const actif = selected === src;
        const dead = broken[src];
        return (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={actif}
            aria-label={nom}
            title={nom}
            disabled={busy}
            onClick={() => onChange(src)}
            className="relative aspect-square overflow-hidden rounded-full bg-[#EDEBE8] p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            style={actif ? { boxShadow: `0 0 0 2px ${ACCENT}` } : undefined}
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
                loading="lazy"
                decoding="async"
                className="size-full object-contain"
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
        disabled={busy}
        onClick={() => onChange(null)}
        className="flex aspect-square items-center justify-center rounded-full bg-[#E8E6E3] text-[15px] font-semibold text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        style={selected === null ? { boxShadow: `0 0 0 2px ${ACCENT}` } : undefined}
        aria-label="Garder les initiales"
      >
        {initials}
      </button>
    </div>
  );
}
