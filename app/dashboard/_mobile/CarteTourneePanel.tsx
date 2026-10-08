'use client';

import { useState, type ReactNode } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Flame,
  LocateOff,
  Loader2,
  Mic,
  Pause,
  RotateCcw,
  Star,
  UserRound,
} from 'lucide-react';
import { DPE_PALETTE, parseDpeLetter } from '@/lib/carte/dpe-public';
import { formatDistance } from '@/lib/today/field';
import { ilYa, joursDepuisLe, libelleTemps, type ArretTournee } from '@/lib/tournee/reglages';
import { armPointerShield } from '@/lib/ui/pointer-guard';

const DATE_COURTE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

/** « 16 Rue Camille Desmoulins 75011 Paris » → rue, puis code postal et ville. */
function separerAdresse(adresse: string): { rue: string; ville: string | null } {
  const m = /^(.*?)[,\s]+(\d{5}\s+.+)$/.exec(adresse.trim());
  return m ? { rue: m[1]!, ville: m[2]! } : { rue: adresse, ville: null };
}

function dateCourte(jour: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(jour);
  return m ? DATE_COURTE.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : jour;
}

function BadgeDpe({ lettre }: { lettre: string | null }) {
  const parsee = parseDpeLetter(lettre);
  if (!parsee) return null;
  const sombre = parsee === 'C' || parsee === 'D' || parsee === 'E';
  return (
    <span
      className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg text-[14px] font-bold"
      style={{ backgroundColor: DPE_PALETTE[parsee], color: sombre ? '#1e1b4b' : '#fff' }}
      aria-label={`DPE ${parsee}`}
    >
      {parsee}
    </span>
  );
}

