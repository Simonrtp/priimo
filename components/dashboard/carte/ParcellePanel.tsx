'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bell,
  BellRing,
  ChevronDown,
  ChevronRight,
  Footprints,
  Mic,
  NotebookPen,
  Phone,
  X,
} from 'lucide-react';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import ScoreRing from '@/components/dashboard/ScoreRing';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { useUser } from '@/lib/hooks/useUser';
import { notifyError, notifySuccess } from '@/lib/notify';
import { markerBadgeColor } from '@/lib/carte/colors';
import { dpeFillColor, formatDpeEtage, parseDpeLetter } from '@/lib/carte/dpe-public';
import { CONTACTS_LEGAL_HINT, immeubleCategorieLabel } from '@/lib/lead-contacts';
import { formatPhoneDisplay, telHref } from '@/lib/import/normalize';
import { toDisplayCompanyName, toDisplayPersonName } from '@/lib/lead-person-display';
import { CONTACT_TYPE_LABELS } from '@/types/contact';
import { MANDAT_STATUT_LABELS } from '@/types/bien';
import {
  decrireLogement,
  decrireVente,
  depuisQuand,
  estPassoire,
  raccourcirUsage,
  resumeAudits,
  resumeCopropriete,
  resumeLogements,
  syntheseParcelle,
} from '@/lib/carte/parcelle-synthese';
import type { GenreProprietaire, ProprietaireMorale } from '@/lib/carte/bdnb';
import { decrireNiveaux } from '@/lib/carte/proprietaires-lots';
import type { AuditEnergetique } from '@/lib/carte/audits';
import type {
  ParcelleBienAgence,
  ParcelleContactAgence,
  ParcelleEntreprise,
  ParcelleFiche,
  ParcelleLogement,
  ParcellePassage,
  ParcelleProspect,
  ParcelleVente,
} from '@/lib/carte/parcelle';
import { CIBLE_CLOCHE, envolerNote } from '@/lib/ui/envol-note';
import type { BlocFiche } from '@/lib/carte/brief-porte';
import BriefPorte, { EVENEMENT_BLOC_FICHE, SqueletteBrief } from '@/components/dashboard/carte/BriefPorte';
import type { Notification } from '@/lib/notifications/types';
import { useNotifications } from '@/components/providers/NotificationsProvider';

/** Au-delà, la liste se replie : « Voir les 23 ventes ». */
const LIGNES_VISIBLES = 5;

const PASSAGE_LIBELLE: Record<ParcellePassage['kind'], string> = {
  rencontre: 'personne rencontrée',
  absent: 'absent',
  passer: 'adresse passée',
};

