'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  Flame,
  Footprints,
  LocateOff,
  Loader2,
  Mic,
  NotebookPen,
  Pause,
  RotateCcw,
  Star,
  UserRound,
} from 'lucide-react';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { useUser } from '@/lib/hooks/useUser';
import { DPE_PALETTE, formatDpeEtage, parseDpeLetter } from '@/lib/carte/dpe-public';
import { formatDistance } from '@/lib/today/field';
import { ilYa, joursDepuisLe, libelleTemps, type ArretTournee } from '@/lib/tournee/reglages';
import { armPointerShield } from '@/lib/ui/pointer-guard';

const DATE_COURTE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

/** Au-delà, le doigt a fait glisser la carte : ce n'est pas un tap. */
const TAP_TOLERANCE_PX = 10;

/** « 16 Rue Camille Desmoulins 75011 Paris » → rue, puis code postal et ville. */
function separerAdresse(adresse: string): { rue: string; ville: string | null } {
  const m = /^(.*?)[,\s]+(\d{5}\s+.+)$/.exec(adresse.trim());
  return m ? { rue: m[1]!, ville: m[2]! } : { rue: adresse, ville: null };
}

function dateCourte(jour: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(jour);
  return m ? DATE_COURTE.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : jour;
}

/** « Appartement de 70 m² · 3e étage » */
function decrireLogementArret(arret: ArretTournee): string | null {
  const dpe = arret.detail.dpe;
  const type = dpe?.type ? dpe.type.charAt(0).toUpperCase() + dpe.type.slice(1).toLowerCase() : null;
  const surface = dpe?.surfaceM2 ?? arret.surfaceM2;
  const m2 = surface ? `${Math.round(surface)} m²` : null;
  const logement = type && m2 ? `${type} de ${m2}` : (type ?? m2);
  const etage = formatDpeEtage(dpe?.etage ?? null) ?? arret.etage;
  return [logement, etage].filter(Boolean).join(' · ') || null;
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

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="border-t border-black/[0.06] py-5">
      <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-text-subtle">{titre}</h4>
      {children}
    </section>
  );
}