function Ligne({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-[14.5px] leading-snug text-text-strong">
      <span className="flex size-7 flex-shrink-0 items-center justify-center" aria-hidden>
        {icone}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

function Pourquoi({ arret }: { arret: ArretTournee }) {
  const { dpe, lead, dernierPassage, choisie } = arret.detail;
  const bien = [dpe?.type ? dpe.type.charAt(0).toUpperCase() + dpe.type.slice(1) : null, dpe?.surfaceM2 ? `${Math.round(dpe.surfaceM2)} m²` : null]
    .filter(Boolean)
    .join(' · ');
  const icone = 'text-primary-500';
  return (
    <ul className="flex flex-col gap-2.5">
      {dpe?.date ? (
        <Ligne
          icone={
            parseDpeLetter(dpe.lettre) ? (
              <BadgeDpe lettre={dpe.lettre} />
            ) : (
              <Building2 size={18} strokeWidth={2.2} className={icone} />
            )
          }
        >
          {dpe.nombre > 1
            ? `${dpe.nombre} DPE dans l’immeuble, le dernier ${ilYa(joursDepuisLe(dpe.date))}`
            : `DPE fait ${ilYa(joursDepuisLe(dpe.date))}`}
        </Ligne>
      ) : null}
      {dpe?.passoire ? (
        <Ligne icone={<Flame size={18} strokeWidth={2.2} className={icone} />}>Passoire énergétique</Ligne>
      ) : null}
      {bien ? <Ligne icone={<Building2 size={18} strokeWidth={2.2} className={icone} />}>{bien}</Ligne> : null}
      {lead ? (
        <Ligne icone={<Star size={18} strokeWidth={2.2} className={icone} />}>
          {lead.signal ? `Dans tes leads : ${lead.signal}` : 'Dans tes leads'}
        </Ligne>
      ) : null}
      {dernierPassage ? (
        <Ligne icone={<RotateCcw size={18} strokeWidth={2.2} className={icone} />}>
          Déjà passé le {dateCourte(dernierPassage)}, nouveau DPE depuis
        </Ligne>
      ) : null}
      {choisie ? (
        <Ligne icone={<UserRound size={18} strokeWidth={2.2} className={icone} />}>Tu as ajouté cette adresse</Ligne>
      ) : null}
    </ul>
  );
}

function Numero({ index, fait }: { index: number; fait: boolean }) {
  return (
    <span
      className={`flex size-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${
        fait ? 'bg-primary-100 text-primary-500' : 'bg-primary-500 text-white'
      }`}
      aria-hidden
    >
      {fait ? <Check size={15} strokeWidth={2.8} /> : index + 1}
    </span>
  );
}

/** La tournée en cours : où on en est, la prochaine porte, et pourquoi chaque adresse est là. */
export default function CarteTourneePanel({
  arrets,
  faits,
  prochain,
  arretChoisi,
  onChoisir,
  tempsMs,
  distanceM,
  routage,
  sansPosition,
  onPause,
  onTerminer,
  onNoter,
  onFait,
  onRetirer,
}: {
  arrets: readonly ArretTournee[];
  faits: ReadonlySet<string>;
  prochain: ArretTournee | null;
  arretChoisi: ArretTournee | null;
  onChoisir: (key: string | null) => void;
  tempsMs: number;
  distanceM: number;
  routage: boolean;
  sansPosition: boolean;
  onPause: () => void;
  onTerminer: () => void;
  onNoter: (arret: ArretTournee) => void;
  onFait: (key: string, fait: boolean) => void;
  onRetirer: (key: string) => void;
}) {
  const [liste, setListe] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const nbFaites = arrets.filter((a) => faits.has(a.key)).length;
  const indexDe = (key: string) => arrets.findIndex((a) => a.key === key);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] px-3">
      <div
        className="pointer-events-auto flex flex-col overflow-hidden rounded-[24px] bg-surface shadow-[0_-10px_36px_rgba(26,42,86,0.2)] ring-1 ring-black/[0.06]"
        style={{
          marginBottom: 'calc(10px + var(--field-nav-height))',
          maxHeight: 'calc(100dvh - var(--field-nav-height) - 72px - env(safe-area-inset-top, 0px))',
        }}
      >
        <div className="flex flex-shrink-0 items-center gap-2 px-4 pb-2.5 pt-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold text-text-strong">
              {nbFaites > 0 ? `${nbFaites} sur ${arrets.length} faites` : `${arrets.length} adresses à faire`}
            </p>
            {sansPosition ? (
              <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-primary-600">
                <LocateOff size={13} strokeWidth={2.4} aria-hidden />
                Pense à activer ta localisation !
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-[12.5px] tabular-nums text-text-muted">
                {routage ? <Loader2 size={12} strokeWidth={2.4} className="animate-spin" aria-hidden /> : null}
                {libelleTemps(tempsMs)} · {formatDistance(distanceM)}
              </p>
            )}
          </div>
          {confirmer ? null : (
            <>
              <button
                type="button"
                onClick={onPause}
                className="app-press flex h-10 items-center gap-1.5 rounded-full bg-black/[0.05] px-3.5 text-[13.5px] font-semibold text-text-strong"
              >
                <Pause size={15} strokeWidth={2.4} aria-hidden />
                Pause
              </button>
              <button
                type="button"
                onClick={() => setConfirmer(true)}
                className="app-press flex h-10 items-center gap-1.5 rounded-full bg-black/[0.05] px-3.5 text-[13.5px] font-semibold text-text-strong"
              >
                <Flag size={15} strokeWidth={2.4} aria-hidden />
                Terminer
              </button>
            </>
          )}
        </div>

        {confirmer ? (
          <div className="flex-shrink-0 border-t border-black/[0.06] px-4 py-3">
            <p className="text-[15.5px] font-semibold text-text-strong">Terminer la tournée ?</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmer(false)}
                className="app-press flex h-12 items-center justify-center rounded-2xl bg-black/[0.05] text-[15px] font-semibold text-text-strong"
              >
                Continuer
              </button>
              <button
                type="button"
                onClick={() => {
                  armPointerShield();
                  setConfirmer(false);
                  onTerminer();
                }}
                className="app-press flex h-12 items-center justify-center rounded-2xl bg-primary-500 text-[15px] font-semibold text-white"
              >
                Oui, terminer
              </button>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 overflow-y-auto overscroll-contain border-t border-black/[0.06]">
          {arretChoisi ? (
            <FicheArret
              arret={arretChoisi}
              index={indexDe(arretChoisi.key)}
              fait={faits.has(arretChoisi.key)}
              onRetour={() => onChoisir(null)}
              onNoter={() => onNoter(arretChoisi)}
              onFait={(fait) => onFait(arretChoisi.key, fait)}
              onRetirer={() => onRetirer(arretChoisi.key)}
            />
          ) : (
            <div className="px-3 pb-3 pt-2">
              {prochain ? (
                <button
                  type="button"
                  onClick={() => onChoisir(prochain.key)}
                  className="app-press flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-primary-50 px-3 text-left ring-1 ring-primary-200"
                >
                  <Numero index={indexDe(prochain.key)} fait={false} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-primary-500">
                      Prochaine porte
                    </span>
                    <span className="block truncate text-[15px] font-semibold text-text-strong">
                      {separerAdresse(prochain.address).rue}
                    </span>
                    {prochain.mainSignalLabel ? (
                      <span className="block truncate text-[12.5px] text-text-muted">{prochain.mainSignalLabel}</span>
                    ) : null}
                  </span>
                  <ChevronRight size={18} strokeWidth={2.2} className="flex-shrink-0 text-primary-500" aria-hidden />
                </button>
              ) : (
                <p className="rounded-2xl bg-primary-50 px-4 py-3 text-[15px] font-semibold text-primary-700">
                  Toutes les portes sont faites. Bravo !
                </p>
              )}

              <button
                type="button"
                onClick={() => setListe((v) => !v)}
                aria-expanded={liste}
                className="app-press mt-1 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-semibold text-text-muted"
              >
                {liste ? 'Masquer les adresses' : `Voir les ${arrets.length} adresses`}
                <ChevronDown
                  size={16}
                  strokeWidth={2.3}
                  className={`transition-transform duration-200 ${liste ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>

              {liste ? (
                <ol className="flex flex-col gap-0.5">
                  {arrets.map((arret, index) => {
                    const fait = faits.has(arret.key);
                    const { rue } = separerAdresse(arret.address);
                    return (
                      <li key={arret.key}>
                        <button
                          type="button"
                          onClick={() => onChoisir(arret.key)}
                          className="app-press flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-1.5 text-left"
                        >
                          <Numero index={index} fait={fait} />
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-[14.5px] font-medium ${
                                fait ? 'text-text-muted line-through decoration-black/20' : 'text-text-strong'
                              }`}
                            >
                              {rue}
                            </span>
                            {arret.mainSignalLabel ? (
                              <span className="block truncate text-[12px] text-text-muted">{arret.mainSignalLabel}</span>
                            ) : null}
                          </span>
                          <ChevronRight size={16} strokeWidth={2.2} className="flex-shrink-0 text-text-subtle" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FicheArret({
  arret,
  index,
  fait,
  onRetour,
  onNoter,
  onFait,
  onRetirer,
}: {
  arret: ArretTournee;
  index: number;
  fait: boolean;
  onRetour: () => void;
  onNoter: () => void;
  onFait: (fait: boolean) => void;
  onRetirer: () => void;
}) {
  const { rue, ville } = separerAdresse(arret.address);
  return (
    <div className="px-4 pb-4 pt-2">
      <button
        type="button"
        onClick={onRetour}
        className="app-press -ml-1.5 flex min-h-[40px] items-center gap-0.5 rounded-full pr-2 text-[13.5px] font-semibold text-text-muted"
      >
        <ChevronLeft size={18} strokeWidth={2.3} aria-hidden />
        Toutes les adresses
      </button>

      <div className="mt-1 flex items-start gap-3">
        <Numero index={index} fait={fait} />
        <div className="min-w-0 flex-1">
          <h3 className="text-pretty text-[19px] font-semibold leading-tight text-text-strong">{rue}</h3>
          {ville ? <p className="mt-0.5 text-[13.5px] text-text-muted">{ville}</p> : null}
        </div>
      </div>

      <div className="mt-4">
        <Pourquoi arret={arret} />
      </div>

      <button
        type="button"
        onClick={onNoter}
        className="app-press mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary-500 text-[16px] font-semibold text-white"
      >
        <Mic size={19} strokeWidth={2.3} aria-hidden />
        Prendre une note
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onFait(!fait)}
          aria-pressed={fait}
          className={`app-press flex min-h-[46px] items-center justify-center gap-1.5 rounded-2xl text-[14.5px] font-semibold ${
            fait ? 'bg-primary-100 text-primary-600' : 'bg-black/[0.05] text-text-strong'
          }`}
        >
          <Check size={16} strokeWidth={2.6} aria-hidden />
          {fait ? 'Faite' : 'C’est fait'}
        </button>
        <button
          type="button"
          onClick={onRetirer}
          className="app-press flex min-h-[46px] items-center justify-center rounded-2xl bg-black/[0.05] text-[14.5px] font-semibold text-text-muted"
        >
          Retirer
        </button>
      </div>
    </div>
  );
}
