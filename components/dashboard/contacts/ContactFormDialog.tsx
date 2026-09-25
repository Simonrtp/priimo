'use client';

import { useState } from 'react';
import type { Contact, ContactType } from '@/types/contact';
import type { ContactFieldErrors, ContactInputFields } from '@/lib/contact-input';
import { EMPTY_CONTACT_INPUT, validateContactFields } from '@/lib/contact-input';
import { notifyError, notifySuccess } from '@/lib/notify';
import { validerEnFond } from '@/lib/ui/valider-en-fond';
import Modal from '@/components/ui/Modal';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import ContactFormFields from '@/components/dashboard/contacts/ContactFormFields';

function fromContact(contact: Contact): ContactInputFields {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    type: contact.type,
    phone: contact.phone,
    numeroCommuniqueParLaPersonne: contact.numeroCommuniqueParLaPersonne === true,
    email: contact.email,
    secteur: contact.secteur,
    address: contact.address,
    postalCodes: contact.criteria.postalCodes,
    budgetMin: contact.criteria.budgetMin,
    budgetMax: contact.criteria.budgetMax,
    surfaceMin: contact.criteria.surfaceMin,
    surfaceMax: contact.criteria.surfaceMax,
    roomsMin: contact.criteria.roomsMin,
    summary: contact.summary,
    recontacterLe: contact.recontacterLe,
  };
}

function mergeDraft(
  base: ContactInputFields,
  draft?: Partial<ContactInputFields>,
): ContactInputFields {
  if (!draft) return base;
  return {
    ...base,
    ...draft,
    postalCodes: draft.postalCodes ?? base.postalCodes,
  };
}

const FIELD_FOCUS_ID: Partial<Record<keyof ContactInputFields, string>> = {
  firstName: 'contact-first',
  lastName: 'contact-last',
  email: 'contact-email',
  budgetMin: 'contact-budget-min',
  budgetMax: 'contact-budget-max',
  surfaceMin: 'contact-surface-min',
  surfaceMax: 'contact-surface-max',
  recontacterLe: 'contact-relance',
};

