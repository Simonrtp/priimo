'use client';

import { Clock, Loader2, MapPin, Route, X } from 'lucide-react';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import { DUREES_TOURNEE, libelleDuree } from '@/lib/tournee/reglages';
import { armPointerShield } from '@/lib/ui/pointer-guard';

/** Avant de tracer : par où passer (facultatif) et combien de temps y consacrer. */
export default function CarteTourneeSetupSheet({
  secteurNom,
  ancre,
  onAncre,
  duree,
  onDuree,
  postcodeFilter,
  generating,
  message,
  onPickOnMap,
  onGenerate,
  onClose,
}: {
  secteurNom: string | null;
  ancre: SelectedAddress | null;
  onAncre: (adresse: SelectedAddress | null) => void;
  duree: number;
  onDuree: (minutes: number) => void;
  postcodeFilter?: string;
  generating: boolean;
  message: string | null;
  onPickOnMap: () => void;
  onGenerate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] px-3">
      <div
        className="tour-brief pointer-events-auto flex flex-col overflow-hidden rounded-[26px] bg-surface shadow-[0_-12px_44px_rgba(26,42,86,0.24)] ring-1 ring-black/[0.06]"
        style={{
          marginBottom: 'calc(10px + var(--field-nav-height))',
          maxHeight: 'calc(100dvh - var(--field-nav-height) - 24px - env(safe-area-inset-top, 0px))',
        }}
      >
        <div
          className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 pt-4"
          style={{ background: 'linear-gradient(165deg, var(--primary-50) 0%, #fff 48%)' }}
        >
          <div className="flex items-start gap-3">
            <span
              className="flex size-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white"
              aria-hidden
            >
              <Route size={21} strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="font-semibold text-text-strong" style={{ fontSize: 19, lineHeight: 1.2 }}>
                Préparer ma tournée
              </h2>
              <p className="mt-0.5 text-pretty text-[13px] leading-snug text-text-muted">
                Les DPE les plus récents {secteurNom ? `de ${secteurNom}` : 'de l’agence'}, sans les
                adresses déjà prospectées.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                armPointerShield();
                onClose();
              }}
              aria-label="Fermer"
              className="app-press -mr-1 -mt-1 flex size-10 flex-shrink-0 items-center justify-center rounded-full text-text-muted"
            >
              <X size={19} strokeWidth={2.2} aria-hidden />
            </button>
          </div>

          <section className="mt-4">
            <p className="flex items-center gap-1.5 pb-2 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
              <MapPin size={13} strokeWidth={2.4} aria-hidden />
              Passer par une adresse
              <span className="font-medium normal-case tracking-normal text-text-subtle">(facultatif)</span>
            </p>
            {ancre ? (
              <div className="flex min-h-[48px] items-center gap-2.5 rounded-xl bg-primary-50 py-2 pl-3 pr-1.5 ring-1 ring-primary-200">
                <MapPin size={17} strokeWidth={2.3} className="flex-shrink-0 text-primary-600" aria-hidden />
                <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-text-strong">
                  {ancre.label}
                </span>
                <button
                  type="button"
                  onClick={() => onAncre(null)}
                  aria-label="Retirer cette adresse"
                  className="app-press flex size-9 flex-shrink-0 items-center justify-center rounded-full text-text-muted"
                >
                  <X size={16} strokeWidth={2.3} aria-hidden />
                </button>
              </div>
            ) : (
              <>
                <AddressAutocomplete
                  placeholder="Rechercher une adresse…"
                  postcodeFilter={postcodeFilter}
                  onChange={(adresse) => {
                    if (adresse) onAncre(adresse);
                  }}
                  inputClassName="w-full rounded-xl border border-black/[0.08] bg-white py-3 pl-10 pr-3 text-[15px] text-text-strong outline-none focus:border-primary-400"
                  aria-label="Adresse par laquelle passer"
                />
                <button
                  type="button"
                  onClick={onPickOnMap}
                  className="app-press mt-1 flex min-h-[44px] w-full items-center gap-2 rounded-xl px-1 text-left text-[13.5px] font-semibold text-primary-600"
                >
                  <MapPin size={15} strokeWidth={2.4} aria-hidden />
                  Ou touchez un point sur la carte
                </button>
              </>
            )}
          </section>

          <section className="mt-3">
            <p className="flex items-center gap-1.5 pb-2 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
              <Clock size={13} strokeWidth={2.4} aria-hidden />
              Temps de prospection
            </p>
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Temps de prospection">
              {DUREES_TOURNEE.map((minutes) => {
                const actif = minutes === duree;
                return (
                  <button
                    key={minutes}
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    onClick={() => onDuree(minutes)}
                    className={`app-press flex min-h-[44px] items-center justify-center rounded-full px-1 text-[13.5px] font-semibold tabular-nums transition-colors duration-150 ${
                      actif ? 'bg-primary-600 text-white' : 'bg-black/[0.05] text-text'
                    }`}
                  >
                    {libelleDuree(minutes)}
                  </button>
                );
              })}
            </div>
          </section>

          {message ? (
            <p className="mt-3 text-pretty rounded-xl bg-black/[0.04] px-3 py-2.5 text-[13.5px] leading-snug text-text" role="status">
              {message}
            </p>
          ) : null}
        </div>

        <div className="flex-shrink-0 border-t border-black/[0.06] bg-surface px-4 py-3">
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="app-press flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 font-semibold text-white disabled:opacity-80"
            style={{ fontSize: 15.5 }}
          >
            {generating ? (
              <>
                <Loader2 size={18} strokeWidth={2.4} className="animate-spin" aria-hidden />
                Je cherche les meilleures portes…
              </>
            ) : (
              'Générer ma tournée'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