function euros(n: number | null): string {
  if (n === null) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function eurosM2(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} €/m²`;
}

function moisAnnee(iso: string): string {
  const raw = iso.trim();
  const jourSeul = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  const d = jourSeul
    ? new Date(Number(jourSeul[1]), Number(jourSeul[2]) - 1, Number(jourSeul[3]))
    : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function libelle(map: Record<string, string>, cle: string | null): string | null {
  if (!cle) return null;
  return map[cle] ?? cle;
}

/* -------------------------------------------------------------------------- */
/*                                   Briques                                  */
/* -------------------------------------------------------------------------- */

function DpeLettre({ lettre, taille = 28 }: { lettre: string | null; taille?: number }) {
  const parsed = parseDpeLetter(lettre);
  if (!parsed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[11px] font-semibold text-text-subtle"
        style={{ width: taille, height: taille }}
        aria-label="Classe inconnue"
      >
        ?
      </span>
    );
  }
  const bg = dpeFillColor(parsed);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none"
      style={{
        width: taille,
        height: taille,
        fontSize: taille <= 22 ? 11 : 12,
        backgroundColor: bg,
        color: markerBadgeColor(bg),
      }}
      aria-label={`Classe ${parsed}`}
    >
      {parsed}
    </span>
  );
}

function Section({
  titre,
  aside,
  bloc,
  children,
}: {
  titre: string;
  aside?: ReactNode;
  bloc?: BlocFiche;
  children: ReactNode;
}) {
  return (
    <section data-fiche-bloc={bloc} className="scroll-mt-2 border-t border-black/[0.06] py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-text-subtle">{titre}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Depliable<T>({
  lignes,
  rendre,
  libellePlus,
}: {
  lignes: readonly T[];
  rendre: (ligne: T, index: number) => ReactNode;
  libellePlus: (n: number) => string;
}) {
  const [tout, setTout] = useState(false);
  const visibles = tout ? lignes : lignes.slice(0, LIGNES_VISIBLES);
  return (
    <>
      <ul className="flex flex-col">{visibles.map(rendre)}</ul>
      {lignes.length > LIGNES_VISIBLES ? (
        <button
          type="button"
          onClick={() => setTout((v) => !v)}
          className="mt-2 inline-flex min-h-11 items-center rounded-full px-1 text-[13px] font-semibold text-primary-600 hover:text-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {tout ? 'Réduire' : libellePlus(lignes.length)}
        </button>
      ) : null}
    </>
  );
}

/** Détail replié : le résumé reste lisible fermé. */
function Repli({
  titre,
  resume,
  bloc,
  children,
}: {
  titre: string;
  resume: string;
  bloc?: BlocFiche;
  children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (!bloc) return;
    function ouvrir(e: Event) {
      if ((e as CustomEvent<BlocFiche>).detail === bloc) setOuvert(true);
    }
    window.addEventListener(EVENEMENT_BLOC_FICHE, ouvrir);
    return () => window.removeEventListener(EVENEMENT_BLOC_FICHE, ouvrir);
  }, [bloc]);

  return (
    <section data-fiche-bloc={bloc} className="scroll-mt-2 border-t border-black/[0.06]">
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
        className="flex min-h-11 w-full items-center gap-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
            {titre}
          </span>
          <span className="mt-0.5 block truncate text-[14px] text-text-strong">{resume}</span>
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2.2}
          aria-hidden
          className={`shrink-0 text-text-subtle transition-transform duration-200 ${ouvert ? 'rotate-180' : ''}`}
        />
      </button>
      {ouvert ? <div className="pb-4">{children}</div> : null}
    </section>
  );
}

function Repartition({ repartition }: { repartition: readonly { lettre: string; n: number }[] }) {
  const total = repartition.reduce((s, r) => s + r.n, 0);
  if (total === 0) return null;
  const presentes = repartition.filter((r) => r.n > 0);
  return (
    <div className="mb-3">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full" aria-hidden>
        {presentes.map((r) => (
          <span
            key={r.lettre}
            className="h-full"
            style={{ width: `${(r.n / total) * 100}%`, backgroundColor: dpeFillColor(r.lettre) }}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[12px] tabular-nums text-text-subtle">
        {presentes.map((r) => `${r.lettre} ${r.n}`).join(' · ')}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Lignes                                   */
/* -------------------------------------------------------------------------- */

const LIGNE = 'border-t border-black/[0.05] first:border-t-0';

/** « 18 rue des Lilas » : le code postal et la ville sont déjà dans le titre du volet. */
function adresseCourte(libelle: string): string {
  return libelle.split(',')[0]?.trim() || libelle;
}

function LigneProspect({ p, avecAdresse }: { p: ParcelleProspect; avecAdresse: boolean }) {
  const logement = [
    p.etage != null || p.surface != null ? decrireLogement({ etage: p.etage, surface: p.surface }) : null,
    p.pieces ? `T${p.pieces}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  // Plusieurs entrées : l'adresse d'abord, le logement ensuite.
  const titre = avecAdresse || !logement ? adresseCourte(p.adresse) : logement;
  const sousTitre = avecAdresse ? logement : null;
  const detail = [
    p.entreprise ? `Propriétaire : ${toDisplayCompanyName(p.entreprise)}` : null,
    ...p.signaux,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className={LIGNE}>
      <Link
        href={p.href}
        className="-mx-2 flex min-h-11 items-start gap-3 rounded-xl px-2 py-3 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ScoreRing score={p.score} size={38} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-text-strong">{titre}</span>
            {p.dpe ? <DpeLettre lettre={p.dpe} taille={20} /> : null}
          </span>
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-text-muted">
            <span
              className={`shrink-0 rounded-full px-2 py-px text-[11.5px] font-semibold ${
                p.etape ? 'bg-primary-50 text-primary-700' : 'bg-accent/10 text-accent-dark'
              }`}
            >
              {p.etape ?? 'À prendre'}
            </span>
            {sousTitre ? <span className="shrink-0">{sousTitre}</span> : null}
            {p.contactabilite === 'direct' ? (
              <span className="inline-flex shrink-0 items-center gap-1">
                <Phone size={11} strokeWidth={2.2} aria-hidden />
                Tél. direct
              </span>
            ) : null}
          </span>
          {detail ? (
            <span className="mt-1 line-clamp-2 text-pretty text-[12.5px] leading-snug text-text-muted">{detail}</span>
          ) : null}
        </span>
        <ChevronRight size={16} className="mt-2.5 shrink-0 text-text-subtle" aria-hidden />
      </Link>
    </li>
  );
}

function BoutonAppel({ telephone, nom }: { telephone: string; nom: string }) {
  return (
    <a
      href={telHref(telephone)}
      aria-label={`Appeler ${nom}`}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-bg-subtle px-3.5 text-[13px] font-semibold tabular-nums text-text-strong transition-colors hover:bg-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Phone size={13} strokeWidth={2.2} aria-hidden />
      {formatPhoneDisplay(telephone)}
    </a>
  );
}

function LigneContact({ c }: { c: ParcelleContactAgence }) {
  return (
    <li className={`${LIGNE} flex items-center gap-3 py-2.5`}>
      <Link href={c.href} className="min-w-0 flex-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <span className="block truncate text-[14px] font-semibold text-text-strong hover:underline">{c.nom}</span>
        <span className="block truncate text-[12.5px] text-text-muted">
          {libelle(CONTACT_TYPE_LABELS, c.type) ?? 'Contact'}
        </span>
      </Link>
      {c.telephone ? <BoutonAppel telephone={c.telephone} nom={c.nom} /> : null}
    </li>
  );
}

function LigneBien({ b }: { b: ParcelleBienAgence }) {
  const description = [b.pieces ? `T${b.pieces}` : null, b.surface != null ? `${Math.round(b.surface)} m²` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className={LIGNE}>
      <Link
        href={b.href}
        className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-text-strong">{description || b.adresse}</span>
          <span className="block truncate text-[12.5px] text-text-muted">
            {libelle(MANDAT_STATUT_LABELS, b.statut) ?? 'Bien'}
          </span>
        </span>
        {b.prix != null ? (
          <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-text-strong">{euros(b.prix)}</span>
        ) : null}
        <ChevronRight size={16} className="shrink-0 text-text-subtle" aria-hidden />
      </Link>
    </li>
  );
}