export default function ContactFormDialog({
  open,
  onClose,
  contact,
  onSaved,
  members,
  currentUserId,
  initialType,
  initialDraft,
  skipSuccessToast = false,
  createTitle,
  onOpenExisting,
  elevated = false,
}: {
  open: boolean;
  onClose: () => void;
  /** Renseigné en modification, absent en création. */
  contact?: Contact;
  onSaved: (contact: Contact) => void;
  members: readonly AssigneeOption[];
  currentUserId: string;
  initialType?: ContactType;
  /**
   * Préremplissage à la création (ex. adresse déjà saisie sur le bien).
   * Ignoré en modification.
   */
  initialDraft?: Partial<ContactInputFields>;
  skipSuccessToast?: boolean;
  createTitle?: string;
  onOpenExisting?: (contact: Contact) => void;
  /** Modal au-dessus d’un autre (création proprio depuis un bien). */
  elevated?: boolean;
}) {
  const [fields, setFields] = useState<ContactInputFields>(() => {
    if (contact) return fromContact(contact);
    return mergeDraft(
      { ...EMPTY_CONTACT_INPUT, type: initialType ?? EMPTY_CONTACT_INPUT.type },
      initialDraft,
    );
  });
  const [assignedTo, setAssignedTo] = useState<string | null>(
    contact?.assignedTo ?? currentUserId,
  );
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [matches, setMatches] = useState<
    { contact: Contact; reason: string }[]
  >([]);
  const [forceCreate, setForceCreate] = useState(false);
  const [geo, setGeo] = useState<{
    banId: string | null;
    latitude: number | null;
    longitude: number | null;
  }>(() =>
    contact
      ? { banId: contact.banId, latitude: contact.latitude, longitude: contact.longitude }
      : { banId: null, latitude: null, longitude: null },
  );

  function focusFirstError(errors: ContactFieldErrors) {
    const first = (Object.keys(errors) as (keyof ContactInputFields)[])[0];
    if (!first) return;
    const id = FIELD_FOCUS_ID[first];
    if (!id) return;
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.focus();
      document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  async function submit(e?: React.FormEvent, force = false) {
    e?.preventDefault();
    if (saving) return;

    const validation = validateContactFields(fields);
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      setFormError(validation.summary);
      notifyError(validation.summary ?? 'Vérifiez les champs manquants');
      focusFirstError(validation.errors);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    const useForce = force || forceCreate;
    const url = contact ? `/api/dashboard/contacts/${contact.id}` : '/api/dashboard/contacts';
    const corps = JSON.stringify({
      ...fields,
      postalCodes: fields.postalCodes,
      assignedTo,
      forceCreate: !contact && useForce ? true : undefined,
      banId: geo.banId,
      latitude: geo.latitude,
      longitude: geo.longitude,
    });

    // Une modification ne peut plus rien apprendre à l'agent : la saisie est
    // déjà vérifiée et la route ne cherche de doublon qu'à la création. On
    // ferme donc au clic. Une création, elle, doit rester ouverte : le serveur
    // peut répondre par une liste de fiches qui lui ressemblent, et cette
    // liste n'a de sens que dans la fenêtre.
    if (contact) {
      onClose();
      validerEnFond({
        succes: skipSuccessToast ? null : 'Contact mis à jour',
        echec: "Le contact n'a pas pu être enregistré",
        ecrire: async () => {
          const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: corps,
          });
          const data = (await res.json().catch(() => null)) as {
            contact?: Contact;
            error?: string;
          } | null;
          if (!res.ok || !data?.contact) {
            throw new Error(data?.error ?? "Le contact n'a pas pu être enregistré");
          }
          return data.contact;
        },
        puis: onSaved,
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: corps,
      });
      const data = (await res.json()) as {
        contact?: Contact;
        error?: string;
        field?: keyof ContactInputFields | null;
        matches?: { contact: Contact; reason: string }[];
      };

      if (res.status === 409 && data.matches && data.matches.length > 0) {
        setMatches(data.matches);
        return;
      }

      if (!res.ok || !data.contact) {
        const message = data.error ?? "Le contact n'a pas pu être enregistré";
        setFormError(message);
        if (data.field) {
          setFieldErrors({ [data.field]: message });
          focusFirstError({ [data.field]: message });
        }
        notifyError(message);
        return;
      }

      if (!skipSuccessToast) {
        notifySuccess(contact ? 'Contact mis à jour' : 'Contact créé');
      }
      onSaved(data.contact);
      onClose();
    } catch {
      const message = "Le contact n'a pas pu être enregistré";
      setFormError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  }

  const REASON: Record<string, string> = {
    telephone: 'Même téléphone',
    email: 'Même email',
    nom: 'Même nom',
    prenom: 'Prénom identique',
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        contact
          ? 'Modifier le contact'
          : createTitle ?? (initialType === 'acquereur' ? 'Nouvelle recherche acquéreur' : 'Nouveau contact')
      }
      maxWidth="xl"
      elevated={elevated}
    >
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        {formError ? (
          <div
            role="alert"
            className="rounded-xl border border-[#E8A0A0] bg-[#FFF5F5] px-4 py-3 text-[13.5px] font-medium text-[#B42318]"
          >
            {formError}
          </div>
        ) : null}

        {matches.length > 0 ? (
          <div className="rounded-xl border border-black/[0.08] bg-[#FFF7F0] px-4 py-3">
            <p className="text-[14px] font-medium text-text-strong">Cette personne existe déjà</p>
            <ul className="mt-2 flex flex-col gap-2">
              {matches.map((m) => (
                <li key={m.contact.id} className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13.5px] text-text">
                    {m.contact.fullName}
                    <span className="ml-2 text-text-muted">{REASON[m.reason] ?? m.reason}</span>
                  </p>
                  <WorkspaceButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (onOpenExisting) onOpenExisting(m.contact);
                      else onSaved(m.contact);
                      onClose();
                    }}
                  >
                    Ouvrir la fiche
                  </WorkspaceButton>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 text-[13px] font-medium text-[#1A2A56] underline-offset-2 hover:underline"
              onClick={() => {
                setForceCreate(true);
                setMatches([]);
                void submit(undefined, true);
              }}
            >
              Créer quand même
            </button>
          </div>
        ) : null}
        <ContactFormFields
          idPrefix="contact"
          fields={fields}
          onFields={(next) => {
            setFields(next);
            setFormError(null);
            setFieldErrors({});
          }}
          assignedTo={assignedTo}
          onAssignedTo={setAssignedTo}
          geo={geo}
          onGeo={setGeo}
          members={members}
          currentUserId={currentUserId}
          fieldErrors={fieldErrors}
        />

        <div className="flex flex-wrap justify-end gap-3 border-t border-black/[0.06] pt-5">
          <WorkspaceButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </WorkspaceButton>
          <WorkspaceButton type="submit" disabled={saving}>
            {saving ? 'Validation…' : contact ? 'Valider' : 'Créer le contact'}
          </WorkspaceButton>
        </div>
      </form>
    </Modal>
  );
}
