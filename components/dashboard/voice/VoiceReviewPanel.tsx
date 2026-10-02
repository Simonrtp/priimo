'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, Link2, Lock, Mic, Pencil, X } from 'lucide-react';
import type { VoiceNoteVisibilite } from '@/types/contact';
import { CONTACT_TYPE_LABELS } from '@/types/contact';
import type { NoteReviewPayload, PersonneProposal } from '@/lib/notes/build-review';
import type { ActionProposal } from '@/lib/notes/review-v2';
import { libelleMiseAJour, lignesRecherche, mailtoBrouillon } from '@/lib/notes/review-v2';
import { EMPTY_CONTACT_INPUT, type ContactInputFields } from '@/lib/contact-input';
import { formatPhoneOrNull, normalizeName } from '@/lib/import/normalize';
import type { ContactMatch } from '@/lib/notes/match';
import { matchMembersInTranscript } from '@/lib/notes/from-transcript';
import { dateParisIso } from '@/lib/notes/date-relative';
import { heureLisible, jourLisible, type CarteComprise, type CarteKind } from '@/lib/voice/cartes';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import ContactFormFields, { type ContactFormGeo } from '@/components/dashboard/contacts/ContactFormFields';
import NoteEntitySearch, { type NoteLinkPick } from '@/components/dashboard/notes/NoteEntitySearch';
import NoteMentionSensible from '@/components/dashboard/notes/NoteMentionSensible';
import IconeCarte from './live/IconeCarte';
import styles from './live/dictee.module.css';

type ManualLink = NoteLinkPick & { key: string };

function pickMatch(matches: readonly ContactMatch[]): ContactMatch | null {
  return matches.find((m) => m.confiance === 'certain') ?? matches[0] ?? null;
}

type ContactDraft = { fields: ContactInputFields; assignedTo: string | null; geo: ContactFormGeo };

function draftDepuisProposition(
  p: PersonneProposal,
  review: NoteReviewPayload,
  transcript: string,
  assignee: string | null,
): ContactDraft {
  return {
    fields: {
      ...EMPTY_CONTACT_INPUT,
      firstName: p.personne.firstName,
      lastName: p.personne.lastName,
      type: p.personne.type,
      phone: p.personne.phone,
      email: p.personne.email,
      address: review.immeuble?.adresseNormalisee ?? review.immeuble?.address ?? null,
      secteur: review.secteur,
      summary: transcript.trim() || null,
    },
    assignedTo: assignee,
    geo: { banId: review.immeuble?.banId ?? null, latitude: null, longitude: null },
  };
}

/** Les critères dictés remplissent la fiche d'un nouvel acquéreur, sans écraser ce que l'agent a saisi. */
function avecRecherche(fields: ContactInputFields, r: NoteReviewPayload['recherche']): ContactInputFields {
  if (!r) return fields;
  return {
    ...fields,
    type: fields.type === 'autre' ? 'acquereur' : fields.type,
    budgetMin: fields.budgetMin ?? r.budgetMin,
    budgetMax: fields.budgetMax ?? r.budgetMax,
    surfaceMin: fields.surfaceMin ?? r.surfaceMin,
    roomsMin: fields.roomsMin ?? r.roomsMin,
    postalCodes: fields.postalCodes.length ? fields.postalCodes : r.codesPostaux,
  };
}

function kindAction(a: ActionProposal): CarteKind {
  return a.type === 'rdv' ? 'rdv' : a.type === 'visite_faite' ? 'visite' : a.type === 'rappel' ? 'rappel' : 'tache';
}

