'use client';

import type { ContactType } from '@/types/contact';
import { CONTACT_TYPE_LABELS, CONTACT_TYPE_ORDER, typeUsesCriteria } from '@/types/contact';
import type { ContactFieldErrors, ContactInputFields } from '@/lib/contact-input';
import { CONTACT_NOTE_HINT } from '@/lib/contact-input';
import Select from '@/components/ui/Select';
import DatePickerField from '@/components/ui/DatePickerField';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import { secteurFromSelectedAddress } from '@/lib/ban';
import {
  ADDRESS_FIELD_INPUT_CLASS,
  Field,
  INPUT_ERROR_CLASS,
  PhoneInput,
  TextArea,
  TextInput,
} from '@/components/dashboard/workspace/Field';
import AssigneeSelect, { type AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import ConsentementRappelField from '@/components/dashboard/contacts/ConsentementRappelField';

export type ContactFormGeo = {
  banId: string | null;
  latitude: number | null;
  longitude: number | null;
};

export default function ContactFormFields({
  idPrefix,
  fields,
  onFields,
  assignedTo,
  onAssignedTo,
  geo,
  onGeo,
  members,
  currentUserId,
  fieldErrors = {},
  disabled = false,
}: {
  idPrefix: string;
  fields: ContactInputFields;
  onFields: (next: ContactInputFields) => void;
  assignedTo: string | null;
  onAssignedTo: (id: string | null) => void;
  geo: ContactFormGeo;
  onGeo: (geo: ContactFormGeo) => void;
  members: readonly AssigneeOption[];
  currentUserId?: string;
  fieldErrors?: ContactFieldErrors;
  disabled?: boolean;
}) {
  const showCriteria = typeUsesCriteria(fields.type);
  const immeubleType = fields.type === 'gardien' || fields.type === 'commercant';

  function set<K extends keyof ContactInputFields>(key: K, value: ContactInputFields[K]) {
    onFields({ ...fields, [key]: value });
  }

  function setNumber(key: keyof ContactInputFields, raw: string) {
    const digits = raw.replace(/[^\d]/g, '');
    onFields({ ...fields, [key]: digits ? Number(digits) : null });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor={`${idPrefix}-first`} error={fieldErrors.firstName}>
          <TextInput
            id={`${idPrefix}-first`}
            value={fields.firstName}
            disabled={disabled}
            onChange={(e) => set('firstName', e.target.value)}
            autoComplete="off"
            invalid={Boolean(fieldErrors.firstName)}
            aria-describedby={fieldErrors.firstName ? `${idPrefix}-first-error` : undefined}
          />
        </Field>
        <Field label="Nom" htmlFor={`${idPrefix}-last`} error={fieldErrors.lastName}>
          <TextInput
            id={`${idPrefix}-last`}
            value={fields.lastName}
            disabled={disabled}
            onChange={(e) => set('lastName', e.target.value)}
            autoComplete="off"
            invalid={Boolean(fieldErrors.lastName)}
            aria-describedby={fieldErrors.lastName ? `${idPrefix}-last-error` : undefined}
          />
        </Field>
      </div>

      <Field label="Type de personne" htmlFor={`${idPrefix}-type`}>
        <Select
          id={`${idPrefix}-type`}
          value={fields.type}
          disabled={disabled}
          onChange={(v) => set('type', (v || 'autre') as ContactType)}
          options={CONTACT_TYPE_ORDER.map((t) => ({ value: t, label: CONTACT_TYPE_LABELS[t] }))}
          aria-label="Type de personne"
        />
      </Field>

      <Field
        label={immeubleType ? 'Immeuble' : 'Adresse'}
        htmlFor={`${idPrefix}-address`}
        hint={
          immeubleType
            ? 'L’immeuble de rattachement, pas une adresse personnelle'
            : 'Choisissez une proposition : le secteur se remplit tout seul'
        }
      >
        <AddressAutocomplete
          id={`${idPrefix}-address`}
          value={fields.address ?? ''}
          onChange={(data: SelectedAddress | null) => {
            if (!data) return;
            const secteur = secteurFromSelectedAddress(data);
            const postal = data.postcode?.trim() ?? '';
            onFields({
              ...fields,
              address: data.label,
              secteur: secteur ?? fields.secteur,
              postalCodes:
                /^\d{5}$/.test(postal) && !fields.postalCodes.includes(postal)
                  ? [...fields.postalCodes, postal].slice(0, 20)
                  : fields.postalCodes,
            });
            onGeo({
              banId: data.id ?? null,
              latitude: data.latitude,
              longitude: data.longitude,
            });
          }}
          onQueryChange={(q) => {
            set('address', q.trim() || null);
            onGeo({ ...geo, banId: null, latitude: null, longitude: null });
          }}
          placeholder="12 rue de la Monnaie, Lille"
          inputClassName={ADDRESS_FIELD_INPUT_CLASS}
        />
      </Field>

      <Field
        label="Secteur"
        htmlFor={`${idPrefix}-secteur`}
        hint="Rempli depuis l’adresse — vous pouvez le préciser (quartier, commune…)"
      >
        <TextInput
          id={`${idPrefix}-secteur`}
          value={fields.secteur ?? ''}
          disabled={disabled}
          onChange={(e) => set('secteur', e.target.value || null)}
          placeholder="Vieux Lille"
        />
      </Field>

      {members.length > 0 ? (
        <Field label="Assigner à" htmlFor={`${idPrefix}-assignee`}>
          <AssigneeSelect
            id={`${idPrefix}-assignee`}
            value={assignedTo}
            members={members}
            currentUserId={currentUserId}
            includeUnassigned
            onChange={onAssignedTo}
          />
        </Field>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Téléphone" htmlFor={`${idPrefix}-phone`}>
          <PhoneInput
            id={`${idPrefix}-phone`}
            value={fields.phone ?? ''}
            consenti={fields.numeroCommuniqueParLaPersonne}
            disabled={disabled}
            onChange={(e) => set('phone', e.target.value || null)}
          />
        </Field>
        <Field label="Email" htmlFor={`${idPrefix}-email`} error={fieldErrors.email}>
          <TextInput
            id={`${idPrefix}-email`}
            type="email"
            value={fields.email ?? ''}
            disabled={disabled}
            onChange={(e) => set('email', e.target.value || null)}
            invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? `${idPrefix}-email-error` : undefined}
          />
        </Field>
      </div>

      <ConsentementRappelField
        id={`${idPrefix}-numero-communique`}
        checked={fields.numeroCommuniqueParLaPersonne}
        onChange={(checked) => set('numeroCommuniqueParLaPersonne', checked)}
      />

      {showCriteria ? (
        <fieldset className="border-t border-black/[0.06] pt-6">
          <legend className="sr-only">Critères de recherche</legend>
          <p className="mb-4 font-medium text-text-strong" style={{ fontSize: 14 }}>
            Ce qu&apos;il recherche
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Budget minimum" htmlFor={`${idPrefix}-budget-min`} error={fieldErrors.budgetMin}>
              <TextInput
                id={`${idPrefix}-budget-min`}
                inputMode="numeric"
                value={fields.budgetMin ?? ''}
                disabled={disabled}
                onChange={(e) => setNumber('budgetMin', e.target.value)}
                placeholder="En euros"
                invalid={Boolean(fieldErrors.budgetMin)}
              />
            </Field>
            <Field label="Budget maximum" htmlFor={`${idPrefix}-budget-max`} error={fieldErrors.budgetMax}>
              <TextInput
                id={`${idPrefix}-budget-max`}
                inputMode="numeric"
                value={fields.budgetMax ?? ''}
                disabled={disabled}
                onChange={(e) => setNumber('budgetMax', e.target.value)}
                placeholder="En euros"
                invalid={Boolean(fieldErrors.budgetMax)}
              />
            </Field>
            <Field label="Surface minimum" htmlFor={`${idPrefix}-surface-min`} error={fieldErrors.surfaceMin}>
              <TextInput
                id={`${idPrefix}-surface-min`}
                inputMode="numeric"
                value={fields.surfaceMin ?? ''}
                disabled={disabled}
                onChange={(e) => setNumber('surfaceMin', e.target.value)}
                placeholder="En m²"
                invalid={Boolean(fieldErrors.surfaceMin)}
              />
            </Field>
            <Field label="Pièces minimum" htmlFor={`${idPrefix}-rooms`}>
              <TextInput
                id={`${idPrefix}-rooms`}
                inputMode="numeric"
                value={fields.roomsMin ?? ''}
                disabled={disabled}
                onChange={(e) => setNumber('roomsMin', e.target.value)}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field
              label="Codes postaux recherchés"
              htmlFor={`${idPrefix}-postal`}
              hint="Séparés par des virgules. Ce sont eux qui déclenchent les rapprochements."
            >
              <TextInput
                id={`${idPrefix}-postal`}
                value={fields.postalCodes.join(', ')}
                disabled={disabled}
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
        htmlFor={`${idPrefix}-relance`}
        hint="Le jour où il faudra reprendre contact. Une date arrivée remonte sur l’Accueil."
        error={fieldErrors.recontacterLe}
      >
        <DatePickerField
          id={`${idPrefix}-relance`}
          value={fields.recontacterLe}
          onChange={(v) => set('recontacterLe', v)}
          aria-label="Date de relance"
          disabled={disabled}
          className={fieldErrors.recontacterLe ? INPUT_ERROR_CLASS : undefined}
        />
      </Field>

      <Field label="Résumé" htmlFor={`${idPrefix}-summary`} hint={CONTACT_NOTE_HINT}>
        <TextArea
          id={`${idPrefix}-summary`}
          rows={4}
          value={fields.summary ?? ''}
          disabled={disabled}
          onChange={(e) => set('summary', e.target.value || null)}
          aria-describedby={`${idPrefix}-summary-hint`}
        />
      </Field>
    </div>
  );
}
