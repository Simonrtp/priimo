'use client';

import { useRef, useState } from 'react';
import { Building, ImagePlus, Mail, Phone } from 'lucide-react';
import type { Bien } from '@/types/bien';
import { MANDAT_STATUT_LABELS } from '@/types/bien';
import { notifyError, notifySuccess } from '@/lib/notify';
import { normalizePhotoUrls } from '@/lib/bien-input';
import { bienToInput } from '@/lib/import/biens';
import { BIEN_PHOTO_MAX_COUNT, uploadBienPhotoFile } from '@/lib/bien-photos';
import { FacadeStreetView } from '@/components/dashboard/FacadeLead';
import ActionMenu from '@/components/dashboard/workspace/ActionMenu';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
import { formatPhoneDisplay, telHref } from '@/lib/import/normalize';

function euros(v: number | null): string | null {
  return v === null ? null : `${new Intl.NumberFormat('fr-FR').format(v)} €`;
}

function Cover({ bien }: { bien: Bien }) {
  const cover = bien.photos[0];
  if (cover) {
    return (
      <img
        src={cover}
        alt=""
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
      />
    );
  }
  if (bien.latitude != null && bien.longitude != null) {
    return (
      <FacadeStreetView
        latitude={bien.latitude}
        longitude={bien.longitude}
        format="liste"
        lazy
        className="size-full rounded-none"
      />
    );
  }
  return (
    <div className="flex size-full items-center justify-center bg-[#EFEBE3]" aria-hidden>
      <Building size={28} strokeWidth={1.6} className="text-[#9CA3AF]" />
    </div>
  );
}

