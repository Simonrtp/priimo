'use client';

import { useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  FileText,
  Home,
  Link2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Target,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ContactType } from '@/types/contact';
import { CONTACT_TYPE_LABELS } from '@/types/contact';
import { validateContactFields, type ContactFieldErrors, type ContactInputFields } from '@/lib/contact-input';
import { formatPhoneOrNull } from '@/lib/import/normalize';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import ContactFormFields, { type ContactFormGeo } from '@/components/dashboard/contacts/ContactFormFields';
import SignalIA from '@/components/ui/SignalIA';
import styles from './live/dictee.module.css';

/* -------------------------------------------------------------------------- */
/* Carte                                                                       */
/* -------------------------------------------------------------------------- */

export type LienCarte = {
  key: string;
  kind: 'note' | 'adresse' | 'bien' | 'prospect' | 'personne';
  label: string;
  /** Ce que le lien veut dire, quand ce n'est pas évident : « Propriétaire ». */
  prefixe?: string | null;
  /** Apporté par cette note : la fiche ne l'avait pas. */
  nouveau?: boolean;
  onRetirer?: () => void;
};

const ICONE_LIEN: Record<LienCarte['kind'], LucideIcon> = {
  note: FileText,
  adresse: MapPin,
  bien: Home,
  prospect: Target,
  personne: UserRound,
};