const DPE_2026_HINT =
  "Étiquette du diagnostic tel qu'il a été établi. Depuis le 1er janvier 2026, l'électricité pèse moins dans le calcul : un logement chauffé à l'électricité classé F ou G avant 2026 peut avoir gagné une classe sans travaux. Le propriétaire peut télécharger sa nouvelle étiquette sur le site de l'ADEME.";

const PROPRIETAIRES_HINT =
  "Personnes morales propriétaires de lots, d'après les fichiers fonciers (DGFiP). Les particuliers n'y figurent jamais. Ouvre une ligne pour voir les dirigeants, le siège et la date de création.";

const GENRE_LIBELLE: Record<GenreProprietaire, string> = {
  sci: 'SCI',
  societe: 'Société',
  social: 'Bailleur social',
  public: 'Propriétaire public',
  copropriete: 'Syndicat de copropriété',
};

function anneeCreation(iso: string | null | undefined): string | null {
  if (!iso || iso.length < 4) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? String(y) : null;
}

type EnrichissementEntreprise = {
  dirigeants: { nom: string; qualite: string | null }[];
  siege: string | null;
  dateCreation: string | null;
  active: boolean | null;
};

/** Gérants / siège via l’Annuaire — après l’ouverture du volet, sans bloquer la fiche. */
function useProprietairesEnrichis(
  parcelleId: string,
  base: ProprietaireMorale[],
): { proprietaires: ProprietaireMorale[]; annuairePret: boolean } {
  const [extra, setExtra] = useState<Record<string, EnrichissementEntreprise>>({});
  const [annuairePret, setAnnuairePret] = useState(false);
  const sirensKey = base
    .filter((p) => p.siren && (p.genre === 'sci' || p.genre === 'societe'))
    .map((p) => p.siren)
    .join(',');

  useEffect(() => {
    setExtra({});
    setAnnuairePret(!sirensKey);
    if (!sirensKey) return;
    const sirens = sirensKey.split(',');
    const ac = new AbortController();
    void fetch(`/api/carte/entreprises?sirens=${sirens.join(',')}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { entreprises?: Record<string, EnrichissementEntreprise> };
        if (data.entreprises) setExtra(data.entreprises);
      })
      .catch(() => {
        /* ignore abort / réseau */
      })
      .finally(() => {
        if (!ac.signal.aborted) setAnnuairePret(true);
      });
    return () => ac.abort();
  }, [parcelleId, sirensKey]);

  const proprietaires =
    Object.keys(extra).length === 0
      ? base
      : base.map((p) => {
          if (!p.siren) return p;
          const e = extra[p.siren];
          if (!e) return p;
          return {
            ...p,
            dirigeants: e.dirigeants,
            siege: e.siege,
            dateCreation: e.dateCreation,
            active: e.active,
          };
        });

  return { proprietaires, annuairePret };
}

const DROIT_LIBELLE: Record<string, string> = { U: 'usufruit', N: 'nue-propriété' };

const AUDITS_HINT =
  'Base publique de l’ADEME, depuis septembre 2023. Un audit est obligatoire pour vendre une maison ou un immeuble entier classé E, F ou G, et précède les rénovations aidées : le propriétaire prépare quelque chose.';

/**
 * « Suivre cet immeuble » : un nouveau DPE, une vente ou un audit sur la
 * parcelle arrivera dans « À valider ». Invisible tant que le serveur ne
 * l'offre pas (`disponible: false`).
 */
function useSuiviImmeuble(
  parcelleId: string,
  banId: string | null,
  libelle: string | null,
  onSuiviChanged?: () => void,
) {
  const { ajouterNotification } = useNotifications();
  const [disponible, setDisponible] = useState(false);
  const [actif, setActif] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    void fetch(`/api/dashboard/immeubles-suivis?parcelle=${encodeURIComponent(parcelleId)}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { disponible?: boolean; suivi?: boolean };
        setDisponible(Boolean(data.disponible));
        setActif(Boolean(data.suivi));
      })
      .catch(() => {
        /* abandon ou réseau : le bouton reste caché */
      });
    return () => ac.abort();
  }, [parcelleId]);

  async function basculer(depart?: DOMRect | null) {
    if (enCours) return;
    const suivre = !actif;
    setEnCours(true);
    setActif(suivre);
    try {
      const res = suivre
        ? await fetch('/api/dashboard/immeubles-suivis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parcelleId, banId, libelle }),
          })
        : await fetch(`/api/dashboard/immeubles-suivis?parcelle=${encodeURIComponent(parcelleId)}`, {
            method: 'DELETE',
          });
      if (!res.ok) throw new Error('suivi');
      onSuiviChanged?.();
      if (suivre) {
        const data = (await res.json()) as { notification?: Notification | null };
        if (data.notification) ajouterNotification(data.notification);
        // Même geste que la note vers l’Accueil : le bouton part vers la cloche.
        envolerNote({ depart: depart ?? null, compte: false, cible: CIBLE_CLOCHE });
      }
      notifySuccess(
        suivre
          ? 'Immeuble suivi : un nouveau DPE, une vente ou un audit arrivera dans « À valider ».'
          : 'Vous ne suivez plus cet immeuble.',
      );
    } catch {
      setActif(!suivre);
      notifyError('Le suivi n’a pas pu être modifié');
    } finally {
      setEnCours(false);
    }
  }

  return { disponible, actif, enCours, basculer };
}

