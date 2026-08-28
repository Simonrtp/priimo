'use client';

import { useId, useState } from 'react';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import { ADDRESS_FIELD_INPUT_CLASS, Field, TextArea, TextInput } from '@/components/dashboard/workspace/Field';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import {
  composeTypedNote,
  EMPTY_TYPED_NOTE_DRAFT,
  showsAcquereurCriteria,
  showsPersonFields,
  showsSource,
  showsVendeurBien,
  TYPED_NOTE_KIND_OPTIONS,
  TYPED_NOTE_SOURCE_OPTIONS,
  type TypedNoteDraft,
  type TypedNoteKind,
} from '@/lib/notes/typed-compose';
import type { NoteExtraction } from '@/lib/notes/propositions';
import type { NoteSourceInfo } from '@/types/contact';

export type TypedNoteSubmitPayload = {
  transcript: string;
  draft: TypedNoteDraft;
  extraction: NoteExtraction;
  adresse: string;
  banCoords: { latitude: number; longitude: number } | null;
};

export default function TypedNoteGuide({
  field,
  initialAdresse,
  saving,
  error,
  onCancel,
  onSubmit,
}: {
  field: boolean;
  initialAdresse: string;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (payload: TypedNoteSubmitPayload) => void;
}) {
  const kindGroupId = useId();
  const sourceGroupId = useId();
  const textId = useId();
  const addrId = useId();
  const [draft, setDraft] = useState<TypedNoteDraft>(EMPTY_TYPED_NOTE_DRAFT);
  const [adresseLabel, setAdresseLabel] = useState(initialAdresse);
  const [banCoords, setBanCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function patch<K extends keyof TypedNoteDraft>(key: K, value: TypedNoteDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    if (localError) setLocalError(null);
  }

  function onAddress(data: SelectedAddress | null) {
    if (!data) {
      setBanCoords(null);
      return;
    }
    setAdresseLabel(data.label);
    setBanCoords({ latitude: data.latitude, longitude: data.longitude });
  }

  function submit() {
    if (!draft.kind) {
      setLocalError('Choisissez d’abord le type de note.');
      return;
    }
    const composed = composeTypedNote(draft, adresseLabel);
    if (composed.transcript.length < 8) {
      setLocalError('Ajoutez une note ou quelques infos (m², nom…).');
      return;
    }
    onSubmit({
      transcript: composed.transcript,
      draft,
      extraction: composed.extraction,
      adresse: adresseLabel.trim(),
      banCoords,
    });
  }

  const kind = draft.kind;
  const shownError = localError ?? error;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-6">
      <ChoicePills
        legend="De quoi parle cette note ?"
        groupId={kindGroupId}
        value={kind}
        options={TYPED_NOTE_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        onChange={(v) => patch('kind', v as TypedNoteKind)}
      />

      {kind ? (
        <>
          {showsSource(kind) ? (
            <ChoicePills
              legend="Qui vous a renseigné ?"
              groupId={sourceGroupId}
              value={draft.sourceInfo || null}
              options={TYPED_NOTE_SOURCE_OPTIONS}
              onChange={(v) => patch('sourceInfo', v as NoteSourceInfo)}
            />
          ) : null}

          {showsPersonFields(kind) ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Prénom" htmlFor="typed-fn">
                  <TextInput
                    id="typed-fn"
                    value={draft.firstName}
                    onChange={(e) => patch('firstName', e.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Nom" htmlFor="typed-ln">
                  <TextInput
                    id="typed-ln"
                    value={draft.lastName}
                    onChange={(e) => patch('lastName', e.target.value)}
                    autoComplete="off"
                  />
                </Field>
              </div>
              <Field label="Téléphone" htmlFor="typed-phone">
                <TextInput
                  id="typed-phone"
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => patch('phone', e.target.value)}
                  autoComplete="off"
                />
              </Field>
            </div>
          ) : null}

          {showsVendeurBien(kind) ? (
            <fieldset>
              <legend className="mb-2.5 font-medium text-text-strong" style={{ fontSize: 14 }}>
                Le bien
              </legend>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Surface m²" htmlFor="typed-surface">
                  <TextInput
                    id="typed-surface"
                    inputMode="numeric"
                    value={draft.surface}
                    onChange={(e) => patch('surface', e.target.value)}
                  />
                </Field>
                <Field label="Pièces" htmlFor="typed-rooms">
                  <TextInput
                    id="typed-rooms"
                    inputMode="numeric"
                    value={draft.rooms}
                    onChange={(e) => patch('rooms', e.target.value)}
                  />
                </Field>
                <Field label="Prix €" htmlFor="typed-prix">
                  <TextInput
                    id="typed-prix"
                    inputMode="numeric"
                    value={draft.prix}
                    onChange={(e) => patch('prix', e.target.value)}
                  />
                </Field>
              </div>
            </fieldset>
          ) : null}

          {showsAcquereurCriteria(kind) ? (
            <fieldset>
              <legend className="mb-2.5 font-medium text-text-strong" style={{ fontSize: 14 }}>
                Ce qu’il cherche
              </legend>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Budget €" htmlFor="typed-budget">
                  <TextInput
                    id="typed-budget"
                    inputMode="numeric"
                    value={draft.prix}
                    onChange={(e) => patch('prix', e.target.value)}
                  />
                </Field>
                <Field label="Surface m²" htmlFor="typed-surf-min">
                  <TextInput
                    id="typed-surf-min"
                    inputMode="numeric"
                    value={draft.surface}
                    onChange={(e) => patch('surface', e.target.value)}
                  />
                </Field>
                <Field label="Pièces" htmlFor="typed-rooms-min">
                  <TextInput
                    id="typed-rooms-min"
                    inputMode="numeric"
                    value={draft.rooms}
                    onChange={(e) => patch('rooms', e.target.value)}
                  />
                </Field>
              </div>
            </fieldset>
          ) : null}

          <Field label="Note" htmlFor={textId}>
            <TextArea
              id={textId}
              value={draft.body}
              onChange={(e) => patch('body', e.target.value)}
              rows={field ? 7 : 5}
              placeholder="Ce que vous venez de vivre, ce qu’il faut retenir…"
            />
          </Field>

          <Field
            label="Immeuble"
            htmlFor={addrId}
            hint="Optionnel — pour rattacher la note à un immeuble, une fois le fond écrit."
          >
            <AddressAutocomplete
              id={addrId}
              value={adresseLabel}
              onChange={onAddress}
              onQueryChange={(q) => setAdresseLabel(q)}
              placeholder="Rattacher à un immeuble…"
              inputClassName={ADDRESS_FIELD_INPUT_CLASS}
            />
          </Field>
        </>
      ) : (
        <p className="text-pretty text-text-muted" style={{ fontSize: 13.5, lineHeight: 1.45 }}>
          Choisissez un type : les champs utiles s’affichent ensuite. L’adresse vient en dernier,
          pour poser la note sur un immeuble.
        </p>
      )}

      {shownError ? (
        <p className="text-pretty text-[13.5px] text-text" role="alert">
          {shownError}
        </p>
      ) : null}

      <div className="mt-auto flex gap-2.5 pt-2">
        <WorkspaceButton type="button" variant="secondary" onClick={onCancel} className="flex-1 sm:flex-none">
          Annuler
        </WorkspaceButton>
        <WorkspaceButton
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex-1 sm:flex-none"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </WorkspaceButton>
      </div>
    </div>
  );
}

function ChoicePills({
  legend,
  groupId,
  value,
  options,
  onChange,
}: {
  legend: string;
  groupId: string;
  value: string | null;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2.5 font-medium text-text-muted" style={{ fontSize: 12.5 }}>
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          const id = `${groupId}-${opt.value}`;
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={`inline-flex min-h-[40px] cursor-pointer items-center rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition-colors duration-fluid-subtle ease-in-out has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                selected
                  ? 'border-accent bg-accent/10 text-text-strong'
                  : 'border-black/[0.10] bg-surface text-text hover:border-black/[0.16]'
              }`}
            >
              <input
                id={id}
                type="radio"
                name={groupId}
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
