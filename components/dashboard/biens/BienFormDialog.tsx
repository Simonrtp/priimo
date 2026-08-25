'use client';

import { useState } from 'react';
import type { Bien, HonorairesACharge, MandatStatut } from '@/types/bien';
import {
  DPE_LETTRE_ORDER,
  HONORAIRES_A_CHARGE_LABELS,
  HONORAIRES_A_CHARGE_ORDER,
  MANDAT_STATUT_LABELS,
  MANDAT_STATUT_ORDER,
  PROPERTY_TYPE_OPTIONS,
} from '@/types/bien';
import type { Contact } from '@/types/contact';
import { notifyError, notifySuccess } from '@/lib/notify';
import { normalizePhotoUrls } from '@/lib/bien-input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { Field, TextArea, TextInput } from '@/components/dashboard/workspace/Field';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';

interface FormState {
  address: string;
  postalCode: string;
  city: string;
  propertyType: string;
  surfaceM2: string;
  rooms: string;
  price: string;
  mandatStatut: MandatStatut;
  mandatNumero: string;
  mandatDate: string;
  proprietaireContactId: string;
  listingTitle: string;
  listingDescription: string;
  photos: string[];
  dpeLettre: string;
  dpeKwh: string;
  gesLettre: string;
  gesKgCo2: string;
  dpeVierge: boolean;
  dpeDate: string;
  honorairesMontant: string;
  honorairesACharge: string;
  honorairesPourcent: string;
}

const EMPTY: FormState = {
  address: '',
  postalCode: '',
  city: '',
  propertyType: '',
  surfaceM2: '',
  rooms: '',
  price: '',
  mandatStatut: 'estimation',
  mandatNumero: '',
  mandatDate: '',
  proprietaireContactId: '',
  listingTitle: '',
  listingDescription: '',
  photos: [],
  dpeLettre: '',
  dpeKwh: '',
  gesLettre: '',
  gesKgCo2: '',
  dpeVierge: false,
  dpeDate: '',
  honorairesMontant: '',
  honorairesACharge: '',
  honorairesPourcent: '',
};

function fromBien(bien: Bien): FormState {
  return {
    address: bien.address,
    postalCode: bien.postalCode ?? '',
    city: bien.city ?? '',
    propertyType: bien.propertyType ?? '',
    surfaceM2: bien.surfaceM2 === null ? '' : String(bien.surfaceM2),
    rooms: bien.rooms === null ? '' : String(bien.rooms),
    price: bien.price === null ? '' : String(bien.price),
    mandatStatut: bien.mandatStatut,
    mandatNumero: bien.mandatNumero ?? '',
    mandatDate: bien.mandatDate ?? '',
    proprietaireContactId: bien.proprietaireContactId ?? '',
    listingTitle: bien.listingTitle ?? '',
    listingDescription: bien.listingDescription ?? '',
    photos: bien.photos,
    dpeLettre: bien.dpeLettre ?? '',
    dpeKwh: bien.dpeKwh === null ? '' : String(bien.dpeKwh),
    gesLettre: bien.gesLettre ?? '',
    gesKgCo2: bien.gesKgCo2 === null ? '' : String(bien.gesKgCo2),
    dpeVierge: bien.dpeVierge,
    dpeDate: bien.dpeDate ?? '',
    honorairesMontant: bien.honorairesMontant === null ? '' : String(bien.honorairesMontant),
    honorairesACharge: bien.honorairesACharge ?? '',
    honorairesPourcent: bien.honorairesPourcent === null ? '' : String(bien.honorairesPourcent),
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-black/[0.06] pt-6">
      <legend className="sr-only">{title}</legend>
      <p className="mb-4 text-[14px] font-medium text-text-strong">{title}</p>
      {children}
    </fieldset>
  );
}