function Pourquoi({ arret }: { arret: ArretTournee }) {
  const { dpe, lead, dernierPassage, choisie } = arret.detail;
  const icone = 'text-text-muted';
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
      {lead ? (
        <Ligne icone={<Star size={18} strokeWidth={2.2} className={icone} />}>
          {lead.signal ? `Dans tes leads : ${lead.signal}` : 'Dans tes leads'}
        </Ligne>
      ) : null}
      {dernierPassage ? (
        <Ligne icone={<RotateCcw size={18} strokeWidth={2.2} className={icone} />}>
          Nouveau DPE depuis ton passage du {dateCourte(dernierPassage)}
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
        fait ? 'bg-black/[0.06] text-text-muted' : 'bg-blue text-white'
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
  const panneau = useRef<HTMLDivElement | null>(null);
  const nbFaites = arrets.filter((a) => faits.has(a.key)).length;
  const indexDe = (key: string) => arrets.findIndex((a) => a.key === key);

  // Un tap sur la carte, au-dessus du panneau, replie la liste.
  useEffect(() => {
    if (!liste) return;
    let depart: { x: number; y: number } | null = null;
    const dehors = (event: PointerEvent) =>
      !(event.target instanceof Node && panneau.current?.contains(event.target));
    const down = (event: PointerEvent) => {
      depart = dehors(event) ? { x: event.clientX, y: event.clientY } : null;
    };
    const up = (event: PointerEvent) => {
      if (!depart) return;
      const glisse = Math.hypot(event.clientX - depart.x, event.clientY - depart.y) > TAP_TOLERANCE_PX;
      depart = null;
      if (!glisse) setListe(false);
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
    };
  }, [liste]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] px-3">
      <div
        ref={panneau}
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
              <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-text-strong">
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
                className="app-press flex h-11 items-center gap-1.5 rounded-full bg-black/[0.05] px-3.5 text-[13.5px] font-semibold text-text-strong"
              >
                <Pause size={15} strokeWidth={2.4} aria-hidden />
                Pause
              </button>
              <button
                type="button"
                onClick={() => setConfirmer(true)}
                className="app-press flex h-11 items-center gap-1.5 rounded-full bg-black/[0.05] px-3.5 text-[13.5px] font-semibold text-text-strong"
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
              key={arretChoisi.key}
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
                  className="app-press flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-black/[0.04] px-3 text-left"
                >
                  <Numero index={indexDe(prochain.key)} fait={false} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-text-subtle">
                      Prochaine porte
                    </span>
                    <span className="block truncate text-[15px] font-semibold text-text-strong">
                      {separerAdresse(prochain.address).rue}
                    </span>
                    {prochain.mainSignalLabel ? (
                      <span className="block truncate text-[12.5px] text-text-muted">{prochain.mainSignalLabel}</span>
                    ) : null}
                  </span>
                  <ChevronRight size={18} strokeWidth={2.2} className="flex-shrink-0 text-text-subtle" aria-hidden />
                </button>
              ) : (
                <p className="rounded-2xl bg-black/[0.04] px-4 py-3 text-[15px] font-semibold text-text-strong">
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

              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-soft motion-reduce:transition-none ${
                  liste ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
                aria-hidden={!liste}
              >
                <ol className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                  {arrets.map((arret, index) => {
                    const fait = faits.has(arret.key);
                    const { rue } = separerAdresse(arret.address);
                    return (
                      <li key={arret.key}>
                        <button
                          type="button"
                          onClick={() => onChoisir(arret.key)}
                          tabIndex={liste ? undefined : -1}
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
              </div>
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
  const { openCompose, captureSessionOpen } = useVoiceCapture();
  const { profile } = useUser();
  const [noteTick, setNoteTick] = useState(0);
  const captureWasOpen = useRef(false);

  useEffect(() => {
    if (captureSessionOpen) {
      captureWasOpen.current = true;
      return;
    }
    if (!captureWasOpen.current) return;
    captureWasOpen.current = false;
    setNoteTick((n) => n + 1);
  }, [captureSessionOpen]);

  const { rue, ville } = separerAdresse(arret.address);
  const logement = decrireLogementArret(arret);
  const passage = arret.detail.dernierPassage ?? arret.dernierPassageJour ?? null;

  return (
    <div className="px-4 pb-2 pt-2">
      <button
        type="button"
        onClick={onRetour}
        className="app-press -ml-1.5 flex min-h-11 items-center gap-0.5 rounded-full pr-2 text-[13.5px] font-semibold text-text-muted"
      >
        <ChevronLeft size={18} strokeWidth={2.3} aria-hidden />
        Toutes les adresses
      </button>

      <div className="mt-1 flex items-start gap-3 pb-4">
        <Numero index={index} fait={fait} />
        <div className="min-w-0 flex-1">
          <h3 className="text-pretty text-[19px] font-semibold leading-tight text-text-strong">{rue}</h3>
          {logement ? <p className="mt-1 text-[14px] text-text-strong">{logement}</p> : null}
          {ville ? <p className="mt-0.5 text-[13px] text-text-muted">{ville}</p> : null}
        </div>
      </div>

      <Section titre="Ici">
        <p className="flex items-center gap-2 text-[14px] text-text-strong">
          <Footprints size={16} strokeWidth={2.2} className="flex-shrink-0 text-text-muted" aria-hidden />
          {passage ? `Dernier passage le ${dateCourte(passage)}` : 'Aucun passage enregistré'}
        </p>
        {arret.banId ? (
          <div className="mt-3">
            <NotesTerrainList
              key={`${arret.banId}:${noteTick}`}
              entiteType="immeuble"
              entiteId={arret.banId}
              currentUserId={profile?.id}
            />
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onNoter}
            className="app-press inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ia px-4 text-[15px] font-semibold text-white"
          >
            <Mic size={18} strokeWidth={2.2} aria-hidden />
            Dicter une note
          </button>
          <button
            type="button"
            onClick={() => openCompose({ adresse: arret.address, banId: arret.banId ?? undefined, resterSurPage: true })}
            className="app-press inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-black/[0.05] px-4 text-[14px] font-semibold text-text-strong"
          >
            <NotebookPen size={17} aria-hidden />
            Écrire
          </button>
        </div>
      </Section>

      <Section titre="Pourquoi cette porte">
        <Pourquoi arret={arret} />
      </Section>

      <div className="grid grid-cols-2 gap-2 border-t border-black/[0.06] pb-2 pt-4">
        <button
          type="button"
          onClick={() => onFait(!fait)}
          aria-pressed={fait}
          className={`app-press flex min-h-12 items-center justify-center gap-1.5 rounded-2xl text-[14.5px] font-semibold transition-colors duration-150 ${
            fait ? 'bg-[#474B53] text-white' : 'bg-black/[0.05] text-text-strong'
          }`}
        >
          <Check size={16} strokeWidth={2.6} aria-hidden />
          {fait ? 'Faite' : 'C’est fait'}
        </button>
        <button
          type="button"
          onClick={onRetirer}
          className="app-press flex min-h-12 items-center justify-center rounded-2xl bg-black/[0.05] text-[14.5px] font-semibold text-text-muted"
        >
          Retirer
        </button>
      </div>
    </div>
  );
}