export default function BienListCard({
  bien,
  onEdit,
  onExport,
  onDelete,
  onUpdated,
  onViewPhotos,
}: {
  bien: Bien;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
  onUpdated: (bien: Bien) => void;
  onViewPhotos: (index: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const details = [
    bien.propertyType,
    bien.surfaceM2 ? `${bien.surfaceM2} m²` : null,
    bien.rooms ? `${bien.rooms} pièces` : null,
    euros(bien.price),
  ].filter(Boolean);

  const extra = bien.photos.slice(1, 4);
  const overflow = Math.max(0, bien.photos.length - 4);

  async function addPhotoFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = BIEN_PHOTO_MAX_COUNT - bien.photos.length;
    if (room <= 0) {
      notifyError('20 photos maximum par bien');
      return;
    }
    setPhotoBusy(true);
    const urls: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, room)) {
        const result = await uploadBienPhotoFile(file);
        if (result.error || !result.url) {
          notifyError(result.error ?? "La photo n'a pas pu être enregistrée");
          break;
        }
        urls.push(result.url);
      }
      if (urls.length === 0) return;

      const photos = normalizePhotoUrls([...bien.photos, ...urls]);
      const res = await fetch(`/api/dashboard/biens/${bien.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bienToInput({ ...bien, photos })),
      });
      const data = (await res.json()) as { bien?: Bien; error?: string };
      if (!res.ok || !data.bien) {
        notifyError(data.error ?? "Les photos n'ont pas pu être enregistrées");
        return;
      }
      onUpdated(data.bien);
      notifySuccess(urls.length > 1 ? `${urls.length} photos ajoutées` : 'Photo ajoutée');
    } catch {
      notifyError("Les photos n'ont pas pu être enregistrées");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <li>
      <WorkspaceCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
          <div className="flex flex-shrink-0 gap-1.5">
            {bien.photos.length > 0 ? (
              <button
                type="button"
                onClick={() => onViewPhotos(0)}
                className="h-[168px] w-full overflow-hidden rounded-lg bg-[#EFEBE3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-[128px] sm:w-[176px]"
                aria-label={`Voir les photos de ${bien.address}`}
              >
                <Cover bien={bien} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onEdit}
                className="h-[168px] w-full overflow-hidden rounded-lg bg-[#EFEBE3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-[128px] sm:w-[176px]"
                aria-label={`Modifier ${bien.address}`}
              >
                <Cover bien={bien} />
              </button>
            )}
            {extra.length > 0 ? (
              <ul className="hidden h-[128px] flex-col gap-1 sm:flex">
                {extra.map((url, i) => {
                  const photoIndex = i + 1;
                  const isLast = i === extra.length - 1 && overflow > 0;
                  return (
                    <li key={url} className="min-h-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onViewPhotos(photoIndex)}
                        className="relative size-full w-12 overflow-hidden rounded-md bg-[#EFEBE3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        aria-label={
                          isLast
                            ? `Voir les ${bien.photos.length} photos`
                            : `Voir la photo ${photoIndex + 1}`
                        }
                      >
                        <img src={url} alt="" className="size-full object-cover" />
                        {isLast ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-[#1E3148]/55 text-[12px] font-semibold text-white">
                            +{overflow}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 items-start gap-2">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={onEdit}
                className="w-full min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span
                  className="line-clamp-2 block text-[16px] font-semibold text-text-strong sm:text-[18px]"
                  style={{ letterSpacing: '-0.015em' }}
                >
                  {bien.address}
                </span>
                <p className="mt-1.5 truncate text-[13px] text-text-muted sm:text-[13.5px]">
                  {[bien.postalCode, bien.city].filter(Boolean).join(' ') ||
                    'Localisation à compléter'}
                  {details.length > 0 ? ` · ${details.join(' · ')}` : ''}
                </p>
              </button>
              <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-text-subtle sm:text-[13px]">
                <span>
                  {bien.proprietaireName
                    ? `Propriétaire : ${bien.proprietaireName}`
                    : 'Aucun propriétaire rattaché'}
                </span>
                {bien.proprietairePhone ? (
                  <a
                    href={telHref(bien.proprietairePhone)}
                    className="inline-flex min-h-8 items-center gap-1 font-medium text-[#3D5A80] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-label={`Appeler ${bien.proprietaireName ?? 'le propriétaire'}`}
                  >
                    <Phone size={12} strokeWidth={2.2} aria-hidden />
                    {formatPhoneDisplay(bien.proprietairePhone)}
                  </a>
                ) : null}
                {bien.proprietaireEmail ? (
                  <a
                    href={`mailto:${bien.proprietaireEmail}`}
                    className="inline-flex min-h-8 max-w-full items-center gap-1 font-medium text-[#3D5A80] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-label={`Écrire à ${bien.proprietaireName ?? 'le propriétaire'}`}
                  >
                    <Mail size={12} strokeWidth={2} className="flex-shrink-0" aria-hidden />
                    <span className="truncate">{bien.proprietaireEmail}</span>
                  </a>
                ) : null}
                {bien.photos.length > 0 ? (
                  <span>
                    {bien.photos.length} photo{bien.photos.length > 1 ? 's' : ''}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[12px] text-text-subtle sm:text-[12.5px]">
                  {MANDAT_STATUT_LABELS[bien.mandatStatut]}
                </span>
                <ActionMenu
                  label={`Actions pour ${bien.address}`}
                  items={[
                    { label: 'Modifier ce bien', onSelect: onEdit },
                    { label: "Exporter l'annonce", onSelect: onExport },
                    { label: 'Supprimer ce bien', onSelect: onDelete, destructive: true },
                  ]}
                />
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                tabIndex={-1}
                className="sr-only"
                aria-label={`Ajouter des photos à ${bien.address}`}
                onChange={(e) => void addPhotoFiles(e.target.files)}
              />
              <button
                type="button"
                disabled={photoBusy || bien.photos.length >= BIEN_PHOTO_MAX_COUNT}
                onClick={() => fileRef.current?.click()}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-[#3D5A80] hover:bg-[#3D5A80]/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
              >
                <ImagePlus size={16} strokeWidth={2} aria-hidden />
                {photoBusy ? 'Envoi…' : 'Photos'}
              </button>
            </div>
          </div>
        </div>
      </WorkspaceCard>
    </li>
  );
}