function statutProprietaire(p: ProprietaireMorale): string {
  const bits = [GENRE_LIBELLE[p.genre]];
  // Fichier DGFiP : « 1 lot · 3e étage » distingue la SCI d'un studio de celle de l'immeuble.
  if (p.nbLots) bits.push(p.nbLots === 1 ? '1 lot' : `${p.nbLots} lots`);
  const etages = decrireNiveaux(p.niveaux ?? []);
  if (etages) bits.push(etages);
  if (p.droit && DROIT_LIBELLE[p.droit]) bits.push(DROIT_LIBELLE[p.droit]!);
  if (p.active === false) bits.push('Cessée');
  else if (p.active === true) bits.push('Active');
  return bits.join(' · ');
}

function LigneProprietaire({
  p,
  annuairePret,
}: {
  p: ProprietaireMorale;
  annuairePret: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const dirigeants = p.dirigeants ?? [];
  const annee = anneeCreation(p.dateCreation);
  const estSociete = p.genre === 'sci' || p.genre === 'societe';
  const aDetails = estSociete || dirigeants.length > 0 || Boolean(p.siege) || Boolean(annee);
  const panelId = `prop-${(p.siren || p.nom).replace(/\W+/g, '').slice(0, 24)}`;

  if (!aDetails) {
    return (
      <li className={`${LIGNE} py-2.5`}>
        <span className="block truncate text-[14px] font-semibold text-text-strong">
          {toDisplayCompanyName(p.nom)}
        </span>
        <span className="block truncate text-[12.5px] text-text-muted">{statutProprietaire(p)}</span>
      </li>
    );
  }

  return (
    <li className={LIGNE}>
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={panelId}
        onClick={() => setOuvert((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2 py-2.5 text-left transition-colors hover:bg-black/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-text-strong">
            {toDisplayCompanyName(p.nom)}
          </span>
          <span className="block truncate text-[12.5px] text-text-muted">{statutProprietaire(p)}</span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2.2}
          aria-hidden
          className={`shrink-0 text-text-subtle transition-transform duration-200 ${ouvert ? 'rotate-180' : ''}`}
        />
      </button>
      {ouvert ? (
        <div id={panelId} className="pb-3">
          {dirigeants.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-subtle">
                Dirigeants
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {dirigeants.map((d) => (
                  <li key={`${d.nom}-${d.qualite ?? ''}`} className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-text-strong">
                      {toDisplayPersonName(d.nom)}
                    </span>
                    {d.qualite ? (
                      <span className="shrink-0 text-[12px] text-text-muted">{d.qualite}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : estSociete ? (
            <p className="text-[12.5px] text-text-muted">
              {annuairePret ? 'Aucun dirigeant public trouvé' : 'Chargement des dirigeants…'}
            </p>
          ) : null}
          {(annee || p.siege) && (
            <dl
              className={`space-y-1.5 text-[12.5px] ${
                dirigeants.length > 0 || estSociete ? 'mt-3 border-t border-black/[0.05] pt-2.5' : ''
              }`}
            >
              {annee ? (
                <div className="flex gap-2">
                  <dt className="w-[4.5rem] shrink-0 text-text-subtle">Création</dt>
                  <dd className="min-w-0 text-text-strong">{annee}</dd>
                </div>
              ) : null}
              {p.siege ? (
                <div className="flex gap-2">
                  <dt className="w-[4.5rem] shrink-0 text-text-subtle">Siège</dt>
                  <dd className="min-w-0 text-pretty text-text-strong">{p.siege}</dd>
                </div>
              ) : null}
            </dl>
          )}
        </div>
      ) : null}
    </li>
  );
}

function LigneEntreprise({ e }: { e: ParcelleEntreprise }) {
  const router = useRouter();
  const [etat, setEtat] = useState<'idle' | 'envoi' | 'cree'>('idle');

  async function creerContact() {
    if (etat !== 'idle') return;
    setEtat('envoi');
    try {
      const res = await fetch(`/api/dashboard/leads/${e.leadId}/promote-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: e.nom,
          phone: e.telephone,
          categorie: e.categorie,
          nafLibelle: e.activite,
        }),
      });
      const data = (await res.json()) as { contact?: { id: string }; already?: boolean; error?: string };
      if (!res.ok || !data.contact) {
        notifyError(data.error ?? 'Le contact n’a pas pu être créé');
        setEtat('idle');
        return;
      }
      setEtat('cree');
      const id = data.contact.id;
      notifySuccess(data.already ? 'Déjà dans les contacts' : 'Contact créé', {
        duration: 6000,
        action: { label: 'Ouvrir', onClick: () => router.push(`/dashboard/contacts?fiche=${id}`) },
      });
    } catch {
      notifyError('Le contact n’a pas pu être créé');
      setEtat('idle');
    }
  }

  const activite = e.activite?.trim() || immeubleCategorieLabel(e.categorie);
  return (
    <li className={`${LIGNE} py-2.5`}>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-text-strong">
            {toDisplayCompanyName(e.nom)}
          </span>
          <span className="block truncate text-[12.5px] text-text-muted">{activite}</span>
        </span>
        <BoutonAppel telephone={e.telephone} nom={e.nom} />
      </div>
      <button
        type="button"
        onClick={() => void creerContact()}
        disabled={etat !== 'idle'}
        className="mt-1 inline-flex min-h-[32px] items-center text-[12.5px] font-semibold text-primary-600 hover:text-primary-700 disabled:text-text-subtle"
      >
        {etat === 'cree' ? 'Dans vos contacts' : etat === 'envoi' ? 'Création…' : 'Ajouter à mes contacts'}
      </button>
    </li>
  );
}

function LigneLogement({ l }: { l: ParcelleLogement }) {
  const details = [
    l.consoKwhM2 != null ? `${Math.round(l.consoKwhM2)} kWh/m²/an` : null,
    l.etiquetteGes ? `GES ${l.etiquetteGes}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className={`${LIGNE} flex items-center gap-3 py-2.5`}>
      <DpeLettre lettre={l.etiquette} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[14px] ${estPassoire(l) ? 'font-semibold text-text-strong' : 'text-text'}`}>
          {decrireLogement(l)}
        </span>
        {details ? <span className="block truncate text-[12.5px] text-text-muted">{details}</span> : null}
      </span>
      <span className="shrink-0 text-[12.5px] tabular-nums text-text-subtle">
        {l.date ? moisAnnee(l.date) : 'Date inconnue'}
      </span>
    </li>
  );
}

/** Un audit : la classe d'aujourd'hui → la meilleure classe après travaux. */
function LigneAudit({ a, adresse }: { a: AuditEnergetique; adresse: string | null }) {
  const logement = [a.typologie, a.surface ? `${Math.round(a.surface)} m²` : null, formatDpeEtage(a.etage)]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className={`${LIGNE} flex items-center gap-3 py-2.5`}>
      <span className="flex shrink-0 items-center gap-1" aria-label={
        a.classeVisee ? `Classe ${a.classeActuelle ?? 'inconnue'}, ${a.classeVisee} après travaux` : undefined
      }>
        <DpeLettre lettre={a.classeActuelle} taille={24} />
        {a.classeVisee ? (
          <>
            <ArrowRight size={12} className="text-text-subtle" aria-hidden />
            <DpeLettre lettre={a.classeVisee} taille={24} />
          </>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] text-text-strong">{logement || 'Logement'}</span>
        <span className="block truncate text-[12.5px] text-text-muted">
          {a.classeVisee ? 'Travaux chiffrés' : 'État des lieux énergétique'}
          {adresse ? ` · ${adresse}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-[12.5px] tabular-nums text-text-subtle">{moisAnnee(a.date)}</span>
    </li>
  );
}

function LigneVente({ v, adresse }: { v: ParcelleVente; adresse: string | null }) {
  return (
    <li className={`${LIGNE} flex items-start gap-3 py-2.5`}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] text-text-strong">{decrireVente(v)}</span>
        <span className="block truncate text-[12.5px] text-text-muted">
          {moisAnnee(v.date)}
          {adresse ? ` · ${adresse}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[14px] font-semibold tabular-nums text-text-strong">{euros(v.prix)}</span>
        {eurosM2(v.prixM2) ? (
          <span className="block text-[12.5px] tabular-nums text-text-muted">{eurosM2(v.prixM2)}</span>
        ) : null}
      </span>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Volet                                    */
/* -------------------------------------------------------------------------- */

export default function ParcellePanel({
  fiche,
  onClose,
  onNotesChanged,
  onSuiviChanged,
  surfaceCadastreM2,
}: {
  fiche: ParcelleFiche;
  onClose: () => void;
  onNotesChanged?: () => void;
  onSuiviChanged?: () => void;
  surfaceCadastreM2?: number | null;
}) {
  const { openCapture, openCompose, captureSessionOpen } = useVoiceCapture();
  const { profile } = useUser();
  const [noteTick, setNoteTick] = useState(0);
  const [adressesOuvertes, setAdressesOuvertes] = useState(false);
  const captureWasOpen = useRef(false);

  useEffect(() => {
    if (captureSessionOpen) {
      captureWasOpen.current = true;
      return;
    }
    if (!captureWasOpen.current) return;
    captureWasOpen.current = false;
    setNoteTick((n) => n + 1);
    onNotesChanged?.();
  }, [captureSessionOpen, onNotesChanged]);

  const surface = surfaceCadastreM2 ?? fiche.surfaceCadastreM2;
  const synthese = useMemo(
    () =>
      syntheseParcelle({
        ventes: fiche.ventes,
        logements: fiche.logements,
        coproprietes: fiche.coproprietes,
        prixM2Secteur: fiche.prixM2Secteur,
        batiment: fiche.batiment,
        batimentConnu: fiche.batimentConnu,
        // Une adresse connue de la seule BDNB reste une adresse.
        adresses: Math.max(fiche.adresses.length, fiche.batiment?.adressesBan.length ?? 0),
        surfaceM2: surface,
        horsSecteur: fiche.horsSecteur,
        proprietaires: fiche.proprietaires,
        audits: fiche.audits,
      }),
    [fiche, surface],
  );

  const title = fiche.adresse ?? fiche.reference;
  // L'adresse complète et l'immeuble : la note se pose au bon endroit sans
  // regéocoder un libellé qui n'a pas toujours de code postal.
  const noteContext = {
    adresse: fiche.adresse ? [fiche.adresse, fiche.localite].filter(Boolean).join(', ') : fiche.reference,
    parcelleId: fiche.parcelleId,
    ...(fiche.banId ? { banId: fiche.banId } : {}),
  };
  const plusieursAdresses = fiche.adresses.length > 1;
  const adresseParBan = new Map(fiche.adresses.map((a) => [a.banId, a.libelle]));

  const refParcelle = fiche.reference
    ? `Parcelle ${fiche.reference}`
    : 'Parcelle sans adresse connue';
  const typeImmeuble = [
    raccourcirUsage(fiche.batiment?.usage ?? null),
    fiche.batiment?.anneeConstruction ? String(fiche.batiment.anneeConstruction) : null,
    fiche.batiment?.logements
      ? `${fiche.batiment.logements} logement${fiche.batiment.logements > 1 ? 's' : ''}`
      : null,
    fiche.localite,
  ]
    .filter(Boolean)
    .join(' · ');

  const dernierPassage = fiche.passages[0] ?? null;
  const copro = fiche.coproprietes[0] ?? null;
  const procedure = fiche.coproprietes.some((c) => c.procedureEnCours);
  const prixDit = synthese.prix ? eurosM2(synthese.prix.valeur) : null;
  const ecartDit =
    synthese.ecartSecteurPct == null
      ? null
      : `${synthese.ecartSecteurPct > 0 ? '+' : synthese.ecartSecteurPct < 0 ? '−' : ''}${Math.abs(synthese.ecartSecteurPct)} % vs le quartier`;
  // Le syndicat des copropriétaires n'est pas un vendeur : la copropriété a sa section.
  const proprietairesBase = fiche.proprietaires.filter((p) => p.genre !== 'copropriete');
  const suivi = useSuiviImmeuble(fiche.parcelleId, fiche.banId, fiche.adresse, onSuiviChanged);
  const { proprietaires, annuairePret } = useProprietairesEnrichis(
    fiche.parcelleId,
    proprietairesBase,
  );

  return (
    <div data-fiche-racine className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-shrink-0 flex-col gap-3 px-5 pb-3 pt-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div data-fiche-bloc="entete" className="min-w-0 flex-1 rounded-xl">
            <h2
              id="parcelle-title"
              className="text-balance text-[19px] font-semibold leading-snug text-text-strong"
              title={refParcelle}
            >
              {title}
            </h2>
            <p className="mt-1 text-[14px] leading-snug text-text-muted">{typeImmeuble || refParcelle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.05] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
      >
        <BriefPorte fiche={fiche} noteTick={noteTick} />
        {suivi.disponible ? (
          <button
            type="button"
            onClick={(e) => void suivi.basculer(e.currentTarget.getBoundingClientRect())}
            disabled={suivi.enCours}
            aria-pressed={suivi.actif}
            className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${
              suivi.actif ? 'bg-blue text-white' : 'bg-bg-subtle text-text-strong hover:bg-black/[0.06]'
            }`}
          >
            {suivi.actif ? <BellRing size={16} aria-hidden /> : <Bell size={16} aria-hidden />}
            {suivi.actif ? 'Immeuble suivi' : 'Suivre l’immeuble'}
          </button>
        ) : null}
        <div className="h-4" aria-hidden />
        {plusieursAdresses ? (
          <button
            type="button"
            onClick={() => setAdressesOuvertes((v) => !v)}
            aria-expanded={adressesOuvertes}
            className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {fiche.adresses.length} adresses
            <ChevronDown
              size={16}
              aria-hidden
              className={`transition-transform duration-200 ${adressesOuvertes ? 'rotate-180' : ''}`}
            />
          </button>
        ) : null}
        {adressesOuvertes ? (
          <ul className="mb-3 flex flex-col gap-1">
            {fiche.adresses.map((a) => (
              <li key={a.banId} className="truncate text-[14px] text-text">
                {a.libelle}
              </li>
            ))}
          </ul>
        ) : null}
        {fiche.horsSecteur ? (
          <p className="mb-4 text-pretty text-[14px] leading-snug text-text-muted">
            Hors de vos codes postaux : les ventes et les diagnostics publics ne s’affichent pas.
          </p>
        ) : null}

        <Section titre="Ici" bloc="ici">
          <p className="flex items-start gap-2 text-[14px] leading-snug text-text">
            <Footprints size={16} className="mt-0.5 shrink-0 text-text-subtle" aria-hidden />
            <span>
              {dernierPassage ? (
                <>
                  Dernier passage {depuisQuand(dernierPassage.jour)} · {PASSAGE_LIBELLE[dernierPassage.kind]}
                  {dernierPassage.auteur ? ` · ${dernierPassage.auteur}` : ''}
                </>
              ) : (
                'Aucun passage enregistré'
              )}
            </span>
          </p>
          <div className="mt-3">
            <NotesTerrainList
              key={`${fiche.parcelleId}:${noteTick}`}
              entiteType="parcelle"
              entiteId={fiche.parcelleId}
              currentUserId={profile?.id}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => openCapture(noteContext)}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-blue px-4 text-[15px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
            >
              <Mic size={18} strokeWidth={2.2} aria-hidden />
              Dicter une note
            </button>
            <button
              type="button"
              onClick={() => openCompose(noteContext)}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-bg-subtle px-4 text-[14px] font-semibold text-text-strong transition-colors hover:bg-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <NotebookPen size={17} aria-hidden />
              Écrire
            </button>
          </div>
        </Section>

        <Section
          titre="Qui contacter"
          bloc="contacts"
          aside={
            proprietaires.length > 0 ? (
              <InfoTooltip content={PROPRIETAIRES_HINT} placement="top-end" iconSize={14} />
            ) : fiche.entreprises.length > 0 ? (
              <InfoTooltip content={CONTACTS_LEGAL_HINT} placement="top-end" iconSize={14} />
            ) : null
          }
        >
          {proprietaires.length + fiche.entreprises.length + fiche.prospects.length + fiche.contacts.length + fiche.biens.length === 0 ? (
            <p className="text-[14px] text-text-muted">Aucun nom à contacter ici.</p>
          ) : (
            <>
              {proprietaires.length > 0 ? (
                <Depliable
                  lignes={proprietaires}
                  rendre={(p) => (
                    <LigneProprietaire
                      key={`${p.nom}-${p.siren ?? ''}`}
                      p={p}
                      annuairePret={annuairePret}
                    />
                  )}
                  libellePlus={(n) => `Voir les ${n} propriétaires`}
                />
              ) : null}
              {fiche.entreprises.length + fiche.prospects.length + fiche.contacts.length + fiche.biens.length > 0 ? (
                <ul className="flex flex-col">
                  {fiche.entreprises.map((e) => (
                    <LigneEntreprise key={`${e.nom}-${e.telephone}`} e={e} />
                  ))}
                  {fiche.prospects.map((p) => (
                    <LigneProspect key={p.id} p={p} avecAdresse={plusieursAdresses} />
                  ))}
                  {fiche.contacts.map((c) => (
                    <LigneContact key={c.id} c={c} />
                  ))}
                  {fiche.biens.map((b) => (
                    <LigneBien key={b.id} b={b} />
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </Section>

        <Section titre="Ventes" bloc="ventes">
          {prixDit ? (
            <p className="text-[15px] font-semibold tabular-nums text-text-strong">
              {prixDit}
              <span className="mt-0.5 block text-[13px] font-normal text-text-muted">
                Médiane
                {synthese.prix?.recent ? ` sur ${synthese.prix.n} ventes` : synthese.prix ? ` depuis ${synthese.prix.depuis}` : ''}
                {ecartDit ? ` · ${ecartDit}` : ''}
              </span>
            </p>
          ) : (
            <p className="text-[14px] text-text-muted">
              {synthese.pourquoi[0] ?? 'Aucune vente publiée à citer.'}
            </p>
          )}
          {synthese.ventes.length > 0 ? (
            <div className="mt-2">
              <Depliable
                lignes={synthese.ventes}
                rendre={(v, i) => (
                  <LigneVente
                    key={`${v.date}-${i}`}
                    v={v}
                    adresse={plusieursAdresses && v.banId ? adresseCourte(adresseParBan.get(v.banId) ?? '') || null : null}
                  />
                )}
                libellePlus={(n) => `Voir les ${n} ventes`}
              />
            </div>
          ) : null}
        </Section>

        {synthese.logements.length > 0 ? (
          <Repli titre="Logements et DPE" resume={resumeLogements(synthese.logements.length, synthese.passoires.length)}>
            <Repartition repartition={synthese.repartition} />
            <Depliable
              lignes={synthese.logements}
              rendre={(l, i) => <LigneLogement key={`${l.banId}-${l.date}-${i}`} l={l} />}
              libellePlus={(n) => `Voir les ${n} logements`}
            />
            <p className="mt-2 text-[12.5px] leading-snug text-text-subtle">{DPE_2026_HINT}</p>
          </Repli>
        ) : null}

        {fiche.audits.length > 0 ? (
          <Repli titre="Audits" resume={resumeAudits(fiche.audits.length)}>
            <Depliable
              lignes={fiche.audits}
              rendre={(a) => (
                <LigneAudit
                  key={a.numero}
                  a={a}
                  adresse={plusieursAdresses && a.banId ? adresseCourte(adresseParBan.get(a.banId) ?? '') || null : null}
                />
              )}
              libellePlus={(n) => `Voir les ${n} audits`}
            />
            <p className="mt-2 text-[12.5px] leading-snug text-text-subtle">{AUDITS_HINT}</p>
          </Repli>
        ) : null}

        {copro ? (
          <Repli
            titre="Copropriété"
            bloc="copropriete"
            resume={resumeCopropriete({
              lots: synthese.lots,
              periode: copro.periodeConstruction,
              procedure,
            })}
          >
            <p className="text-[14px] leading-snug text-text">
              {copro.numeroImmatriculation ? `Immatriculation ${copro.numeroImmatriculation}` : 'Registre des copropriétés'}
              {procedure ? ' · procédure en cours' : ''}
            </p>
          </Repli>
        ) : null}

        <p className="border-t border-black/[0.06] pb-2 pt-4 text-pretty text-[11.5px] leading-relaxed text-text-subtle">
          Sources : DVF (Etalab, ventes depuis janvier 2021), DPE (ADEME, depuis juillet 2021), registre des
          copropriétés (ANAH), base nationale des bâtiments (CSTB) et fichiers fonciers des personnes morales
          (DGFiP). Plan cadastral indicatif, sans
          valeur juridique.
        </p>
      </div>
    </div>
  );
}

function Barre({ className }: { className: string }) {
  return <div className={`squelette rounded-full ${className}`} />;
}

/**
 * L'attente reprend la fiche : en-tête, passage, note, contacts, prix,
 * puis trois lignes repliées.
 */
function SqueletteParcelle({
  onClose,
  reference,
  surfaceM2,
}: {
  onClose: () => void;
  reference?: string | null;
  surfaceM2?: number | null;
}) {
  const surfaceCourte =
    surfaceM2 != null ? `${new Intl.NumberFormat('fr-FR').format(surfaceM2)} m²` : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-shrink-0 flex-col gap-3 px-5 pb-3 pt-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {reference ? (
              <>
                <h2 id="parcelle-title" className="text-balance text-[19px] font-semibold leading-snug text-text-strong">
                  {reference}
                </h2>
                {surfaceCourte ? (
                  <p className="mt-1 text-[14px] text-text-muted">{surfaceCourte}</p>
                ) : (
                  <Barre className="mt-2 h-3.5 w-2/5" />
                )}
              </>
            ) : (
              <div className="squelette-bloc">
                <h2 id="parcelle-title" className="sr-only">
                  Chargement de la parcelle
                </h2>
                <Barre className="h-[19px] w-3/5" />
                <Barre className="mt-2 h-3.5 w-2/5" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.05] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-hidden px-5 sm:px-6"
        role="status"
        aria-label="Chargement de la parcelle"
      >
        <SqueletteBrief />
        <div className="mt-4 flex flex-col" aria-hidden>
          <section className="border-t border-black/[0.06] py-5">
            <Barre className="h-2.5 w-10" />
            <Barre className="mt-3 h-3.5 w-4/5" />
            <Barre className="mt-3 h-3.5 w-full" />
            <Barre className="mt-2 h-3.5 w-2/3" />
            <div className="squelette mt-3 h-11 w-full rounded-full" />
          </section>
          <section className="border-t border-black/[0.06] py-5">
            <Barre className="h-2.5 w-24" />
            <div className="mt-3 flex flex-col gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Barre className="h-3.5 flex-1" />
                  <Barre className="h-3 w-16" />
                </div>
              ))}
            </div>
          </section>
          <section className="border-t border-black/[0.06] py-5">
            <Barre className="h-2.5 w-14" />
            <Barre className="mt-3 h-4 w-28" />
            <Barre className="mt-2 h-3.5 w-3/5" />
          </section>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex min-h-11 items-center justify-between border-t border-black/[0.06]">
              <div className="min-w-0 flex-1">
                <Barre className="h-2.5 w-16" />
                <Barre className="mt-2 h-3.5 w-40" />
              </div>
              <Barre className="size-4 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type ParcelleDrawerProps = {
  fiche: ParcelleFiche | null;
  loading: boolean;
  onClose: () => void;
  onNotesChanged?: () => void;
  onSuiviChanged?: () => void;
};

/**
 * Volet parcelle : ancré dans la carte (pas en portal plein écran),
 * pour rester dans le cadre arrondi du workspace.
 */
export function ParcelleDrawer(props: ParcelleDrawerProps) {
  const open = Boolean(props.fiche) || props.loading;
  if (!open) return null;
  return <VoletParcelle key={props.fiche?.parcelleId ?? 'parcelle'} {...props} />;
}

function VoletParcelle({ fiche, loading, onClose, onNotesChanged, onSuiviChanged }: ParcelleDrawerProps) {
  const [entered, setEntered] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const enter = window.setTimeout(() => setEntered(true), 16);
    const settle = window.setTimeout(() => setSettled(true), 220);
    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(settle);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Une fiche encore en vol : en-tête connu tout de suite, corps en squelette.
  // Cache hit : contenu immédiat (loading=false).
  const prete = fiche && !loading;

  return (
    <>
      {/* Assombrit sans bloquer : la carte reste cliquable (y compris à droite hors volet). */}
      <div
        role="presentation"
        className={`pointer-events-none absolute inset-0 z-40 rounded-[32px] transition-opacity duration-fluid-subtle ease-in-out ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ backgroundColor: 'rgba(26, 42, 86, 0.14)' }}
        aria-hidden
      />
      <aside
        className={`absolute z-50 flex flex-col overflow-hidden bg-white inset-x-0 bottom-0 top-[28%] rounded-t-[28px] md:inset-y-0 md:left-0 md:right-auto md:top-0 md:max-w-[min(100%,420px)] md:rounded-[32px] ${
          settled
            ? ''
            : `transition-transform duration-fluid ease-in-out ${
                entered
                  ? 'translate-y-0 md:translate-x-0'
                  : 'translate-y-full md:translate-y-0 md:-translate-x-full'
              }`
        }`}
        style={{
          boxShadow: '8px 0 28px rgba(26, 42, 86, 0.14)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="parcelle-title"
        onClick={(e) => e.stopPropagation()}
      >
        {prete ? (
          <ParcellePanel
            fiche={fiche}
            onClose={onClose}
            onNotesChanged={onNotesChanged}
            onSuiviChanged={onSuiviChanged}
          />
        ) : (
          <SqueletteParcelle
            onClose={onClose}
            reference={fiche?.reference}
            surfaceM2={fiche?.surfaceCadastreM2}
          />
        )}
      </aside>
    </>
  );
}
