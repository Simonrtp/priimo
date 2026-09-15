import { MapPin } from 'lucide-react';
import { ancrageParcelle } from '@/lib/notes/rattachement';

/**
 * Bandeau de rattachement : la note n'est pas dans le vide.
 * Même bloc à l'écriture et juste après la dictée.
 */
export default function NoteAncrage({
  parcelleId,
  adresse,
}: {
  parcelleId?: string | null;
  adresse?: string | null;
}) {
  const ancrage = ancrageParcelle(parcelleId, adresse);
  const titre = ancrage?.titre ?? (adresse ?? '').trim();
  if (!titre) return null;

  return (
    <div className="flex items-start gap-2.5 rounded-clay bg-bg-subtle px-3.5 py-3">
      <MapPin size={16} strokeWidth={2} className="mt-[3px] shrink-0 text-text-muted" aria-hidden />
      <div className="min-w-0">
        <p className="font-medium text-text-muted" style={{ fontSize: 12 }}>
          Note rattachée à
        </p>
        <p className="mt-0.5 truncate text-[13.5px] font-medium text-text-strong">{titre}</p>
        {ancrage?.detail ? (
          <p className="mt-0.5 truncate text-[12px] tabular-nums text-text-subtle">{ancrage.detail}</p>
        ) : null}
      </div>
    </div>
  );
}
