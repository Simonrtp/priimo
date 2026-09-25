'use client';

import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import {
  BIEN_PHOTO_MAX_COUNT,
  estFichierPhoto,
  uploadBienPhotoFile,
} from '@/lib/bien-photos';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { EstimationPhoto } from '@/lib/estimation/objet';

export default function ZoneDepotPhotos({
  photos,
  onChange,
}: {
  photos: EstimationPhoto[];
  onChange: (photos: EstimationPhoto[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const [survol, setSurvol] = useState(false);
  const [envoi, setEnvoi] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  async function recevoir(liste: FileList | File[] | null) {
    const candidats = Array.from(liste ?? []);
    if (candidats.length === 0) return;

    const photosActuelles = photosRef.current;
    const place = BIEN_PHOTO_MAX_COUNT - photosActuelles.length;
    if (place <= 0) {
      const msg = '20 photos maximum';
      setErreur(msg);
      notifyError(msg);
      return;
    }

    const photosSeules = candidats.filter(estFichierPhoto);
    const refuses = candidats.length - photosSeules.length;
    if (photosSeules.length === 0) {
      const msg = 'Seules les photos sont acceptées, pas les vidéos.';
      setErreur(msg);
      notifyError(msg);
      return;
    }

    setErreur(null);
    setEnvoi(photosSeules.slice(0, place).length);
    const ajoutees: EstimationPhoto[] = [];
    try {
      for (const file of photosSeules.slice(0, place)) {
        const result = await uploadBienPhotoFile(file);
        if (result.error || !result.url) {
          const msg = result.error ?? "La photo n'a pas pu être enregistrée";
          setErreur(msg);
          notifyError(msg);
          break;
        }
        ajoutees.push({ url: result.url, kind: 'photo' });
      }
      if (ajoutees.length > 0) {
        onChange([...photosRef.current, ...ajoutees]);
        notifySuccess(ajoutees.length > 1 ? `${ajoutees.length} photos enregistrées` : 'Photo enregistrée');
      }
      if (photosSeules.length > place) {
        const msg = '20 photos maximum';
        setErreur(msg);
        notifyError(msg);
      } else if (refuses > 0 && ajoutees.length > 0) {
        setErreur('Les vidéos ont été ignorées.');
      }
    } finally {
      setEnvoi(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const occupé = envoi > 0;
  const plein = photos.length >= BIEN_PHOTO_MAX_COUNT;

  return (
    <div>
      {photos.length > 0 ? (
        <ul className="mb-3 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <li key={p.url} className="relative flex flex-col gap-1">
              <div className="relative overflow-hidden rounded-clay bg-black/[0.04]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-24 w-full object-cover" />
                <button
                  type="button"
                  aria-label="Retirer cette photo"
                  className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full bg-[#1A2A56]/80 text-white hover:bg-[#1A2A56] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={() => onChange(photos.filter((x) => x.url !== p.url))}
                >
                  <X size={14} strokeWidth={2.2} aria-hidden />
                </button>
              </div>
              {p.kind === 'photo' ? (
                <button
                  type="button"
                  className="min-h-9 text-[12px] text-text-muted hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={() =>
                    onChange(
                      photos.map((x) => ({
                        ...x,
                        couverture: x.url === p.url,
                      })),
                    )
                  }
                >
                  {p.couverture ? 'Photo de couverture' : 'Choisir en couverture'}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => void recevoir(e.target.files)}
      />

      <button
        type="button"
        disabled={occupé || plein}
        aria-label="Déposer des photos ou ouvrir la galerie"
        aria-describedby="zone-photos-aide"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!occupé && !plein) setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          if (!occupé && !plein) void recevoir(e.dataTransfer.files);
        }}
        className={`flex min-h-[9.5rem] w-full flex-col items-center justify-center rounded-clay border border-dashed px-4 py-8 text-center duration-fluid-subtle ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${
          survol ? 'border-accent bg-soft-warm' : 'border-black/[0.16] bg-black/[0.02]'
        }`}
      >
        <ImagePlus size={22} strokeWidth={2} className="text-accent-dark" aria-hidden />
        <p className="mt-3 text-pretty text-[14px] font-medium text-text-strong">
          {occupé
            ? envoi > 1
              ? `Enregistrement de ${envoi} photos…`
              : 'Enregistrement…'
            : plein
              ? '20 photos atteintes'
              : 'Déposez vos photos ici'}
        </p>
        <p id="zone-photos-aide" className="mt-1 text-pretty text-[12.5px] text-text-muted">
          {plein ? 'Retirez une photo pour en ajouter.' : 'Ou touchez pour ouvrir la galerie. Photos seulement, 8 Mo.'}
        </p>
      </button>

      {erreur ? (
        <p className="mt-2 text-pretty text-[13px] text-red-700" role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
