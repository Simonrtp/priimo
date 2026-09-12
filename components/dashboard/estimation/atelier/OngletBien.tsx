'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import { Field, TextArea, TextInput, ADDRESS_FIELD_INPUT_CLASS } from '@/components/dashboard/workspace/Field';
import Select from '@/components/ui/Select';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import SectionRepliable from './SectionRepliable';
import CartePosition from './CartePosition';
import { optionsEtage, optionsEtagesImmeuble } from '@/lib/estimation/etages';
import { optionsQualiteEmplacement } from '@/lib/estimation/qualite-emplacement';
import { optionsNiveaux } from '@/lib/estimation/niveaux';
import { optionsSousType } from '@/lib/estimation/sous-types';
import { suggestionsPoints } from '@/lib/estimation/suggestions';
import type { EstimationAnnexe, EstimationBien, EstimationObjet, EstimationPhoto } from '@/lib/estimation/objet';

const DPE = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

function optionsAnneesConstruction(selected: number | null) {
  const max = new Date().getFullYear();
  const min = 1800;
  const set = new Set<number>();
  if (selected != null) set.add(selected);
  for (let y = max; y >= min; y--) set.add(y);
  return [
    { value: '', label: 'Non renseigné' },
    ...[...set].sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) })),
  ];
}

export default function OngletBien({
  estimation,
  parkingMedian,
  onPatch,
}: {
  estimation: EstimationObjet;
  parkingMedian: number | null;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  const [carte, setCarte] = useState(false);
  const bien = estimation.bien;

  function setBien(partial: Partial<EstimationBien>) {
    onPatch({ bien: { ...bien, ...partial } });
  }

  function onAdresse(data: SelectedAddress | null) {
    if (!data) return;
    onPatch({
      address: data.label,
      postalCode: data.postcode,
      city: data.city,
      banId: data.id,
      latitude: data.latitude,
      longitude: data.longitude,
    });
  }

  function addAnnexe(libelle: string, defaut?: number | null) {
    const next: EstimationAnnexe[] = [
      ...estimation.annexes,
      {
        id: crypto.randomUUID(),
        libelle,
        surfaceM2: null,
        valorisationEur: defaut ?? null,
      },
    ];
    onPatch({ annexes: next });
  }

  function removeAnnexe(id: string) {
    onPatch({ annexes: estimation.annexes.filter((a) => a.id !== id) });
  }

  const suggestions = suggestionsPoints({
    dpeClass: estimation.dpeClass,
    occupation: estimation.occupation,
    bien,
    floor: estimation.floor,
    hasParking: estimation.annexes.some((a) => /parking|garage|box/i.test(a.libelle)),
  });

  return (
    <div className="flex flex-col gap-3">
      <SectionRepliable titre="Localisation" ouvertDefaut>
        <Field label="Adresse" htmlFor="est-adresse">
          <AddressAutocomplete
            id="est-adresse"
            value={estimation.address ?? ''}
            onChange={onAdresse}
            inputClassName={ADDRESS_FIELD_INPUT_CLASS}
          />
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          <WorkspaceButton type="button" variant="secondary" onClick={() => setCarte(true)}>
            Positionner sur la carte
          </WorkspaceButton>
          {estimation.parcelleId ? (
            <p className="self-center text-[12.5px] text-text-muted">Parcelle {estimation.parcelleId}</p>
          ) : null}
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Le bien" ouvertDefaut>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type" htmlFor="est-type">
            <Select
              id="est-type"
              value={estimation.propertyType ?? ''}
              options={[
                { value: '', label: 'Non renseigné' },
                { value: 'appartement', label: 'Appartement' },
                { value: 'maison', label: 'Maison' },
              ]}
              onChange={(v) => onPatch({ propertyType: v || null })}
            />
          </Field>
          <Field label="Sous-type" htmlFor="est-sous">
            <Select
              id="est-sous"
              searchable
              searchPlaceholder="Rechercher…"
              value={bien.sousType ?? ''}
              options={optionsSousType(bien.sousType)}
              onChange={(v) => setBien({ sousType: v || null })}
            />
          </Field>
          <Field label="Année de construction" htmlFor="est-annee">
            <Select
              id="est-annee"
              searchable
              searchPlaceholder="Année…"
              value={bien.anneeConstruction != null ? String(bien.anneeConstruction) : ''}
              options={optionsAnneesConstruction(bien.anneeConstruction)}
              onChange={(v) => setBien({ anneeConstruction: v ? Number(v) : null })}
            />
          </Field>
          <Field label="Pièces" htmlFor="est-pieces">
            <TextInput
              id="est-pieces"
              inputMode="numeric"
              value={estimation.rooms ?? ''}
              onChange={(e) => onPatch({ rooms: Number(e.target.value) || null })}
            />
          </Field>
          <Field label="Chambres" htmlFor="est-chambres">
            <TextInput
              id="est-chambres"
              inputMode="numeric"
              value={bien.chambres ?? ''}
              onChange={(e) => setBien({ chambres: Number(e.target.value) || null })}
            />
          </Field>
          <Field label="Surface habitable (m²)" htmlFor="est-surf">
            <TextInput
              id="est-surf"
              inputMode="numeric"
              value={estimation.surfaceM2 ?? ''}
              onChange={(e) => onPatch({ surfaceM2: Number(e.target.value) || null })}
            />
          </Field>
          <Field label="Carrez" htmlFor="est-carrez">
            <Select
              id="est-carrez"
              value={bien.carrez == null ? '' : bien.carrez ? 'oui' : 'non'}
              options={[
                { value: '', label: 'Non renseigné' },
                { value: 'oui', label: 'Oui' },
                { value: 'non', label: 'Non' },
              ]}
              onChange={(v) => setBien({ carrez: v === '' ? null : v === 'oui' })}
            />
          </Field>
          <Field label="Terrain (m²)" htmlFor="est-terrain">
            <TextInput
              id="est-terrain"
              inputMode="numeric"
              value={bien.surfaceTerrain ?? ''}
              onChange={(e) => setBien({ surfaceTerrain: Number(e.target.value) || null })}
            />
          </Field>
          <Field label="Niveaux" htmlFor="est-niveaux">
            <Select
              id="est-niveaux"
              value={bien.niveaux != null ? String(bien.niveaux) : ''}
              options={optionsNiveaux(bien.niveaux)}
              onChange={(v) => setBien({ niveaux: v ? Number(v) : null })}
            />
          </Field>
          <Field label="Étage" htmlFor="est-etage">
            <Select
              id="est-etage"
              value={estimation.floor ?? ''}
              options={optionsEtage(estimation.floor ?? null)}
              onChange={(v) => onPatch({ floor: v || null })}
            />
          </Field>
          <Field label="Étages de l’immeuble" htmlFor="est-etages">
            <Select
              id="est-etages"
              value={bien.etagesImmeuble != null ? String(bien.etagesImmeuble) : ''}
              options={optionsEtagesImmeuble(bien.etagesImmeuble)}
              onChange={(v) => setBien({ etagesImmeuble: v ? Number(v) : null })}
            />
          </Field>
          <Field label="Dernier étage" htmlFor="est-dernier">
            <Select
              id="est-dernier"
              value={bien.dernierEtage == null ? '' : bien.dernierEtage ? 'oui' : 'non'}
              options={[
                { value: '', label: 'Non renseigné' },
                { value: 'oui', label: 'Oui' },
                { value: 'non', label: 'Non' },
              ]}
              onChange={(v) => setBien({ dernierEtage: v === '' ? null : v === 'oui' })}
            />
          </Field>
          <Field label="Qualité d’emplacement" htmlFor="est-empl">
            <Select
              id="est-empl"
              value={bien.qualiteEmplacement ?? ''}
              options={optionsQualiteEmplacement(bien.qualiteEmplacement)}
              onChange={(v) => setBien({ qualiteEmplacement: v || null })}
            />
          </Field>
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Équipement">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ascenseur" htmlFor="est-asc">
            <Select
              id="est-asc"
              value={bien.ascenseur == null ? '' : bien.ascenseur ? 'oui' : 'non'}
              options={[
                { value: '', label: 'Non renseigné' },
                { value: 'oui', label: 'Oui' },
                { value: 'non', label: 'Non' },
              ]}
              onChange={(v) => setBien({ ascenseur: v === '' ? null : v === 'oui' })}
            />
          </Field>
          <Field label="Balcon ou terrasse" htmlFor="est-balcon">
            <Select
              id="est-balcon"
              value={bien.balconTerrasse == null ? '' : bien.balconTerrasse ? 'oui' : 'non'}
              options={[
                { value: '', label: 'Non renseigné' },
                { value: 'oui', label: 'Oui' },
                { value: 'non', label: 'Non' },
              ]}
              onChange={(v) => setBien({ balconTerrasse: v === '' ? null : v === 'oui' })}
            />
          </Field>
          <Field label="Occupation" htmlFor="est-occ">
            <Select
              id="est-occ"
              value={estimation.occupation}
              options={[
                { value: 'libre', label: 'Libre à la vente' },
                { value: 'occupe', label: 'Occupé' },
              ]}
              onChange={(v) => onPatch({ occupation: v })}
            />
          </Field>
          {estimation.occupation === 'occupe' ? (
            <Field label="Loyer annuel (€)" htmlFor="est-loyer">
              <TextInput
                id="est-loyer"
                inputMode="numeric"
                value={estimation.loyerAnnuel ?? ''}
                onChange={(e) => onPatch({ loyerAnnuel: Number(e.target.value) || null })}
              />
            </Field>
          ) : null}
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Charges">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Charges annuelles" htmlFor="est-ch-an">
            <TextInput
              id="est-ch-an"
              inputMode="numeric"
              value={bien.chargesAnnuelles ?? ''}
              onChange={(e) => setBien({ chargesAnnuelles: Number(e.target.value) || null })}
            />
          </Field>
          <Field label="Charges de copropriété" htmlFor="est-ch-copro">
            <TextInput
              id="est-ch-copro"
              inputMode="numeric"
              value={bien.chargesCopro ?? ''}
              onChange={(e) => setBien({ chargesCopro: Number(e.target.value) || null })}
            />
          </Field>
          <Field label="Taxe foncière" htmlFor="est-tf">
            <TextInput
              id="est-tf"
              inputMode="numeric"
              value={bien.taxeFonciere ?? ''}
              onChange={(e) => setBien({ taxeFonciere: Number(e.target.value) || null })}
            />
          </Field>
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Annexes">
        <table className="w-full text-left text-[13.5px]">
          <thead>
            <tr className="text-[12px] text-text-muted">
              <th className="pb-2 font-medium">Libellé</th>
              <th className="pb-2 font-medium">Surface</th>
              <th className="pb-2 font-medium">Valorisation €</th>
              <th className="pb-2 w-8" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {estimation.annexes.map((a, i) => (
              <tr key={a.id}>
                <td className="py-1 pr-2">
                  <TextInput
                    value={a.libelle}
                    onChange={(e) => {
                      const next = estimation.annexes.map((x, j) =>
                        j === i ? { ...x, libelle: e.target.value } : x,
                      );
                      onPatch({ annexes: next });
                    }}
                  />
                </td>
                <td className="py-1 pr-2">
                  <TextInput
                    inputMode="numeric"
                    value={a.surfaceM2 ?? ''}
                    onChange={(e) => {
                      const next = estimation.annexes.map((x, j) =>
                        j === i ? { ...x, surfaceM2: Number(e.target.value) || null } : x,
                      );
                      onPatch({ annexes: next });
                    }}
                  />
                </td>
                <td className="py-1 pr-2">
                  <TextInput
                    inputMode="numeric"
                    value={a.valorisationEur ?? ''}
                    onChange={(e) => {
                      const next = estimation.annexes.map((x, j) =>
                        j === i ? { ...x, valorisationEur: Number(e.target.value) || null } : x,
                      );
                      onPatch({ annexes: next });
                    }}
                  />
                </td>
                <td className="py-1">
                  <button
                    type="button"
                    onClick={() => removeAnnexe(a.id)}
                    aria-label={`Supprimer ${a.libelle || 'annexe'}`}
                    className="flex size-8 items-center justify-center rounded-full text-text-subtle hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <Trash2 size={15} strokeWidth={2} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex flex-wrap gap-2">
          <WorkspaceButton type="button" variant="secondary" onClick={() => addAnnexe('Cave')}>
            Cave
          </WorkspaceButton>
          <WorkspaceButton
            type="button"
            variant="secondary"
            onClick={() => addAnnexe('Parking', parkingMedian)}
          >
            Parking{parkingMedian ? ` (${parkingMedian.toLocaleString('fr-FR')} €)` : ''}
          </WorkspaceButton>
          <WorkspaceButton type="button" variant="secondary" onClick={() => addAnnexe('Terrasse')}>
            Terrasse
          </WorkspaceButton>
          <WorkspaceButton type="button" variant="secondary" onClick={() => addAnnexe('Box')}>
            Box
          </WorkspaceButton>
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Énergie">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Version du DPE" htmlFor="est-dpe-v">
            <TextInput
              id="est-dpe-v"
              value={bien.dpeVersion ?? ''}
              onChange={(e) => setBien({ dpeVersion: e.target.value || null })}
            />
          </Field>
          <Field label="Étiquette DPE" htmlFor="est-dpe">
            <Select
              id="est-dpe"
              value={estimation.dpeClass ?? ''}
              options={DPE.map((l) => ({ value: l, label: l || 'Non renseigné' }))}
              onChange={(v) => onPatch({ dpeClass: v || null })}
            />
          </Field>
          <Field label="Étiquette GES" htmlFor="est-ges">
            <Select
              id="est-ges"
              value={bien.ges ?? ''}
              options={DPE.map((l) => ({ value: l, label: l || 'Non renseigné' }))}
              onChange={(v) => setBien({ ges: v || null })}
            />
          </Field>
          <Field label="Consommation (kWh/m².an)" htmlFor="est-conso">
            <TextInput
              id="est-conso"
              inputMode="numeric"
              value={bien.consoKwh ?? ''}
              onChange={(e) => setBien({ consoKwh: Number(e.target.value) || null })}
            />
          </Field>
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Photos et plan">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-[13px]"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const form = new FormData();
            form.set('file', file);
            const res = await fetch('/api/dashboard/biens/photos', { method: 'POST', body: form });
            const data = (await res.json()) as { url?: string };
            if (data.url) {
              const photo: EstimationPhoto = { url: data.url, kind: 'photo' };
              onPatch({ photos: [...estimation.photos, photo] });
            }
            e.target.value = '';
          }}
        />
        {estimation.photos.length > 0 ? (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {estimation.photos.map((p) => (
              <li key={p.url}>
                <img src={p.url} alt="" className="h-24 w-full rounded-clay object-cover" />
              </li>
            ))}
          </ul>
        ) : null}
      </SectionRepliable>

      <SectionRepliable titre="Points forts et points faibles">
        <ul className="flex flex-col gap-1.5">
          {suggestions.map((s) => {
            const liste = s.sens === 'fort' ? estimation.pointsForts : estimation.pointsFaibles;
            const deja = liste.includes(s.texte);
            return (
              <li key={s.id}>
                <label className="flex min-h-10 items-center gap-2 text-[13.5px]">
                  <input
                    type="checkbox"
                    checked={deja}
                    onChange={() => {
                      const next = deja ? liste.filter((x) => x !== s.texte) : [...liste, s.texte];
                      onPatch(s.sens === 'fort' ? { pointsForts: next } : { pointsFaibles: next });
                    }}
                  />
                  <span>{s.texte}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </SectionRepliable>

      <SectionRepliable titre="Commentaires confidentiels">
        <Field label="Notes internes" htmlFor="est-conf">
          <TextArea
            id="est-conf"
            rows={4}
            value={estimation.commentairesConfidentiels ?? ''}
            onChange={(e) => onPatch({ commentairesConfidentiels: e.target.value })}
          />
        </Field>
        <Field label="Commentaire public" htmlFor="est-pub">
          <TextArea
            id="est-pub"
            rows={3}
            value={estimation.commentairesPublics ?? ''}
            onChange={(e) => onPatch({ commentairesPublics: e.target.value })}
          />
        </Field>
      </SectionRepliable>

      {carte ? (
        <CartePosition
          latitude={estimation.latitude}
          longitude={estimation.longitude}
          onClose={() => setCarte(false)}
          onChoisir={(latitude, longitude) => {
            onPatch({ latitude, longitude });
            setCarte(false);
          }}
        />
      ) : null}
    </div>
  );
}
