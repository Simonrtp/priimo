'use client';

import { useState } from 'react';
import type { Contact, ContactType } from '@/types/contact';
import { CONTACT_TYPE_LABELS, CONTACT_TYPE_ORDER, typeUsesCriteria } from '@/types/contact';
import type { ContactFieldErrors, ContactInputFields } from '@/lib/contact-input';
import { EMPTY_CONTACT_INPUT, validateContactFields } from '@/lib/contact-input';
import { notifyError, notifySuccess } from '@/lib/notify';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import DatePickerField from '@/components/ui/DatePickerField';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import { secteurFromSelectedAddress } from '@/lib/ban';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import {
  ADDRESS_FIELD_INPUT_CLASS,
  Field,
  INPUT_ERROR_CLASS,
  TextArea,
  TextInput,
} from '@/components/dashboard/workspace/Field';
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

  function clearFieldError(key: keyof ContactInputFields) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormError(null);
  }

  function set<K extends keyof ContactInputFields>(key: K, value: ContactInputFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
    clearFieldError(key);
  }

  function setNumber(key: keyof ContactInputFields, raw: string) {
    const digits = raw.replace(/[^\d]/g, '');
    setFields((f) => ({ ...f, [key]: digits ? Number(digits) : null }));
    clearFieldError(key);
  }

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
    setSaving(true);
    const useForce = force || forceCreate;
    try {
      const url = contact ? `/api/dashboard/contacts/${contact.id}` : '/api/dashboard/contacts';
      const res = await fetch(url, {
        method: contact ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          postalCodes: fields.postalCodes,
          assignedTo,
          forceCreate: !contact && useForce ? true : undefined,
          banId: geo.banId,
          latitude: geo.latitude,
          longitude: geo.longitude,
        }),
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

  const showCriteria = typeUsesCriteria(fields.type);
  const immeubleType = fields.type === 'gardien' || fields.type === 'commercant';

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
              className="mt-3 text-[13px] font-medium text-[#3D5A80] underline-offset-2 hover:underline"
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Prénom" htmlFor="contact-first" error={fieldErrors.firstName}>
            <TextInput
              id="contact-first"
              value={fields.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              autoComplete="off"
              invalid={Boolean(fieldErrors.firstName)}
              aria-describedby={fieldErrors.firstName ? 'contact-first-error' : undefined}
            />
          </Field>
          <Field label="Nom" htmlFor="contact-last" error={fieldErrors.lastName}>
            <TextInput
              id="contact-last"
              value={fields.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              autoComplete="off"
              invalid={Boolean(fieldErrors.lastName)}
              aria-describedby={fieldErrors.lastName ? 'contact-last-error' : undefined}
            />
          </Field>
        </div>

        <Field label="Type de personne" htmlFor="contact-type">
          <Select
            id="contact-type"
            value={fields.type}
            onChange={(v) => set('type', v as ContactType)}
            options={CONTACT_TYPE_ORDER.map((t) => ({ value: t, label: CONTACT_TYPE_LABELS[t] }))}
            aria-label="Type de personne"
          />
        </Field>

        <Field
          label={immeubleType ? 'Immeuble' : 'Adresse'}
          htmlFor="contact-address"
          hint={
            immeubleType
              ? 'L’immeuble de rattachement, pas une adresse personnelle'
              : 'Choisissez une proposition : le secteur se remplit tout seul'
          }
        >
          <AddressAutocomplete
            id="contact-address"
            value={fields.address ?? ''}
            onChange={(data: SelectedAddress | null) => {
              if (!data) return;
              const secteur = secteurFromSelectedAddress(data);
              const postal = data.postcode?.trim() ?? '';
              setFields((f) => ({
                ...f,
                address: data.label,
                secteur: secteur ?? f.secteur,
                postalCodes:
                  /^\d{5}$/.test(postal) && !f.postalCodes.includes(postal)
                    ? [...f.postalCodes, postal].slice(0, 20)
                    : f.postalCodes,
              }));
              setGeo({
                banId: data.id ?? null,
                latitude: data.latitude,
                longitude: data.longitude,
              });
              setFormError(null);
            }}
            onQueryChange={(q) => {
              set('address', q.trim() || null);
              setGeo({ banId: null, latitude: null, longitude: null });
            }}
            placeholder="12 rue de la Monnaie, Lille"
            inputClassName={ADDRESS_FIELD_INPUT_CLASS}
          />
        </Field>

        <Field
          label="Secteur"
          htmlFor="contact-secteur"
          hint="Rempli depuis l’adresse — vous pouvez le préciser (quartier, commune…)"
        >
          <TextInput
            id="contact-secteur"
            value={fields.secteur ?? ''}
            onChange={(e) => set('secteur', e.target.value || null)}
            placeholder="Vieux Lille"
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
          <Field label="Email" htmlFor="contact-email" error={fieldErrors.email}>
            <TextInput
              id="contact-email"
              type="email"
              value={fields.email ?? ''}
              onChange={(e) => set('email', e.target.value || null)}
              invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'contact-email-error' : undefined}
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
              <Field label="Budget minimum" htmlFor="contact-budget-min" error={fieldErrors.budgetMin}>
                <TextInput
                  id="contact-budget-min"
                  inputMode="numeric"
                  value={fields.budgetMin ?? ''}
                  onChange={(e) => setNumber('budgetMin', e.target.value)}
                  placeholder="En euros"
                  invalid={Boolean(fieldErrors.budgetMin)}
                />
              </Field>
              <Field label="Budget maximum" htmlFor="contact-budget-max" error={fieldErrors.budgetMax}>
                <TextInput
                  id="contact-budget-max"
                  inputMode="numeric"
                  value={fields.budgetMax ?? ''}
                  onChange={(e) => setNumber('budgetMax', e.target.value)}
                  placeholder="En euros"
                  invalid={Boolean(fieldErrors.budgetMax)}
                />
              </Field>
              <Field
                label="Surface minimum"
                htmlFor="contact-surface-min"
                error={fieldErrors.surfaceMin}
              >
                <TextInput
                  id="contact-surface-min"
                  inputMode="numeric"
                  value={fields.surfaceMin ?? ''}
                  onChange={(e) => setNumber('surfaceMin', e.target.value)}
                  placeholder="En m²"
                  invalid={Boolean(fieldErrors.surfaceMin)}
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

        <Field
          label="Relancer le"
          htmlFor="contact-relance"
          hint="Le jour où il faudra reprendre contact. Une date arrivée remonte sur l’Accueil."
          error={fieldErrors.recontacterLe}
        >
          <DatePickerField
            id="contact-relance"
            value={fields.recontacterLe}
            onChange={(v) => set('recontacterLe', v)}
            aria-label="Date de relance"
            className={fieldErrors.recontacterLe ? INPUT_ERROR_CLASS : undefined}
          />
        </Field>

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
