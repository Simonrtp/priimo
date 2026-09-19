'use client';

import { useState } from 'react';
import { Field, TextInput } from '@/components/dashboard/workspace/Field';
import Select from '@/components/ui/Select';
import AssigneeSelect, { type AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import CollaborateurNom from '@/components/dashboard/CollaborateurNom';
import { portraitDepuisMembre } from '@/lib/notes/auteur';
import NoteEntitySearch from '@/components/dashboard/notes/NoteEntitySearch';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import ContactFormDialog from '@/components/dashboard/contacts/ContactFormDialog';
import { notifySuccess } from '@/lib/notify';
import {
  ETAT_LABELS,
  ESTIMATION_ETATS,
  ESTIMATION_MOTIFS,
  MOTIF_LABELS,
  type EstimationEtat,
  type EstimationMotif,
} from '@/lib/estimation/cycle';
import type { EstimationObjet } from '@/lib/estimation/objet';

export default function OngletClient({
  estimation,
  members,
  isDirector,
  currentUserId,
  onPatch,
}: {
  estimation: EstimationObjet;
  members: AssigneeOption[];
  isDirector: boolean;
  currentUserId: string;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [clientLabel, setClientLabel] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
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
          <TextInput
            id="est-date-valeur"
            type="date"
            value={estimation.dateValeur ?? ''}
            onChange={(e) => onPatch({ dateValeur: e.target.value || null })}
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

      <div className="flex flex-col gap-3">
        <Field label="Client rattaché au bien" htmlFor="est-rattacher">
          {estimation.contactId ? (
            <p className="rounded-xl border border-black/[0.08] bg-bg-subtle px-3 py-2.5 text-[14px] text-text-strong">
              {clientLabel ?? 'Client rattaché'}
            </p>
          ) : (
            <NoteEntitySearch
              onPick={(pick) => {
                if (pick.entiteType === 'contact') {
                  setClientLabel(pick.label);
                  onPatch({ contactId: pick.entiteId });
                  return;
                }
                if (pick.entiteType === 'lead') onPatch({ leadId: pick.entiteId });
                if (pick.entiteType === 'bien') onPatch({ bienId: pick.entiteId });
              }}
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-2">
          <WorkspaceButton
            type="button"
            variant={estimation.contactId ? 'secondary' : 'primary'}
            onClick={() => setCreateOpen(true)}
            className="min-h-11"
          >
            {estimation.contactId ? 'Créer un autre client' : 'Créer un client'}
          </WorkspaceButton>
          {estimation.contactId ? (
            <WorkspaceButton
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                setClientLabel(null);
                onPatch({ contactId: null });
              }}
            >
              Changer
            </WorkspaceButton>
          ) : null}
        </div>
      </div>

      {createOpen ? (
        <ContactFormDialog
          key={`client-est-${estimation.id}`}
          open
          elevated
          onClose={() => setCreateOpen(false)}
          initialType="vendeur"
          createTitle="Nouveau client"
          members={
            members.length > 0 ? members : [{ id: currentUserId, fullName: 'Vous' }]
          }
          currentUserId={currentUserId}
          skipSuccessToast
          onSaved={(contact) => {
            const nom = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
            setClientLabel(nom || 'Client rattaché');
            onPatch({ contactId: contact.id });
            setCreateOpen(false);
            notifySuccess('Client créé et rattaché');
          }}
          onOpenExisting={(contact) => {
            const nom = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
            setClientLabel(nom || 'Client rattaché');
            onPatch({ contactId: contact.id });
            setCreateOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
