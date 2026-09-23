'use client';

import { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import type { Contact } from '@/types/contact';
import { Field } from '@/components/dashboard/workspace/Field';
import { ChampSaisi } from './ChampSaisi';
import Select from '@/components/ui/Select';
import AssigneeSelect, { type AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import CollaborateurNom from '@/components/dashboard/CollaborateurNom';
import { portraitDepuisMembre } from '@/lib/notes/auteur';
import NoteEntitySearch from '@/components/dashboard/notes/NoteEntitySearch';
import ContactFormDialog from '@/components/dashboard/contacts/ContactFormDialog';
import CartesAdresseProposee from './CartesAdresseProposee';
import {
  extraireCodePostal,
  extraireVille,
  fusionnerAdressesProposees,
  patchDepuisAdresseProposee,
  typeBienEstimation,
  type AdresseProposee,
} from '@/lib/notes/rattacher-catalogue';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  ETAT_LABELS,
  ESTIMATION_ETATS,
  ESTIMATION_MOTIFS,
  MOTIF_LABELS,
  type EstimationEtat,
  type EstimationMotif,
} from '@/lib/estimation/cycle';
import type { EstimationObjet } from '@/lib/estimation/objet';

type RattacheKind = 'contact' | 'lead' | 'bien';

const KIND_LIBELLE: Record<RattacheKind, string> = {
  contact: 'Client',
  lead: 'Prospect',
  bien: 'Bien',
};

function RattacheChip({
  kind,
  label,
  onEdit,
  onRemove,
}: {
  kind: RattacheKind;
  label: string;
  onEdit?: () => void;
  onRemove: () => void;
}) {
  const libelle = KIND_LIBELLE[kind];
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-black/[0.08] bg-bg-subtle px-3 py-2">
      <p className="min-w-0 flex-1 truncate text-[14px] text-text-strong">
        <span className="text-text-muted">{libelle} · </span>
        {label}
      </p>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Modifier la fiche ${libelle.toLowerCase()}`}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-black/[0.04] hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Pencil size={16} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Retirer le ${libelle.toLowerCase()} rattaché`}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-black/[0.04] hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <X size={16} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

export default function OngletClient({
  estimation,
  members,
  isDirector,
  currentUserId,
  onPatch,
  propositions = [],
  onAllerBien,
}: {
  estimation: EstimationObjet;
  members: AssigneeOption[];
  isDirector: boolean;
  currentUserId: string;
  onPatch: (body: Record<string, unknown>) => void;
  propositions?: AdresseProposee[];
  onAllerBien?: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [ficheAdresse, setFicheAdresse] = useState<AdresseProposee | null>(null);
  const [labels, setLabels] = useState<Record<RattacheKind, string | null>>({
    contact: null,
    lead: null,
    bien: null,
  });

  useEffect(() => {
    const ids = {
      contact: estimation.contactId,
      lead: estimation.leadId,
      bien: estimation.bienId,
    };
    if (!ids.contact && !ids.lead && !ids.bien) {
      setLabels({ contact: null, lead: null, bien: null });
      setFicheAdresse(null);
      return;
    }
    let cancel = false;
    void fetch('/api/dashboard/rattacher')
      .then((r) => r.json())
      .then(
        (data: {
          contact?: { id: string; label: string; subtitle: string | null }[];
          lead?: { id: string; label: string; subtitle: string | null }[];
          bien?: { id: string; label: string; subtitle: string | null }[];
        }) => {
          if (cancel) return;
          const next: Record<RattacheKind, string | null> = {
            contact: null,
            lead: null,
            bien: null,
          };
          for (const kind of ['contact', 'lead', 'bien'] as const) {
            const id = ids[kind];
            if (!id) continue;
            const hit = (data[kind] ?? []).find((item) => item.id === id);
            if (!hit) continue;
            next[kind] = hit.subtitle ? `${hit.label} · ${hit.subtitle}` : hit.label;
          }
          setLabels(next);
        },
      )
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [estimation.contactId, estimation.leadId, estimation.bienId]);

  function setLabel(kind: RattacheKind, value: string | null) {
    setLabels((prev) => ({ ...prev, [kind]: value }));
  }

  function labelFromPick(pick: { label: string; subtitle: string | null }) {
    return pick.subtitle ? `${pick.label} · ${pick.subtitle}` : pick.label;
  }

  function labelFromContact(contact: Contact) {
    const nom = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
    const extra = [contact.phone, contact.address].filter(Boolean).join(' · ');
    if (nom && extra) return `${nom} · ${extra}`;
    return nom || extra || 'Client rattaché';
  }

  function propositionDepuisFiche(contact: Contact): AdresseProposee | null {
    const label = contact.address?.trim();
    if (!label) return null;
    const postalCode = extraireCodePostal(label);
    return {
      key: `contact:${contact.id}`,
      source: 'contact',
      bienId: null,
      label,
      city: extraireVille(label, postalCode),
      postalCode,
      banId: contact.banId,
      latitude: contact.latitude,
      longitude: contact.longitude,
      propertyType: null,
      surfaceM2: null,
      rooms: null,
    };
  }

  function appliquerAdresse(p: AdresseProposee) {
    onPatch(patchDepuisAdresseProposee(p, estimation));
    onAllerBien?.();
  }

  const cartesAdresse = fusionnerAdressesProposees(ficheAdresse, propositions);

  function appliquerBienDepuisPick(pick: {
    entiteId: string;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    banId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    propertyType?: string | null;
    surfaceM2?: number | null;
    rooms?: number | null;
    label: string;
  }) {
    const label = pick.address?.trim() || pick.label;
    if (!label) {
      onPatch({ bienId: pick.entiteId });
      return;
    }
    appliquerAdresse({
      key: `bien:${pick.entiteId}`,
      source: 'bien',
      bienId: pick.entiteId,
      label,
      city: pick.city ?? extraireVille(label, pick.postalCode ?? extraireCodePostal(label)),
      postalCode: pick.postalCode ?? extraireCodePostal(label),
      banId: pick.banId ?? null,
      latitude: pick.latitude ?? null,
      longitude: pick.longitude ?? null,
      propertyType: typeBienEstimation(pick.propertyType),
      surfaceM2: pick.surfaceM2 ?? null,
      rooms: pick.rooms ?? null,
    });
  }

  async function ouvrirFiche(contactId: string) {
    try {
      const res = await fetch(`/api/dashboard/contacts/${contactId}`);
      const data = (await res.json()) as { contact?: Contact; error?: string };
      if (!res.ok || !data.contact) throw new Error(data.error);
      setEditing(data.contact);
      setCreateOpen(true);
    } catch {
      notifyError('Impossible d’ouvrir la fiche');
    }
  }

  function fermerFiche() {
    setCreateOpen(false);
    setEditing(null);
  }

  return (
    <>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(16rem,22rem)]">
      <div className="flex min-w-0 flex-col gap-5">
        <Field label="Motif" htmlFor="est-motif">
          <Select
            id="est-motif"
            value={estimation.motif}
            options={ESTIMATION_MOTIFS.map((m) => ({ value: m, label: MOTIF_LABELS[m] }))}
            onChange={(v) => onPatch({ motif: v as EstimationMotif })}
          />
        </Field>
        {estimation.motif === 'succession' ? (
          <Field label="Date de valeur" htmlFor="est-date-valeur">
            <ChampSaisi
              id="est-date-valeur"
              type="date"
              value={estimation.dateValeur ?? ''}
              onCommit={(raw) => onPatch({ dateValeur: raw || null })}
            />
          </Field>
        ) : null}
        <Field label="État" htmlFor="est-etat">
          <Select
            id="est-etat"
            value={estimation.etat}
            options={ESTIMATION_ETATS.map((e) => ({ value: e, label: ETAT_LABELS[e] }))}
            onChange={(v) => onPatch({ etat: v as EstimationEtat })}
          />
        </Field>
        <Field label="Référent" htmlFor="est-referent">
          {isDirector ? (
            <AssigneeSelect
              id="est-referent"
              value={estimation.referentId}
              members={members}
              currentUserId={currentUserId}
              onChange={(id) => onPatch({ referentId: id })}
            />
          ) : (
            <p className="text-[14px] text-text-strong">
              {(() => {
                const referent = members.find((m) => m.id === estimation.referentId);
                return referent ? (
                  <CollaborateurNom portrait={portraitDepuisMembre(referent)} size={22} />
                ) : (
                  'Vous'
                );
              })()}
            </p>
          )}
        </Field>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <Field label="Client rattaché au bien" htmlFor="est-rattacher">
          <div className="flex flex-col gap-3">
            {estimation.contactId || estimation.leadId || estimation.bienId ? (
              <div className="flex flex-col gap-1.5">
                {estimation.contactId ? (
                  <RattacheChip
                    kind="contact"
                    label={labels.contact ?? 'Client rattaché'}
                    onEdit={() => void ouvrirFiche(estimation.contactId!)}
                    onRemove={() => {
                      setLabel('contact', null);
                      setFicheAdresse(null);
                      onPatch({ contactId: null });
                    }}
                  />
                ) : null}
                {estimation.leadId ? (
                  <RattacheChip
                    kind="lead"
                    label={labels.lead ?? 'Prospect rattaché'}
                    onRemove={() => {
                      setLabel('lead', null);
                      onPatch({ leadId: null });
                    }}
                  />
                ) : null}
                {estimation.bienId ? (
                  <RattacheChip
                    kind="bien"
                    label={labels.bien ?? 'Bien rattaché'}
                    onRemove={() => {
                      setLabel('bien', null);
                      onPatch({ bienId: null });
                    }}
                  />
                ) : null}
                <CartesAdresseProposee
                  propositions={cartesAdresse}
                  actuel={{ address: estimation.address, bienId: estimation.bienId }}
                  onChoisir={appliquerAdresse}
                />
              </div>
            ) : null}
            <NoteEntitySearch
              id="est-rattacher"
              className="w-full"
              onCreateContact={() => {
                setEditing(null);
                setCreateOpen(true);
              }}
              excludeIds={
                new Set(
                  [
                    estimation.contactId ? `contact:${estimation.contactId}` : null,
                    estimation.leadId ? `lead:${estimation.leadId}` : null,
                    estimation.bienId ? `bien:${estimation.bienId}` : null,
                  ].filter((id): id is string => Boolean(id)),
                )
              }
              onPick={(pick) => {
                if (pick.entiteType === 'contact') {
                  setLabel('contact', labelFromPick(pick));
                  const label = pick.address?.trim();
                  if (label) {
                    const postalCode = pick.postalCode ?? extraireCodePostal(label);
                    setFicheAdresse({
                      key: `contact:${pick.entiteId}`,
                      source: 'contact',
                      bienId: null,
                      label,
                      city: pick.city ?? extraireVille(label, postalCode),
                      postalCode,
                      banId: pick.banId ?? null,
                      latitude: pick.latitude ?? null,
                      longitude: pick.longitude ?? null,
                      propertyType: null,
                      surfaceM2: null,
                      rooms: null,
                    });
                  }
                  onPatch({ contactId: pick.entiteId });
                  return;
                }
                if (pick.entiteType === 'lead') {
                  setLabel('lead', labelFromPick(pick));
                  onPatch({ leadId: pick.entiteId });
                  return;
                }
                if (pick.entiteType === 'bien') {
                  setLabel('bien', labelFromPick(pick));
                  appliquerBienDepuisPick(pick);
                }
              }}
            />
          </div>
        </Field>
      </div>
    </div>

    {createOpen ? (
        <ContactFormDialog
          key={editing?.id ?? `client-est-${estimation.id}`}
          open
          elevated
          contact={editing ?? undefined}
          onClose={fermerFiche}
          initialType="vendeur"
          createTitle="Nouveau client"
          members={
            members.length > 0 ? members : [{ id: currentUserId, fullName: 'Vous' }]
          }
          currentUserId={currentUserId}
          skipSuccessToast
          onSaved={(contact) => {
            setLabel('contact', labelFromContact(contact));
            setFicheAdresse(propositionDepuisFiche(contact));
            onPatch({ contactId: contact.id });
            fermerFiche();
            notifySuccess(editing ? 'Fiche mise à jour' : 'Client créé et rattaché');
          }}
          onOpenExisting={(contact) => {
            setLabel('contact', labelFromContact(contact));
            setFicheAdresse(propositionDepuisFiche(contact));
            onPatch({ contactId: contact.id });
            fermerFiche();
          }}
        />
      ) : null}
    </>
  );
}
