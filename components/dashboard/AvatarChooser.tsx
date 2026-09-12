'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
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
 * Photo, icônes, ou initiales.
 * En menu : la grille ne s’ouvre qu’au clic. En grille : tout est visible
 * (prise en main).
 */
export default function AvatarChooser({
  initials,
  selected,
  onChange,
  disabled = false,
  onBusy,
  variante = 'menu',
}: {
  initials: string;
  selected: string | null;
  onChange: (url: string | null, opts?: { dejaEnregistre?: boolean }) => void;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
  variante?: 'menu' | 'grille';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const [ouvert, setOuvert] = useState(false);
  const listeId = useId();
  const busy = disabled || uploading;

  useEffect(() => {
    if (!ouvert) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOuvert(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [ouvert]);

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
      setOuvert(false);
    } catch {
      /* le parent annonce l’échec s’il le souhaite */
    } finally {
      setUploading(false);
      onBusy?.(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function choisir(url: string | null) {
    onChange(url);
    setOuvert(false);
  }

  const grille = (
    <div
      id={listeId}
      className={
        variante === 'menu'
          ? 'grid grid-cols-2 gap-3'
          : 'grid grid-cols-4 gap-2.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7'
      }
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
          onClick={() => choisir(selected)}
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
            onClick={() => choisir(src)}
            className={`relative aspect-square overflow-hidden rounded-full bg-[#EDEBE8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
              variante === 'menu' ? 'p-2.5' : 'p-1.5'
            }`}
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
        onClick={() => choisir(null)}
        className="flex aspect-square items-center justify-center rounded-full bg-[#E8E6E3] text-[15px] font-semibold text-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        style={selected === null ? { boxShadow: `0 0 0 2px ${ACCENT}` } : undefined}
        aria-label="Garder les initiales"
      >
        {initials}
      </button>
    </div>
  );

  if (variante === 'grille') return grille;

  const icone = Boolean(selected?.startsWith('/avatars/'));

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        disabled={busy}
        aria-expanded={ouvert}
        aria-haspopup="listbox"
        aria-controls={listeId}
        onClick={() => setOuvert((v) => !v)}
        className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-white py-1.5 pl-1.5 pr-3.5 transition-colors duration-fluid-subtle ease-soft hover:border-black/[0.16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
      >
        {selected ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selected}
            alt=""
            width={72}
            height={72}
            className={`size-[72px] shrink-0 rounded-full ${icone ? 'object-contain' : 'object-cover'}`}
            style={
              icone
                ? { backgroundColor: 'rgba(21, 32, 47, 0.06)', padding: 8 }
                : undefined
            }
          />
        ) : (
          <span
            className="inline-flex size-[72px] shrink-0 items-center justify-center rounded-full bg-black/[0.08] text-[22px] font-semibold text-ink"
            aria-hidden
          >
            {initials}
          </span>
        )}
        <span className="text-[13.5px] font-medium text-ink">
          {selected ? 'Changer d’avatar' : 'Choisir un avatar'}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 text-mute transition-transform duration-fluid-subtle ease-soft ${
            ouvert ? 'rotate-180' : ''
          }`}
        />
      </button>
      {ouvert ? (
        <div className="absolute left-0 z-20 mt-2 w-[18rem] max-h-72 overflow-y-auto rounded-xl border border-black/10 bg-white p-3 shadow-clay-sm">
          {grille}
        </div>
      ) : null}
    </div>
  );
}