export default function BienFormDialog({
  open,
  onClose,
  bien,
  vendeurs,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  bien?: Bien;
  vendeurs: Contact[];
  onSaved: (bien: Bien) => void;
}) {
  const [form, setForm] = useState<FormState>(bien ? fromBien(bien) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [photoDraft, setPhotoDraft] = useState('');

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addPhoto() {
    const next = normalizePhotoUrls([...form.photos, photoDraft]);
    if (next.length === form.photos.length) {
      notifyError("Collez l'adresse https d'une photo");
      return;
    }
    set('photos', next);
    setPhotoDraft('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const res = await fetch(bien ? `/api/dashboard/biens/${bien.id}` : '/api/dashboard/biens', {
        method: bien ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          proprietaireContactId: form.proprietaireContactId || null,
          honorairesACharge: (form.honorairesACharge || null) as HonorairesACharge | null,
        }),
      });
      const data = (await res.json()) as { bien?: Bien; error?: string };

      if (!res.ok || !data.bien) {
        notifyError(data.error ?? "Le bien n'a pas pu être enregistré");
        return;
      }

      notifySuccess(bien ? 'Bien mis à jour' : 'Bien ajouté');
      onSaved(data.bien);
      onClose();
    } catch {
      notifyError("Le bien n'a pas pu être enregistré");
    } finally {
      setSaving(false);
    }
  }

  const typeOptions = PROPERTY_TYPE_OPTIONS.includes(form.propertyType)
    ? PROPERTY_TYPE_OPTIONS
    : form.propertyType
      ? [form.propertyType, ...PROPERTY_TYPE_OPTIONS]
      : PROPERTY_TYPE_OPTIONS;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bien ? 'Modifier le bien' : 'Nouveau bien'}
      maxWidth="xl"
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        <Field label="Adresse" htmlFor="bien-address">
          <TextInput
            id="bien-address"
            required
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="12 rue de la Monnaie"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Code postal" htmlFor="bien-postal" hint="Nécessaire pour proposer des acquéreurs">
            <TextInput
              id="bien-postal"
              inputMode="numeric"
              value={form.postalCode}
              onChange={(e) => set('postalCode', e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
              placeholder="59000"
            />
          </Field>
          <Field label="Ville" htmlFor="bien-city">
            <TextInput id="bien-city" value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Type" htmlFor="bien-type">
            <Select
              id="bien-type"
              value={form.propertyType}
              onChange={(v) => set('propertyType', v)}
              options={[
                { value: '', label: 'À préciser' },
                ...typeOptions.map((t) => ({ value: t, label: t })),
              ]}
              aria-label="Type de bien"
            />
          </Field>
          <Field label="Surface" htmlFor="bien-surface" hint="En m²">
            <TextInput
              id="bien-surface"
              inputMode="numeric"
              value={form.surfaceM2}
              onChange={(e) => set('surfaceM2', e.target.value.replace(/[^\d]/g, ''))}
            />
          </Field>
          <Field label="Pièces" htmlFor="bien-rooms">
            <TextInput
              id="bien-rooms"
              inputMode="numeric"
              value={form.rooms}
              onChange={(e) => set('rooms', e.target.value.replace(/[^\d]/g, ''))}
            />
          </Field>
        </div>

        <Field
          label="Propriétaire"
          htmlFor="bien-owner"
          hint={vendeurs.length === 0 ? 'Créez d’abord un contact de type vendeur' : undefined}
        >
          <Select
            id="bien-owner"
            value={form.proprietaireContactId}
            onChange={(v) => set('proprietaireContactId', v)}
            disabled={vendeurs.length === 0}
            options={[
              { value: '', label: 'Aucun propriétaire rattaché' },
              ...vendeurs.map((c) => ({ value: c.id, label: c.fullName })),
            ]}
            aria-label="Propriétaire rattaché"
          />
        </Field>

        <Section title="Annonce">
          <p className="mb-4 text-pretty text-[13px] text-text-muted">
            Ces champs servent à préparer un fichier d’export. Rien n’est envoyé à un portail.
          </p>
          <div className="flex flex-col gap-4">
            <Field label="Titre de l’annonce" htmlFor="bien-titre">
              <TextInput
                id="bien-titre"
                value={form.listingTitle}
                onChange={(e) => set('listingTitle', e.target.value)}
                placeholder="Appartement 3 pièces, Vieux-Lille"
              />
            </Field>
            <Field label="Description" htmlFor="bien-description">
              <TextArea
                id="bien-description"
                rows={5}
                value={form.listingDescription}
                onChange={(e) => set('listingDescription', e.target.value)}
              />
            </Field>
            <Field
              label="Photos"
              htmlFor="bien-photo-url"
              hint="Adresses https des visuels. L’hébergement des fichiers viendra plus tard."
            >
              {form.photos.length > 0 ? (
                <ul className="mb-3 flex flex-col gap-2">
                  {form.photos.map((url) => (
                    <li key={url} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text">{url}</span>
                      <button
                        type="button"
                        onClick={() => set('photos', form.photos.filter((p) => p !== url))}
                        className="flex-shrink-0 text-[13px] font-medium text-danger hover:underline"
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <TextInput
                  id="bien-photo-url"
                  value={photoDraft}
                  onChange={(e) => setPhotoDraft(e.target.value)}
                  placeholder="https://"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPhoto();
                    }
                  }}
                />
                <WorkspaceButton type="button" variant="secondary" onClick={addPhoto}>
                  Ajouter
                </WorkspaceButton>
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Prix et honoraires">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Prix de vente" htmlFor="bien-price" hint="En euros">
              <TextInput
                id="bien-price"
                inputMode="numeric"
                value={form.price}
                onChange={(e) => set('price', e.target.value.replace(/[^\d]/g, ''))}
              />
            </Field>
            <Field label="Honoraires TTC" htmlFor="bien-honoraires" hint="En euros">
              <TextInput
                id="bien-honoraires"
                inputMode="numeric"
                value={form.honorairesMontant}
                onChange={(e) => set('honorairesMontant', e.target.value.replace(/[^\d]/g, ''))}
              />
            </Field>
            <Field label="Honoraires à la charge de" htmlFor="bien-honoraires-charge">
              <Select
                id="bien-honoraires-charge"
                value={form.honorairesACharge}
                onChange={(v) => set('honorairesACharge', v)}
                options={[
                  { value: '', label: 'À préciser' },
                  ...HONORAIRES_A_CHARGE_ORDER.map((c) => ({
                    value: c,
                    label: HONORAIRES_A_CHARGE_LABELS[c],
                  })),
                ]}
                aria-label="Honoraires à la charge de"
              />
            </Field>
            <Field label="Honoraires en %" htmlFor="bien-honoraires-pct" hint="Facultatif">
              <TextInput
                id="bien-honoraires-pct"
                inputMode="decimal"
                value={form.honorairesPourcent}
                onChange={(e) => set('honorairesPourcent', e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="4,8"
              />
            </Field>
          </div>
        </Section>

        <Section title="Mandat">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Statut du mandat" htmlFor="bien-statut">
              <Select
                id="bien-statut"
                value={form.mandatStatut}
                onChange={(v) => set('mandatStatut', v as MandatStatut)}
                options={MANDAT_STATUT_ORDER.map((s) => ({ value: s, label: MANDAT_STATUT_LABELS[s] }))}
                aria-label="Statut du mandat"
              />
            </Field>
            <Field label="N° de mandat" htmlFor="bien-mandat-numero">
              <TextInput
                id="bien-mandat-numero"
                value={form.mandatNumero}
                onChange={(e) => set('mandatNumero', e.target.value)}
              />
            </Field>
            <Field label="Date du mandat" htmlFor="bien-mandat-date">
              <TextInput
                id="bien-mandat-date"
                type="date"
                value={form.mandatDate}
                onChange={(e) => set('mandatDate', e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="DPE">
          <label className="mb-4 flex items-center gap-2 text-[14px] text-text">
            <input
              type="checkbox"
              checked={form.dpeVierge}
              onChange={(e) => set('dpeVierge', e.target.checked)}
              className="size-4 rounded border-black/20"
            />
            DPE vierge
          </label>
          <p className="mb-4 text-pretty text-[12.5px] text-text-subtle">
            Depuis 2021, la plupart des ventes exigent un DPE complet. Ne cochez cette case que si
            le diagnostic est réellement vierge.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Étiquette énergie" htmlFor="bien-dpe-lettre">
              <Select
                id="bien-dpe-lettre"
                value={form.dpeLettre}
                onChange={(v) => set('dpeLettre', v)}
                disabled={form.dpeVierge}
                options={[
                  { value: '', label: 'À préciser' },
                  ...DPE_LETTRE_ORDER.map((l) => ({ value: l, label: l })),
                ]}
                aria-label="Étiquette énergie DPE"
              />
            </Field>
            <Field label="Consommation" htmlFor="bien-dpe-kwh" hint="kWh/m².an">
              <TextInput
                id="bien-dpe-kwh"
                inputMode="numeric"
                disabled={form.dpeVierge}
                value={form.dpeKwh}
                onChange={(e) => set('dpeKwh', e.target.value.replace(/[^\d]/g, ''))}
              />
            </Field>
            <Field label="Étiquette GES" htmlFor="bien-ges-lettre">
              <Select
                id="bien-ges-lettre"
                value={form.gesLettre}
                onChange={(v) => set('gesLettre', v)}
                disabled={form.dpeVierge}
                options={[
                  { value: '', label: 'À préciser' },
                  ...DPE_LETTRE_ORDER.map((l) => ({ value: l, label: l })),
                ]}
                aria-label="Étiquette GES"
              />
            </Field>
            <Field label="Émissions GES" htmlFor="bien-ges-kg" hint="kg CO₂/m².an">
              <TextInput
                id="bien-ges-kg"
                inputMode="numeric"
                disabled={form.dpeVierge}
                value={form.gesKgCo2}
                onChange={(e) => set('gesKgCo2', e.target.value.replace(/[^\d]/g, ''))}
              />
            </Field>
            <Field label="Date du DPE" htmlFor="bien-dpe-date">
              <TextInput
                id="bien-dpe-date"
                type="date"
                disabled={form.dpeVierge}
                value={form.dpeDate}
                onChange={(e) => set('dpeDate', e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {bien ? (
          <div className="border-t border-black/[0.06] pt-5">
            <h3
              className="mb-3 font-semibold uppercase text-text-subtle"
              style={{ fontSize: 11, letterSpacing: '0.08em' }}
            >
              Notes terrain
            </h3>
            <NotesTerrainList entiteType="bien" entiteId={bien.id} />
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3 border-t border-black/[0.06] pt-5">
          <WorkspaceButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </WorkspaceButton>
          <WorkspaceButton type="submit" disabled={saving}>
            {saving ? 'Enregistrement…' : bien ? 'Enregistrer' : 'Ajouter le bien'}
          </WorkspaceButton>
        </div>
      </form>
    </Modal>
  );
}
