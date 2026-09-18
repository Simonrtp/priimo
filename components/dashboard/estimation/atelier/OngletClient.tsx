'use client';

import { Field, TextInput } from '@/components/dashboard/workspace/Field';
import Select from '@/components/ui/Select';
import AssigneeSelect, { type AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import CollaborateurNom from '@/components/dashboard/CollaborateurNom';
import { portraitDepuisMembre } from '@/lib/notes/auteur';
import NoteEntitySearch from '@/components/dashboard/notes/NoteEntitySearch';
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
      <Field label="Rattacher à" htmlFor="est-rattacher">
        <NoteEntitySearch
          onPick={(pick) => {
            if (pick.entiteType === 'contact') onPatch({ contactId: pick.entiteId });
            if (pick.entiteType === 'lead') onPatch({ leadId: pick.entiteId });
            if (pick.entiteType === 'bien') onPatch({ bienId: pick.entiteId });
          }}
        />
      </Field>
    </div>
  );
}