function initiales(nom: string): string {
  const mots = nom
    .replace(/^(m\.|mme|mlle|monsieur|madame)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return ((mots[0]?.[0] ?? '') + (mots[1]?.[0] ?? '')).toUpperCase() || '?';
}

function Coordonnee({
  icone: Icone,
  valeur,
  manque,
  nouveau,
  onCompleter,
}: {
  icone: LucideIcon;
  valeur: string | null;
  manque: string;
  nouveau?: boolean;
  onCompleter: () => void;
}) {
  if (!valeur) {
    return (
      <button
        type="button"
        onClick={onCompleter}
        className="flex min-h-7 items-center gap-2 text-left text-[13px] text-text-subtle transition-colors hover:text-text"
      >
        <Icone size={14} strokeWidth={2} aria-hidden className="shrink-0" />
        {manque}
      </button>
    );
  }
  return (
    <p className="flex min-h-7 min-w-0 items-center gap-2 text-[13.5px] text-text-strong">
      <Icone size={14} strokeWidth={2} aria-hidden className="shrink-0 text-text-subtle" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{valeur}</span>
      {nouveau ? <MarqueNouveau /> : null}
    </p>
  );
}

function MarqueNouveau() {
  return (
    <span className="shrink-0 rounded-full bg-primary-50 px-1.5 text-[10.5px] font-bold uppercase tracking-wide text-primary-600">
      Nouveau
    </span>
  );
}

export type CandidatFiche = {
  id: string;
  label: string;
  detail: string | null;
};

export type AdresseRaccordee = {
  label: string;
  nouveau?: boolean;
  edition: boolean;
  onEditer: () => void;
  onRetirer: () => void;
  /** Champ BAN quand `edition` est vrai. */
  champ?: ReactNode;
};

/**
 * Une fiche existante que l'IA croit reconnaître : rien n'est rattaché tant
 * que l'agent n'a pas confirmé que c'est la bonne personne.
 */
export type SuggestionFiche = {
  candidats: readonly CandidatFiche[];
  /** La fiche cochée ; `null` = une autre personne, nouvelle fiche. */
  candidatId: string | null;
  onChoisir: (id: string | null) => void;
  onRattacher: () => void;
};

/**
 * La personne dont parle la note, telle qu'elle sera rangée : ses rôles, ses
 * coordonnées, et tout ce à quoi la note la relie. Le crayon ouvre la fiche
 * entière ; une croix sur un lien le défait.
 *
 * Avec `suggestion`, la carte demande d'abord : « c'est bien elle ? ».
 */
export function CarteContactNote({
  nom,
  existante,
  relation,
  roles,
  rolesNouveaux,
  phone,
  phoneNouveau,
  email,
  emailNouveau,
  liens,
  adresse,
  suggestion,
  onChangerFiche,
  onModifier,
  onRetirer,
  onLier,
  lierOuvert,
  recherche,
}: {
  nom: string;
  existante: boolean;
  /** Ce que la note dit de son lien avec une autre personne : « Sœur de Simon ». */
  relation?: string | null;
  roles: readonly ContactType[];
  rolesNouveaux: readonly ContactType[];
  phone: string | null;
  phoneNouveau?: boolean;
  email: string | null;
  emailNouveau?: boolean;
  liens: readonly LienCarte[];
  /** Adresse de la note : première capsule de « Liée à », modifiable. */
  adresse?: AdresseRaccordee | null;
  suggestion?: SuggestionFiche | null;
  /** Fiche existante confirmée : revenir au choix. */
  onChangerFiche?: () => void;
  onModifier: () => void;
  onRetirer: () => void;
  onLier: () => void;
  lierOuvert: boolean;
  /** Le champ de recherche « Lier à… », affiché sous les liens. */
  recherche?: ReactNode;
}) {
  if (suggestion) {
    return (
      <CarteSuggestion nom={nom} relation={relation} suggestion={suggestion} onRetirer={onRetirer} />
    );
  }

  const rolesUtiles = roles.filter((r) => r !== 'autre');
  return (
    <li
      className={`overflow-hidden rounded-2xl border border-black/[0.06] bg-surface shadow-clay-sm ${styles.carteEntree}`}
    >
      <div className="flex items-start gap-3 px-3.5 pb-3 pt-3.5">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[14px] font-semibold text-primary-700"
        >
          {initiales(nom)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-semibold leading-tight text-text-strong">{nom}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-text-muted">
            <span>{relation ? relationLisible(relation) : existante ? 'Déjà dans vos contacts' : 'Nouveau contact'}</span>
            {existante && onChangerFiche ? (
              <button
                type="button"
                onClick={onChangerFiche}
                className="font-semibold text-ia-600 underline-offset-2 hover:underline"
              >
                Pas la bonne fiche ?
              </button>
            ) : null}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {rolesUtiles.length === 0 ? (
              <button
                type="button"
                onClick={onModifier}
                className="inline-flex h-7 items-center rounded-full border border-dashed border-black/15 px-2.5 text-[12px] font-medium text-text-muted"
              >
                Rôle à préciser
              </button>
            ) : (
              rolesUtiles.map((r) => {
                const nouveau = rolesNouveaux.includes(r);
                return (
                  <span
                    key={r}
                    className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold ${
                      nouveau ? 'bg-primary-500 text-white' : 'bg-[#D5D8E4] text-[#1A2A56]'
                    }`}
                  >
                    {nouveau ? <Plus size={12} strokeWidth={2.8} aria-label="Ajouté par la note" /> : null}
                    {CONTACT_TYPE_LABELS[r]}
                  </span>
                );
              })
            )}
          </div>

          <div className="mt-2 flex flex-col">
            <Coordonnee
              icone={Phone}
              valeur={formatPhoneOrNull(phone)}
              manque="Ajouter un téléphone"
              nouveau={phoneNouveau}
              onCompleter={onModifier}
            />
            <Coordonnee
              icone={Mail}
              valeur={email}
              manque="Ajouter un e-mail"
              nouveau={emailNouveau}
              onCompleter={onModifier}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onModifier}
            aria-label={`Modifier la fiche de ${nom}`}
            className="flex size-10 items-center justify-center rounded-full bg-bg-subtle text-text-strong transition-colors hover:bg-primary-50 hover:text-primary-700 active:scale-95"
          >
            <Pencil size={16} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRetirer}
            aria-label={`Ne pas ranger ${nom} avec la note`}
            className="flex size-8 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text"
          >
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      {/* Tout ce à quoi la note relie la personne : l'adresse d'abord. */}
      <div className="border-t border-black/[0.06] bg-bg-subtle px-3.5 py-2.5">
        <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-subtle">Liée à</p>
        <ul className="flex flex-wrap gap-1.5">
          {adresse && !adresse.edition ? (
            <li className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-surface pl-2.5 pr-1 text-[12.5px] font-medium text-text shadow-clay-sm">
              <MapPin size={13} strokeWidth={2.2} aria-hidden className="shrink-0" />
              <span className="min-w-0 truncate">{adresse.label}</span>
              {adresse.nouveau ? <MarqueNouveau /> : null}
              <button
                type="button"
                onClick={adresse.onEditer}
                aria-label="Modifier l’adresse"
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-black/[0.06] hover:text-text"
              >
                <Pencil size={11} strokeWidth={2.4} aria-hidden />
              </button>
              <button
                type="button"
                onClick={adresse.onRetirer}
                aria-label="Retirer l’adresse"
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-black/[0.06] hover:text-text"
              >
                <X size={12} strokeWidth={2.4} aria-hidden />
              </button>
            </li>
          ) : null}
          {liens.map((l) => {
            const Icone = ICONE_LIEN[l.kind];
            return (
              <li
                key={l.key}
                className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-full pl-2.5 text-[12.5px] font-medium ${
                  l.onRetirer ? 'pr-1' : 'pr-3'
                } ${l.nouveau ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200' : 'bg-surface text-text shadow-clay-sm'}`}
              >
                <Icone size={13} strokeWidth={2.2} aria-hidden className="shrink-0" />
                <span className="min-w-0 truncate">
                  {l.prefixe ? <span className="text-text-muted">{l.prefixe} · </span> : null}
                  {l.label}
                </span>
                {l.onRetirer ? (
                  <button
                    type="button"
                    onClick={l.onRetirer}
                    aria-label={`Défaire le lien : ${l.label}`}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-black/[0.06] hover:text-text"
                  >
                    <X size={12} strokeWidth={2.4} aria-hidden />
                  </button>
                ) : null}
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={onLier}
              aria-expanded={lierOuvert}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-black/15 px-2.5 text-[12.5px] font-medium text-text-muted transition-colors hover:border-primary-200 hover:text-primary-700"
            >
              <Plus size={13} strokeWidth={2.4} aria-hidden />
              Lier
            </button>
          </li>
        </ul>
        {adresse?.edition && adresse.champ ? <div className="mt-2.5">{adresse.champ}</div> : null}
        {lierOuvert && recherche ? <div className="mt-2.5">{recherche}</div> : null}
      </div>
    </li>
  );
}

/** « sœur de Simon » → « Sœur de Simon ». */
function relationLisible(relation: string): string {
  const t = relation.trim();
  return t ? t[0]!.toLocaleUpperCase('fr') + t.slice(1) : t;
}

/**
 * L'IA croit reconnaître une fiche : l'agent vérifie (téléphone, adresse) et
 * confirme. Tant qu'il n'a pas touché « Rattacher à cette note », rien n'est
 * relié ni créé.
 */
function CarteSuggestion({
  nom,
  relation,
  suggestion,
  onRetirer,
}: {
  nom: string;
  relation?: string | null;
  suggestion: SuggestionFiche;
  onRetirer: () => void;
}) {
  const { candidats, candidatId, onChoisir, onRattacher } = suggestion;
  const plusieurs = candidats.length > 1;
  return (
    <li
      className={`overflow-hidden rounded-2xl border border-ia-200 bg-surface shadow-clay-sm ${styles.carteEntree}`}
    >
      <div className="flex items-start gap-3 px-3.5 pb-2.5 pt-3.5">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-ia-200 bg-ia-50 text-[14px] font-semibold text-ia-700"
        >
          {initiales(nom)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-semibold leading-tight text-text-strong">{nom}</p>
          {relation ? (
            <p className="mt-0.5 text-[12px] text-text-muted">{relationLisible(relation)}</p>
          ) : null}
          <div className="mt-1.5">
            <SignalIA>{plusieurs ? `${candidats.length} fiches possibles` : 'Fiche existante reconnue'}</SignalIA>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetirer}
          aria-label={`Ne pas ranger ${nom} avec la note`}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text"
        >
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="px-3.5 pb-3.5" role="radiogroup" aria-label={`Quelle fiche pour ${nom} ?`}>
        <p className="mb-2 text-[13px] font-medium text-text-strong">
          {plusieurs ? 'De qui parlez-vous ?' : 'C’est bien cette personne ?'}
        </p>
        <ul className="flex flex-col gap-1.5">
          {candidats.map((c) => (
            <OptionFiche
              key={c.id}
              choisi={candidatId === c.id}
              onChoisir={() => onChoisir(c.id)}
              titre={c.label}
              detail={c.detail ?? 'Fiche existante'}
            />
          ))}
          <OptionFiche
            choisi={candidatId === null}
            onChoisir={() => onChoisir(null)}
            titre="Une autre personne"
            detail="Créer une nouvelle fiche"
          />
        </ul>
        <button
          type="button"
          onClick={onRattacher}
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ia text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(99,102,241,0.28)] transition-transform hover:bg-ia-600 active:scale-[0.98]"
        >
          <Link2 size={16} strokeWidth={2.2} aria-hidden />
          {candidatId === null ? 'Créer et rattacher à cette note' : 'Rattacher à cette note'}
        </button>
      </div>
    </li>
  );
}

function OptionFiche({
  choisi,
  onChoisir,
  titre,
  detail,
}: {
  choisi: boolean;
  onChoisir: () => void;
  titre: string;
  detail: string;
}) {
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={choisi}
        onClick={onChoisir}
        className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
          choisi ? 'bg-ia-50 ring-1 ring-ia-200' : 'bg-bg-subtle hover:bg-black/[0.04]'
        }`}
      >
        <span
          aria-hidden
          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
            choisi ? 'border-ia bg-ia' : 'border-black/20 bg-surface'
          }`}
        >
          {choisi ? <span className="size-1.5 rounded-full bg-white" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-text-strong">{titre}</span>
          <span className="mt-0.5 block truncate text-[12px] text-text-muted">{detail}</span>
        </span>
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Éditeur : la fiche entière                                                  */
/* -------------------------------------------------------------------------- */

export type FicheEditee = {
  fields: ContactInputFields;
  assignedTo: string | null;
  geo: ContactFormGeo;
};

/**
 * La fiche complète, champs remplis et champs vides, par-dessus la note : en
 * plein écran sur téléphone, en fenêtre ailleurs. Rien ne part en base ici —
 * la fiche s'enregistre avec la note, quand l'agent range.
 */
export function EditeurFicheContact({
  nom,
  existante,
  initial,
  chargement,
  erreurChargement,
  rolesNouveaux,
  members,
  currentUserId,
  idPrefix,
  onFermer,
  onValider,
  onReessayer,
}: {
  nom: string;
  existante: boolean;
  initial: FicheEditee | null;
  chargement: boolean;
  erreurChargement: string | null;
  /** Relancer la lecture de la fiche après un échec. */
  onReessayer?: () => void;
  rolesNouveaux: readonly ContactType[];
  members: readonly AssigneeOption[];
  currentUserId?: string;
  idPrefix: string;
  onFermer: () => void;
  onValider: (fiche: FicheEditee) => void;
}) {
  const [fiche, setFiche] = useState<FicheEditee | null>(initial);
  const [erreurs, setErreurs] = useState<ContactFieldErrors>({});
  const [resume, setResume] = useState<string | null>(null);
  // La fiche existante arrive après l'ouverture : on la prend dès qu'elle est là.
  const [initialVu, setInitialVu] = useState(initial);
  if (initial !== initialVu) {
    setInitialVu(initial);
    setFiche(initial);
  }

  function valider() {
    if (!fiche) return;
    const v = validateContactFields(fiche.fields);
    if (!v.ok) {
      setErreurs(v.errors);
      setResume(v.summary);
      return;
    }
    onValider(fiche);
  }

  const titre = [fiche?.fields.firstName, fiche?.fields.lastName].filter(Boolean).join(' ') || nom;

  return (
    <div
      className="fixed inset-0 z-[240] flex items-end justify-center bg-[rgba(26,42,86,0.42)] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Fiche de ${titre}`}
    >
      <div className="animate-app-sheet flex h-[100dvh] w-full flex-col overflow-hidden bg-surface shadow-clay-lg sm:h-auto sm:max-h-[88vh] sm:max-w-xl sm:rounded-clay-xl">
        <header
          className="flex flex-shrink-0 items-center gap-2 border-b border-black/[0.06] px-3 pb-3"
          style={{ paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}
        >
          <button
            type="button"
            onClick={onFermer}
            aria-label="Revenir à la note"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-text-strong transition-colors hover:bg-black/[0.04]"
          >
            <ArrowLeft size={20} strokeWidth={2} aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-text-muted">{existante ? 'Fiche du contact' : 'Nouvelle fiche'}</p>
            <h2 className="truncate font-display text-[17px] font-semibold text-text-strong">{titre}</h2>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {chargement || !fiche ? (
            erreurChargement ? (
              <div className="flex flex-col items-start gap-3 rounded-2xl bg-bg-subtle px-4 py-3">
                <p className="text-[14px] text-text-muted">{erreurChargement}</p>
                {onReessayer ? (
                  <button
                    type="button"
                    onClick={onReessayer}
                    className="inline-flex h-9 items-center rounded-full bg-surface px-3.5 text-[13px] font-semibold text-text-strong shadow-clay-sm"
                  >
                    Réessayer
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-4" aria-busy="true" aria-label="Chargement de la fiche">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-bg-subtle" />
                ))}
              </div>
            )
          ) : (
            <ContactFormFields
              idPrefix={idPrefix}
              fields={fiche.fields}
              onFields={(fields) => {
                setFiche((f) => (f ? { ...f, fields } : f));
                if (resume) {
                  setErreurs({});
                  setResume(null);
                }
              }}
              assignedTo={fiche.assignedTo}
              onAssignedTo={(assignedTo) => setFiche((f) => (f ? { ...f, assignedTo } : f))}
              geo={fiche.geo}
              onGeo={(geo) => setFiche((f) => (f ? { ...f, geo } : f))}
              members={members}
              currentUserId={currentUserId}
              fieldErrors={erreurs}
              rolesNouveaux={rolesNouveaux}
            />
          )}
        </div>

        <footer
          className="flex-shrink-0 border-t border-black/[0.06] px-5 pt-3"
          style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
        >
          {resume ? (
            <p role="alert" className="mb-2 text-[13px] font-medium text-danger">
              {resume}
            </p>
          ) : null}
          <button
            type="button"
            onClick={valider}
            disabled={!fiche}
            className="h-12 w-full rounded-full bg-primary-500 text-[15px] font-semibold text-white shadow-clay-primary transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            Valider la fiche
          </button>
          <p className="mt-2 text-center text-[12px] text-text-subtle">
            Elle s’enregistre quand vous rangez la note.
          </p>
        </footer>
      </div>
    </div>
  );
}