function euros(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} €`;
}

/* -------------------------------------------------------------------------- */
/* Une ligne : icône, ce qui a été compris, croix pour retirer                 */
/* -------------------------------------------------------------------------- */

function Ligne({
  kind,
  titre,
  detail,
  avertissement,
  actif,
  onActif,
  ouvert,
  onOuvrir,
  children,
}: {
  kind: CarteKind;
  titre: string;
  detail?: string | null;
  avertissement?: boolean;
  /** `undefined` : simple information, sans croix. */
  actif?: boolean;
  onActif?: (v: boolean) => void;
  ouvert?: boolean;
  onOuvrir?: () => void;
  children?: React.ReactNode;
}) {
  if (actif === false) return null;
  return (
    <li className={`rounded-2xl border border-black/[0.06] bg-surface shadow-clay-sm ${styles.carteEntree}`}>
      <div
        className={`flex items-center gap-3 px-3 py-2.5 ${onOuvrir ? 'cursor-pointer' : ''}`}
        onClick={onOuvrir}
        role={onOuvrir ? 'button' : undefined}
        aria-expanded={onOuvrir ? Boolean(ouvert) : undefined}
        tabIndex={onOuvrir ? 0 : undefined}
        onKeyDown={(e) => {
          if (onOuvrir && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOuvrir();
          }
        }}
      >
        <IconeCarte kind={kind} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-text-strong">{titre}</span>
          {detail ? (
            <span className={`block truncate text-[12.5px] ${avertissement ? 'text-warning' : 'text-text-muted'}`}>
              {detail}
            </span>
          ) : null}
        </span>
        {actif !== undefined && onActif ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onActif(false);
            }}
            aria-label={`Retirer : ${titre}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text"
          >
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
      {ouvert && children ? <div className="border-t border-black/[0.06] px-3 pb-3 pt-3">{children}</div> : null}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Panneau                                                                     */
/* -------------------------------------------------------------------------- */

export type PlanRangement = Record<string, unknown>;

