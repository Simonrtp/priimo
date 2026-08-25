'use client';

import { useState } from 'react';
import type { Contact, ContactType } from '@/types/contact';
import { CONTACT_TYPE_LABELS, CONTACT_TYPE_ORDER, typeUsesCriteria } from '@/types/contact';
import type { ContactInputFields } from '@/lib/contact-input';
import { EMPTY_CONTACT_INPUT } from '@/lib/contact-input';
import { notifyError, notifySuccess } from '@/lib/notify';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { ADDRESS_FIELD_INPUT_CLASS, Field, TextArea, TextInput } from '@/components/dashboard/workspace/Field';
import AssigneeSelect, { type AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';

function fromContact(contact: Contact): ContactInputFields {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    type: contact.type,
    phone: contact.phone,
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
  };
}

export default function ContactFormDialog({
  open,
  onClose,
  contact,
  onSaved,
  members,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  /** Renseigné en modification, absent en création. */
  contact?: Contact;
  onSaved: (contact: Contact) => void;
  members: readonly AssigneeOption[];
  currentUserId: string;
}) {
  const [fields, setFields] = useState<ContactInputFields>(
    contact ? fromContact(contact) : EMPTY_CONTACT_INPUT,
  );
  const [assignedTo, setAssignedTo] = useState<string | null>(
    contact?.assignedTo ?? currentUserId,
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ContactInputFields>(key: K, value: ContactInputFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function setNumber(key: keyof ContactInputFields, raw: string) {
    const digits = raw.replace(/[^\d]/g, '');
    setFields((f) => ({ ...f, [key]: digits ? Number(digits) : null }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const url = contact ? `/api/dashboard/contacts/${contact.id}` : '/api/dashboard/contacts';
      const res = await fetch(url, {
        method: contact ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, postalCodes: fields.postalCodes, assignedTo }),
      });
      const data = (await res.json()) as { contact?: Contact; error?: string };

      if (!res.ok || !data.contact) {
        notifyError(data.error ?? "Le contact n'a pas pu être enregistré");
        return;
      }

      notifySuccess(contact ? 'Contact mis à jour' : 'Contact créé');
      onSaved(data.contact);
      onClose();
    } catch {
      notifyError("Le contact n'a pas pu être enregistré");
    } finally {
      setSaving(false);
    }
  }

  const showCriteria = typeUsesCriteria(fields.type);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={contact ? 'Modifier le contact' : 'Nouveau contact'}
      maxWidth="xl"
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Prénom" htmlFor="contact-first">
            <TextInput
              id="contact-first"
              value={fields.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Nom" htmlFor="contact-last">
            <TextInput
              id="contact-last"
              value={fields.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              autoComplete="off"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type de personne" htmlFor="contact-type">
            <Select
              id="contact-type"
              value={fields.type}
              onChange={(v) => set('type', v as ContactType)}
              options={CONTACT_TYPE_ORDER.map((t) => ({ value: t, label: CONTACT_TYPE_LABELS[t] }))}
              aria-label="Type de personne"
            />
          </Field>
          <Field label="Secteur" htmlFor="contact-secteur" hint="Le quartier ou la commune, en clair">
            <TextInput
              id="contact-secteur"
              value={fields.secteur ?? ''}
              onChange={(e) => set('secteur', e.target.value || null)}
              placeholder="Vieux Lille"
            />
          </Field>
        </div>

        <Field label="Adresse" htmlFor="contact-address" hint="Choisissez une proposition pour la placer sur la carte">
          <AddressAutocomplete
            id="contact-address"
            value={fields.address ?? ''}
            onChange={(data: SelectedAddress | null) => {
              if (data) set('address', data.label);
            }}
            onQueryChange={(q) => set('address', q.trim() || null)}
            placeholder="12 rue de la Monnaie, Lille"
            inputClassName={ADDRESS_FIELD_INPUT_CLASS}
          />
        </Field>

        {members.length > 0 ? (
          <Field label="Assigner à" htmlFor="contact-assignee">
            <AssigneeSelect
              id="contact-assignee"
              value={assignedTo}
              members={members}
              currentUserId={currentUserId}
              includeUnassigned
              onChange={setAssignedTo}
            />
          </Field>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Téléphone" htmlFor="contact-phone">
            <TextInput
              id="contact-phone"
              type="tel"
              value={fields.phone ?? ''}
              onChange={(e) => set('phone', e.target.value || null)}
            />
          </Field>
          <Field label="Email" htmlFor="contact-email">
            <TextInput
              id="contact-email"
              type="email"
              value={fields.email ?? ''}
              onChange={(e) => set('email', e.target.value || null)}
            />
          </Field>
        </div>

        {showCriteria ? (
          <fieldset className="border-t border-black/[0.06] pt-6">
            <legend className="sr-only">Critères de recherche</legend>
            <p className="mb-4 font-medium text-text-strong" style={{ fontSize: 14 }}>
              Ce qu&apos;il recherche
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Budget minimum" htmlFor="contact-budget-min">
                <TextInput
                  id="contact-budget-min"
                  inputMode="numeric"
                  value={fields.budgetMin ?? ''}
                  onChange={(e) => setNumber('budgetMin', e.target.value)}
                  placeholder="En euros"
                />
              </Field>
              <Field label="Budget maximum" htmlFor="contact-budget-max">
                <TextInput
                  id="contact-budget-max"
                  inputMode="numeric"
                  value={fields.budgetMax ?? ''}
                  onChange={(e) => setNumber('budgetMax', e.target.value)}
                  placeholder="En euros"
                />
              </Field>
              <Field label="Surface minimum" htmlFor="contact-surface-min">
                <TextInput
                  id="contact-surface-min"
                  inputMode="numeric"
                  value={fields.surfaceMin ?? ''}
                  onChange={(e) => setNumber('surfaceMin', e.target.value)}
                  placeholder="En m²"
                />
              </Field>
              <Field label="Pièces minimum" htmlFor="contact-rooms">
                <TextInput
                  id="contact-rooms"
                  inputMode="numeric"
                  value={fields.roomsMin ?? ''}
                  onChange={(e) => setNumber('roomsMin', e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field
                label="Codes postaux recherchés"
                htmlFor="contact-postal"
                hint="Séparés par des virgules. Ce sont eux qui déclenchent les rapprochements."
              >
                <TextInput
                  id="contact-postal"
                  value={fields.postalCodes.join(', ')}
                  onChange={(e) =>
                    set(
                      'postalCodes',
                      e.target.value
                        .split(/[,;\s]+/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="59000, 59800"
                />
              </Field>
            </div>
          </fieldset>
        ) : null}

        <Field label="Résumé" htmlFor="contact-summary" hint="Ce qu'il faut se rappeler de cette personne">
          <TextArea
            id="contact-summary"
            rows={4}
            value={fields.summary ?? ''}
            onChange={(e) => set('summary', e.target.value || null)}
          />
        </Field>

        <div className="flex flex-wrap justify-end gap-3 border-t border-black/[0.06] pt-5">
          <WorkspaceButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </WorkspaceButton>
          <WorkspaceButton type="submit" disabled={saving}>
            {saving ? 'Enregistrement…' : contact ? 'Enregistrer' : 'Créer le contact'}
          </WorkspaceButton>
        </div>
      </form>
    </Modal>
  );
}