export default function VoiceReviewPanel({
  review,
  transcript,
  onTranscript,
  onTexteCorrige,
  onReviewChange,
  onToucher,
  members,
  currentUserId,
  suggestedAssigneeId,
  onContinue,
  onRanger,
  onQuestion,
  lecture = false,
  transcriptionEnCours = false,
  cartesEnAttente = [],
  typed = false,
}: {
  review: NoteReviewPayload;
  transcript: string;
  onTranscript: (v: string) => void;
  /** L'agent a fini de corriger le texte : Priimo le relit. */
  onTexteCorrige?: () => void;
  onReviewChange: (review: NoteReviewPayload) => void;
  /** L'agent a corrigé quelque chose : les lectures suivantes n'écrasent plus rien. */
  onToucher: () => void;
  members: readonly AssigneeOption[];
  currentUserId?: string;
  suggestedAssigneeId: string | null;
  onContinue?: () => void;
  /** `depart` : le bouton touché, d'où la note s'envole vers sa destination. */
  onRanger: (plan: PlanRangement, depart?: DOMRect) => void;
  onQuestion?: (question: string) => void;
  /** Une lecture de la note est en cours. */
  lecture?: boolean;
  /** L'audio part au serveur : la transcription finale n'est pas encore revenue. */
  transcriptionEnCours?: boolean;
  /** Ce que le téléphone a déjà repéré, en attendant la lecture. */
  cartesEnAttente?: readonly CarteComprise[];
  typed?: boolean;
}) {
  const [visibilite, setVisibilite] = useState<VoiceNoteVisibilite>(review.visibilite);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [manualLinks, setManualLinks] = useState<ManualLink[]>([]);
  const [hiddenConseillers, setHiddenConseillers] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ContactDraft>>({});
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [edition, setEdition] = useState(false);
  const [rattacher, setRattacher] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const texteAvantEdition = useRef('');

  function toucher() {
    onToucher();
  }
  function basculer(id: string) {
    setOuvert((o) => (o === id ? null : id));
  }
  function cacher(id: string, cache: boolean) {
    toucher();
    setHiddenIds((h) => (cache ? [...h, id] : h.filter((x) => x !== id)));
  }
  function changer(next: NoteReviewPayload) {
    toucher();
    onReviewChange(next);
  }

  // Une note analysée avant les actions multiples porte parfois une relance :
  // elle devient une action comme les autres, et donc une carte sur l'accueil.
  const actions = useMemo<ActionProposal[]>(() => {
    if (review.actions.length > 0 || !review.relance) return review.actions;
    return [
      {
        id: 'a-relance',
        type: 'rappel',
        intitule: review.relance.libelle,
        date: dateParisIso(new Date(review.relance.at)),
        dateDeduite: false,
        heure: null,
        personne: null,
        personneRef: review.personnes[0]?.id ?? null,
        lieu: null,
        rdvType: null,
        interet: null,
        accepted: true,
      },
    ];
  }, [review.actions, review.relance, review.personnes]);

  const conseillers = useMemo(
    () => matchMembersInTranscript(transcript, members).filter((m) => m.memberId !== currentUserId),
    [transcript, members, currentUserId],
  );
  const nomsConseillers = useMemo(() => new Set(conseillers.map((m) => normalizeName(m.label))), [conseillers]);
  const conseillersRetenus = conseillers.filter((c) => !hiddenConseillers.includes(c.memberId));

  const personnes = review.personnes.filter(
    (p) =>
      !nomsConseillers.has(normalizeName(`${p.personne.firstName} ${p.personne.lastName}`.trim())) &&
      Boolean(p.matches.length || p.personne.firstName.trim() || p.personne.lastName.trim() || p.personne.phone),
  );

  function draftPour(p: PersonneProposal): ContactDraft {
    return drafts[p.id] ?? draftDepuisProposition(p, review, transcript, suggestedAssigneeId ?? currentUserId ?? null);
  }

  function setAction(id: string, patch: Partial<ActionProposal>) {
    changer({ ...review, actions: actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  }

  /* --------------------------------------------------------------- Rangement */

  function ranger(depart?: DOMRect) {
    if (envoye) return;
    setEnvoye(true);
    const conseiller = conseillersRetenus[0]?.memberId ?? null;
    const bienUnique =
      review.biens.length === 1 && !hiddenIds.includes(`bien-${review.biens[0]!.id}`) ? review.biens[0]!.id : null;

    const planPersonnes = personnes
      .filter((p) => !hiddenIds.includes(p.id))
      .map((p) => {
        const match = pickMatch(p.matches);
        if (match) return { ref: p.id, contactId: match.contactId, confiance: match.confiance };
        const draft = draftPour(p);
        const nom = `${draft.fields.firstName}${draft.fields.lastName}${draft.fields.phone ?? ''}`.trim();
        if (!nom) return null;
        const recherche = review.recherche?.accepted && review.recherche.personneRef === p.id ? review.recherche : null;
        return {
          ref: p.id,
          creer: {
            ...avecRecherche(draft.fields, recherche),
            assignedTo: draft.assignedTo ?? conseiller ?? currentUserId ?? null,
            banId: draft.geo.banId,
            latitude: draft.geo.latitude,
            longitude: draft.geo.longitude,
          },
        };
      })
      .filter(Boolean);

    const liens: { entiteType: string; entiteId: string; confiance: string }[] = [];
    for (const l of manualLinks) liens.push({ entiteType: l.entiteType, entiteId: l.entiteId, confiance: 'certain' });
    for (const b of review.biens) {
      if (!hiddenIds.includes(`bien-${b.id}`)) liens.push({ entiteType: 'bien', entiteId: b.id, confiance: 'probable' });
    }
    for (const l of review.leads) {
      if (!hiddenIds.includes(`lead-${l.id}`)) liens.push({ entiteType: 'lead', entiteId: l.id, confiance: 'certain' });
    }
    if (review.immeuble?.banId && review.immeuble.confiance && !hiddenIds.includes('immeuble')) {
      liens.push({ entiteType: 'immeuble', entiteId: review.immeuble.banId, confiance: review.immeuble.confiance });
    }

    onRanger({
      transcript: transcript.trim(),
      visibilite,
      sourceInfo: review.sourceInfo,
      assignedTo: conseiller,
      personnes: planPersonnes,
      liens,
      actions: actions
        .filter((a) => a.accepted)
        .map((a) => ({
          type: a.type,
          intitule: a.intitule,
          date: a.date,
          heure: a.heure,
          lieu: a.lieu,
          rdvType: a.rdvType,
          interet: a.interet,
          personneRef: a.personneRef,
          bienId: bienUnique,
          assignedTo: a.type === 'rdv' ? currentUserId : conseiller ?? currentUserId,
        })),
      misesAJour: review.misesAJour
        .filter((m) => m.accepted)
        .map((m) => ({ bienId: m.bienId, champ: m.champ, valeur: m.apres })),
      recherche: review.recherche?.accepted
        ? {
            personneRef: review.recherche.personneRef,
            budgetMin: review.recherche.budgetMin,
            budgetMax: review.recherche.budgetMax,
            surfaceMin: review.recherche.surfaceMin,
            roomsMin: review.recherche.roomsMin,
            codesPostaux: review.recherche.codesPostaux,
          }
        : null,
      prospect: review.prospect?.accepted
        ? { leadId: review.prospect.leadId, stageId: review.prospect.stageId, motif: review.prospect.motif }
        : null,
    }, depart);
  }

  /* ------------------------------------------------------------------ Rendu */

  const caracteristiques = [
    review.rooms ? (review.rooms <= 7 ? `T${review.rooms}` : `${review.rooms} pièces`) : null,
    review.surface ? `${review.surface} m²` : null,
    review.prix ? euros(review.prix) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const lignes: React.ReactNode[] = [];

  for (const p of personnes) {
    const match = pickMatch(p.matches);
    const draft = draftPour(p);
    const nom =
      match?.label ||
      [draft.fields.firstName, draft.fields.lastName].filter(Boolean).join(' ') ||
      formatPhoneOrNull(draft.fields.phone) ||
      'Contact';
    const type = p.personne.type !== 'autre' ? CONTACT_TYPE_LABELS[p.personne.type] : null;
    lignes.push(
      <Ligne
        key={`p-${p.id}`}
        kind="personne"
        titre={nom}
        detail={[match ? 'Déjà dans vos contacts' : 'Nouveau contact', type].filter(Boolean).join(' · ')}
        actif={!hiddenIds.includes(p.id)}
        onActif={(v) => cacher(p.id, !v)}
        ouvert={!match && ouvert === p.id}
        onOuvrir={match ? undefined : () => basculer(p.id)}
      >
        <ContactFormFields
          idPrefix={`voice-${p.id}`}
          fields={draft.fields}
          onFields={(fields) => {
            toucher();
            setDrafts((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? draft), fields } }));
          }}
          assignedTo={draft.assignedTo}
          onAssignedTo={(assignedTo) => setDrafts((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? draft), assignedTo } }))}
          geo={draft.geo}
          onGeo={(geo) => setDrafts((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? draft), geo } }))}
          members={members}
          currentUserId={currentUserId}
        />
      </Ligne>,
    );
  }

  if (review.recherche) {
    const r = review.recherche;
    const n = r.correspondances.length;
    lignes.push(
      <Ligne
        key="recherche"
        kind="recherche"
        titre={`Recherche · ${lignesRecherche(r).join(' · ') || 'à préciser'}`}
        detail={n ? `${n} bien${n > 1 ? 's' : ''} de l’agence correspond${n > 1 ? 'ent' : ''}` : null}
        actif={r.accepted}
        onActif={(v) => changer({ ...review, recherche: { ...r, accepted: v } })}
        ouvert={ouvert === 'recherche'}
        onOuvrir={n ? () => basculer('recherche') : undefined}
      >
        <ul className="flex flex-col gap-1.5">
          {r.correspondances.map((b) => (
            <li key={b.id}>
              <Link
                href={`/dashboard/biens?fiche=${b.id}`}
                className="inline-flex max-w-full items-center gap-1.5 text-[13px] font-medium text-primary-600"
              >
                <span className="truncate">{b.label}</span>
                <ExternalLink size={12} strokeWidth={2} aria-hidden className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </Ligne>,
    );
  }

  for (const a of actions) {
    const quand = `${jourLisible(a.date)}${a.heure ? ` à ${heureLisible(a.heure)}` : ''}`;
    lignes.push(
      <Ligne
        key={`a-${a.id}`}
        kind={kindAction(a)}
        titre={a.intitule}
        detail={a.type === 'visite_faite' ? 'Visite effectuée' : a.dateDeduite ? `${quand} · date à confirmer` : quand}
        avertissement={a.dateDeduite}
        actif={a.accepted}
        onActif={(v) => setAction(a.id, { accepted: v })}
        ouvert={ouvert === a.id}
        onOuvrir={() => basculer(a.id)}
      >
        <div className="flex flex-col gap-2">
          <input
            value={a.intitule}
            onChange={(e) => setAction(a.id, { intitule: e.target.value })}
            aria-label="Intitulé"
            className="w-full rounded-xl border border-black/10 bg-surface px-3 py-2 text-[14px] text-text-strong focus:border-primary-400 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={a.date}
              onChange={(e) => e.target.value && setAction(a.id, { date: e.target.value, dateDeduite: false })}
              aria-label="Date"
              className="min-w-0 flex-1 rounded-xl border border-black/10 bg-surface px-3 py-2 text-[14px] text-text-strong"
            />
            <input
              type="time"
              value={a.heure ?? ''}
              onChange={(e) => setAction(a.id, { heure: e.target.value || null })}
              aria-label="Heure"
              className="w-28 rounded-xl border border-black/10 bg-surface px-3 py-2 text-[14px] text-text-strong"
            />
          </div>
        </div>
      </Ligne>,
    );
  }

  for (const m of review.misesAJour) {
    const l = libelleMiseAJour(m);
    lignes.push(
      <Ligne
        key={`m-${m.id}`}
        kind="mise_a_jour"
        titre={`${l.quoi} : ${l.avant} → ${l.apres}`}
        detail={m.bienLabel}
        actif={m.accepted}
        onActif={(v) =>
          changer({ ...review, misesAJour: review.misesAJour.map((x) => (x.id === m.id ? { ...x, accepted: v } : x)) })
        }
      />,
    );
  }

  if (review.prospect) {
    const pr = review.prospect;
    lignes.push(
      <Ligne
        key="prospect"
        kind="prospect"
        titre={`Prospect → ${pr.stageLibelle}`}
        detail={[pr.adresse, pr.motif].filter(Boolean).join(' · ')}
        actif={pr.accepted}
        onActif={(v) => changer({ ...review, prospect: { ...pr, accepted: v } })}
      />,
    );
  }

  if (review.email) {
    const e = review.email;
    const pret = Boolean(e.corps.trim());
    lignes.push(
      <Ligne
        key="email"
        kind="email"
        titre={e.destinataire ? `E-mail à ${e.destinataire}` : 'E-mail à envoyer'}
        detail={pret ? e.objet : 'Rédaction du brouillon…'}
        ouvert={ouvert === 'email'}
        onOuvrir={() => basculer('email')}
      >
        <div className="flex flex-col gap-2">
          <input
            value={e.objet}
            onChange={(ev) => changer({ ...review, email: { ...e, objet: ev.target.value } })}
            aria-label="Objet"
            className="w-full rounded-xl border border-black/10 bg-surface px-3 py-2 text-[14px] text-text-strong focus:border-primary-400 focus:outline-none"
          />
          <textarea
            value={e.corps}
            onChange={(ev) => changer({ ...review, email: { ...e, corps: ev.target.value } })}
            aria-label="Message"
            rows={6}
            placeholder="Rédaction du brouillon…"
            className="w-full rounded-xl border border-black/10 bg-surface px-3 py-2 text-[13.5px] leading-relaxed text-text focus:border-primary-400 focus:outline-none"
          />
          <div className="flex gap-2">
            <a
              href={pret ? mailtoBrouillon(e) : undefined}
              aria-disabled={!pret}
              className={`inline-flex h-10 flex-1 items-center justify-center rounded-full bg-primary-500 px-4 text-[13.5px] font-semibold text-white ${
                pret ? '' : 'pointer-events-none opacity-50'
              }`}
            >
              Ouvrir dans ma messagerie
            </a>
            <button
              type="button"
              aria-label="Copier l’e-mail"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(`${e.objet}\n\n${e.corps}`)
                  .then(() => notifySuccess('E-mail copié'))
                  .catch(() => notifyError('Copie impossible'));
              }}
              className="flex size-10 items-center justify-center rounded-full border border-black/10 text-text-strong"
            >
              <Copy size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      </Ligne>,
    );
  }

  if (review.immeuble) {
    lignes.push(
      <Ligne
        key="immeuble"
        kind={caracteristiques ? 'bien' : 'lieu'}
        titre={review.immeuble.adresseNormalisee ?? review.immeuble.address}
        detail={caracteristiques || null}
        actif={!hiddenIds.includes('immeuble')}
        onActif={(v) => cacher('immeuble', !v)}
      />,
    );
  } else if (caracteristiques) {
    lignes.push(<Ligne key="bien-infos" kind="bien" titre={caracteristiques} detail={review.secteur} />);
  }

  for (const b of review.biens) {
    lignes.push(
      <Ligne
        key={`b-${b.id}`}
        kind="bien"
        titre={b.label}
        detail="Bien de l’agence"
        actif={!hiddenIds.includes(`bien-${b.id}`)}
        onActif={(v) => cacher(`bien-${b.id}`, !v)}
      />,
    );
  }
  for (const l of review.leads) {
    lignes.push(
      <Ligne
        key={`l-${l.id}`}
        kind="prospect"
        titre={l.label}
        detail="Prospect DPE à cette adresse"
        actif={!hiddenIds.includes(`lead-${l.id}`)}
        onActif={(v) => cacher(`lead-${l.id}`, !v)}
      />,
    );
  }
  for (const c of conseillers) {
    lignes.push(
      <Ligne
        key={`c-${c.memberId}`}
        kind="personne"
        titre={`Confier à ${c.label}`}
        detail="La note et ses rappels lui reviennent"
        actif={!hiddenConseillers.includes(c.memberId)}
        onActif={(v) => {
          toucher();
          setHiddenConseillers((h) => (v ? h.filter((x) => x !== c.memberId) : [...h, c.memberId]));
        }}
      />,
    );
  }
  for (const link of manualLinks) {
    lignes.push(
      <Ligne
        key={link.key}
        kind={link.entiteType === 'contact' ? 'personne' : link.entiteType === 'lead' ? 'prospect' : 'bien'}
        titre={link.label}
        detail={link.subtitle ?? null}
        actif
        onActif={() => setManualLinks((prev) => prev.filter((l) => l.key !== link.key))}
      />,
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1">
        {/* Le texte dicté reste toujours sous les yeux : une note sur un
            appartement peut n'avoir ni contact ni action, et c'est alors tout
            ce qu'elle contient. Le toucher le corrige. */}
        {edition ? (
          <div>
            <textarea
              value={transcript}
              autoFocus
              onChange={(e) => onTranscript(e.target.value)}
              onBlur={() => {
                setEdition(false);
                if (transcript.trim() !== texteAvantEdition.current.trim()) onTexteCorrige?.();
              }}
              rows={6}
              aria-label={typed ? 'Texte de la note' : 'Ce que vous avez dit'}
              className="w-full rounded-2xl border border-primary-200 bg-surface px-4 py-3 text-[15px] leading-relaxed text-text-strong focus:outline-none"
            />
            <NoteMentionSensible />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              texteAvantEdition.current = transcript;
              setEdition(true);
            }}
            className="group flex w-full items-start gap-2 rounded-2xl bg-bg-subtle px-4 py-3 text-left"
          >
            <span
              className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed ${
                transcript.trim() ? 'text-text' : 'text-text-subtle'
              }`}
            >
              {transcript.trim() ||
                (transcriptionEnCours
                  ? 'Transcription en cours…'
                  : 'La transcription n’a rien donné. Touchez pour écrire la note.')}
            </span>
            <Pencil size={14} strokeWidth={2} aria-hidden className="mt-1 shrink-0 text-text-subtle" />
          </button>
        )}

        {review.intention === 'question' && onQuestion ? (
          <button
            type="button"
            onClick={() => onQuestion(transcript.trim())}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-left"
          >
            <IconeCarte kind="question" />
            <span className="min-w-0 flex-1 text-[14px] font-semibold text-primary-700">Demander à Mon assistant</span>
          </button>
        ) : null}

        <ul className={`mt-3 flex flex-col gap-2 ${lecture ? styles.lectureReflet : ''}`} aria-busy={lecture}>
          {lignes}
          {lignes.length === 0
            ? cartesEnAttente.map((c) => (
                <li
                  key={c.key}
                  className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-surface px-3 py-2.5 opacity-70"
                >
                  <IconeCarte kind={c.kind} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-text-strong">{c.titre}</span>
                    {c.detail ? <span className="block truncate text-[12.5px] text-text-muted">{c.detail}</span> : null}
                  </span>
                </li>
              ))
            : null}
        </ul>

        {lignes.length === 0 && cartesEnAttente.length === 0 && !lecture ? (
          <p className="mt-3 text-center text-[13px] text-text-subtle">La note sera gardée telle quelle.</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRattacher((v) => !v)}
            aria-expanded={rattacher}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-bg-subtle px-3 text-[13px] font-medium text-text"
          >
            <Link2 size={14} strokeWidth={2} aria-hidden />
            Rattacher
          </button>
          <button
            type="button"
            onClick={() => {
              toucher();
              setVisibilite((v) => (v === 'privee' ? 'agence' : 'privee'));
            }}
            aria-pressed={visibilite === 'privee'}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ${
              visibilite === 'privee' ? 'bg-primary-500 text-white' : 'bg-bg-subtle text-text'
            }`}
          >
            <Lock size={14} strokeWidth={2} aria-hidden />
            {visibilite === 'privee' ? 'Privée' : 'Visible par l’agence'}
          </button>
        </div>
        {rattacher ? (
          <div className="mt-3">
            <NoteEntitySearch
              onPick={(pick) => {
                toucher();
                const key = `${pick.entiteType}:${pick.entiteId}`;
                setManualLinks((prev) => (prev.some((l) => l.key === key) ? prev : [...prev, { ...pick, key }]));
                setRattacher(false);
              }}
              excludeIds={new Set(manualLinks.map((l) => l.key))}
            />
          </div>
        ) : null}
      </div>

      <footer
        className="flex flex-shrink-0 items-center gap-3 border-t border-black/[0.06] px-5 py-3"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
      >
        {onContinue ? (
          <button
            type="button"
            onClick={onContinue}
            aria-label="Compléter la dictée"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 transition-transform active:scale-95"
          >
            <Mic size={20} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={(e) => ranger(e.currentTarget.getBoundingClientRect())}
          disabled={envoye}
          className="h-12 flex-1 rounded-full bg-primary-500 text-[15px] font-semibold text-white shadow-clay-primary transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          Ranger
        </button>
      </footer>
    </div>
  );
}
