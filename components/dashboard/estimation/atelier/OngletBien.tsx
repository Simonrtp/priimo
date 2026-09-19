'use client';

import { type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import { Field, TextArea, TextInput, ADDRESS_FIELD_INPUT_CLASS } from '@/components/dashboard/workspace/Field';
import Select from '@/components/ui/Select';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import SectionRepliable from './SectionRepliable';
import ChampPropose from './ChampPropose';
import { inferDernierEtage, numeroEtage, optionsEtage, optionsEtagesImmeuble } from '@/lib/estimation/etages';
import { optionsQualiteEmplacement } from '@/lib/estimation/qualite-emplacement';
import { optionsNiveaux } from '@/lib/estimation/niveaux';
import { optionsSousType } from '@/lib/estimation/sous-types';
import { suggestionsPoints } from '@/lib/estimation/suggestions';
import type { EstimationAnnexe, EstimationBien, EstimationObjet, EstimationPhoto } from '@/lib/estimation/objet';
import {
  CHIFFRES_A_CONFIRMER,
  type EstimationVoiceField,
} from '@/lib/estimation/voice-extract';

const DPE = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

function Propose({
  field,
  pendingVoice,
  onClearPending,
  children,
}: {
  field: EstimationVoiceField;
  pendingVoice: ReadonlySet<EstimationVoiceField>;
  onClearPending: (key: EstimationVoiceField) => void;
  children: ReactNode;
}) {
  return (
    <ChampPropose
      pending={pendingVoice.has(field)}
      chiffre={CHIFFRES_A_CONFIRMER.has(field)}
      onConfirm={() => onClearPending(field)}
    >
      {children}
    </ChampPropose>
  );
}

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
  pendingVoice = new Set(),
  onClearPending = () => undefined,
}: {
  estimation: EstimationObjet;
  parkingMedian: number | null;
  onPatch: (body: Record<string, unknown>) => void;
  pendingVoice?: ReadonlySet<EstimationVoiceField>;
  onClearPending?: (key: EstimationVoiceField) => void;
}) {
  const bien = estimation.bien;

  function setBien(partial: Partial<EstimationBien>) {
    onPatch({ bien: { ...bien, ...partial } });
  }

  function edit(key: EstimationVoiceField, body: Record<string, unknown>) {
    onClearPending(key);
    onPatch(body);
  }

  function editBien(key: EstimationVoiceField, partial: Partial<EstimationBien>) {
    onClearPending(key);
    setBien(partial);
  }

  function appliquerEtages(partial: { floor?: string | null; etagesImmeuble?: number | null }) {
    const floor = partial.floor !== undefined ? partial.floor : estimation.floor;
    const etages = partial.etagesImmeuble !== undefined ? partial.etagesImmeuble : bien.etagesImmeuble;
    const dernier = inferDernierEtage(floor, etages);
    if (partial.floor !== undefined) onClearPending('floor');
    if (partial.etagesImmeuble !== undefined) onClearPending('etagesImmeuble');
    if (dernier != null) onClearPending('dernierEtage');
    onPatch({
      ...(partial.floor !== undefined ? { floor: partial.floor } : {}),
      bien: {
        ...bien,
        ...(partial.etagesImmeuble !== undefined ? { etagesImmeuble: partial.etagesImmeuble } : {}),
        ...(dernier != null ? { dernierEtage: dernier } : {}),
      },
    });
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
    onClearPending('annexes');
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
    onClearPending('annexes');
    onPatch({ annexes: estimation.annexes.filter((a) => a.id !== id) });
  }

  const suggestions = suggestionsPoints({
    dpeClass: estimation.dpeClass,
    occupation: estimation.occupation,
    bien,
    floor: estimation.floor,
    hasParking: estimation.annexes.some((a) => /parking|garage|box/i.test(a.libelle)),
  });
  const textesSuggestions = new Set(suggestions.map((s) => s.texte));
  const pointsHorsSuggestions = [
    ...estimation.pointsForts
      .filter((t) => !textesSuggestions.has(t))
      .map((texte) => ({ texte, sens: 'fort' as const })),
    ...estimation.pointsFaibles
      .filter((t) => !textesSuggestions.has(t))
      .map((texte) => ({ texte, sens: 'faible' as const })),
  ];

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
        {estimation.parcelleId ? (
          <p className="mt-2 text-[12.5px] text-text-muted">Parcelle {estimation.parcelleId}</p>
        ) : null}
      </SectionRepliable>

      <SectionRepliable titre="Le bien" ouvertDefaut>
        <div className="grid gap-3 sm:grid-cols-2">
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="propertyType">
            <Field label="Type" htmlFor="est-type">
              <Select
                id="est-type"
                value={estimation.propertyType ?? ''}
                options={[
                  { value: '', label: 'Non renseigné' },
                  { value: 'appartement', label: 'Appartement' },
                  { value: 'maison', label: 'Maison' },
                ]}
                onChange={(v) => edit('propertyType', { propertyType: v || null })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="sousType">
            <Field label="Sous-type" htmlFor="est-sous">
              <Select
                id="est-sous"
                searchable
                searchPlaceholder="Rechercher…"
                value={bien.sousType ?? ''}
                options={optionsSousType(bien.sousType)}
                onChange={(v) => editBien('sousType', { sousType: v || null })}
              />
            </Field>
          </Propose>
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
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="rooms">
            <Field label="Pièces" htmlFor="est-pieces">
              <TextInput
                id="est-pieces"
                inputMode="numeric"
                value={estimation.rooms ?? ''}
                onChange={(e) => edit('rooms', { rooms: Number(e.target.value) || null })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="chambres">
            <Field label="Chambres" htmlFor="est-chambres">
              <TextInput
                id="est-chambres"
                inputMode="numeric"
                value={bien.chambres ?? ''}
                onChange={(e) => editBien('chambres', { chambres: Number(e.target.value) || null })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="surfaceM2">
            <Field label="Surface habitable (m²)" htmlFor="est-surf">
              <TextInput
                id="est-surf"
                inputMode="numeric"
                value={estimation.surfaceM2 ?? ''}
                onChange={(e) => edit('surfaceM2', { surfaceM2: Number(e.target.value) || null })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="carrez">
            <Field label="Carrez" htmlFor="est-carrez">
              <Select
                id="est-carrez"
                value={bien.carrez == null ? '' : bien.carrez ? 'oui' : 'non'}
                options={[
                  { value: '', label: 'Non renseigné' },
                  { value: 'oui', label: 'Oui' },
                  { value: 'non', label: 'Non' },
                ]}
                onChange={(v) => editBien('carrez', { carrez: v === '' ? null : v === 'oui' })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="surfaceTerrain">
            <Field label="Terrain (m²)" htmlFor="est-terrain">
              <TextInput
                id="est-terrain"
                inputMode="numeric"
                value={bien.surfaceTerrain ?? ''}
                onChange={(e) =>
                  editBien('surfaceTerrain', { surfaceTerrain: Number(e.target.value) || null })
                }
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="niveaux">
            <Field label="Niveaux" htmlFor="est-niveaux">
              <Select
                id="est-niveaux"
                value={bien.niveaux != null ? String(bien.niveaux) : ''}
                options={optionsNiveaux(bien.niveaux)}
                onChange={(v) => editBien('niveaux', { niveaux: v ? Number(v) : null })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="floor">
            <Field label="Étage" htmlFor="est-etage">
              <Select
                id="est-etage"
                value={estimation.floor ?? ''}
                options={optionsEtage(estimation.floor ?? null)}
                onChange={(v) => appliquerEtages({ floor: v || null })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="etagesImmeuble">
            <Field label="Étages de l’immeuble" htmlFor="est-etages">
              <Select
                id="est-etages"
                value={bien.etagesImmeuble != null ? String(bien.etagesImmeuble) : ''}
                options={optionsEtagesImmeuble(bien.etagesImmeuble)}
                onChange={(v) =>
                  appliquerEtages({ etagesImmeuble: v ? Number(v) : null })
                }
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="dernierEtage">
            <Field label="Dernier étage" htmlFor="est-dernier">
              <Select
                id="est-dernier"
                value={bien.dernierEtage == null ? '' : bien.dernierEtage ? 'oui' : 'non'}
                options={[
                  { value: '', label: 'Non renseigné' },
                  { value: 'oui', label: 'Oui' },
                  { value: 'non', label: 'Non' },
                ]}
                onChange={(v) => {
                  const dernier = v === '' ? null : v === 'oui';
                  onClearPending('dernierEtage');
                  if (dernier === true && bien.etagesImmeuble != null) {
                    onClearPending('floor');
                    onPatch({
                      floor: String(bien.etagesImmeuble),
                      bien: { ...bien, dernierEtage: true },
                    });
                    return;
                  }
                  if (dernier === true) {
                    const n = numeroEtage(estimation.floor);
                    if (n != null && n > 0) {
                      onClearPending('etagesImmeuble');
                      setBien({ dernierEtage: true, etagesImmeuble: n });
                      return;
                    }
                  }
                  setBien({ dernierEtage: dernier });
                }}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="qualiteEmplacement">
            <Field label="Qualité d’emplacement" htmlFor="est-empl">
              <Select
                id="est-empl"
                value={bien.qualiteEmplacement ?? ''}
                options={optionsQualiteEmplacement(bien.qualiteEmplacement)}
                onChange={(v) => editBien('qualiteEmplacement', { qualiteEmplacement: v || null })}
              />
            </Field>
          </Propose>
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Équipement">
        <div className="grid gap-3 sm:grid-cols-2">
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="ascenseur">
            <Field label="Ascenseur" htmlFor="est-asc">
              <Select
                id="est-asc"
                value={bien.ascenseur == null ? '' : bien.ascenseur ? 'oui' : 'non'}
                options={[
                  { value: '', label: 'Non renseigné' },
                  { value: 'oui', label: 'Oui' },
                  { value: 'non', label: 'Non' },
                ]}
                onChange={(v) => editBien('ascenseur', { ascenseur: v === '' ? null : v === 'oui' })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="balconTerrasse">
            <Field label="Balcon ou terrasse" htmlFor="est-balcon">
              <Select
                id="est-balcon"
                value={bien.balconTerrasse == null ? '' : bien.balconTerrasse ? 'oui' : 'non'}
                options={[
                  { value: '', label: 'Non renseigné' },
                  { value: 'oui', label: 'Oui' },
                  { value: 'non', label: 'Non' },
                ]}
                onChange={(v) =>
                  editBien('balconTerrasse', { balconTerrasse: v === '' ? null : v === 'oui' })
                }
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="occupation">
            <Field label="Occupation" htmlFor="est-occ">
              <Select
                id="est-occ"
                value={estimation.occupation}
                options={[
                  { value: 'libre', label: 'Libre à la vente' },
                  { value: 'occupe', label: 'Occupé' },
                ]}
                onChange={(v) => edit('occupation', { occupation: v })}
              />
            </Field>
          </Propose>
          {estimation.occupation === 'occupe' ? (
            <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="loyerAnnuel">
              <Field label="Loyer annuel (€)" htmlFor="est-loyer">
                <TextInput
                  id="est-loyer"
                  inputMode="numeric"
                  value={estimation.loyerAnnuel ?? ''}
                  onChange={(e) => edit('loyerAnnuel', { loyerAnnuel: Number(e.target.value) || null })}
                />
              </Field>
            </Propose>
          ) : null}
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Charges">
        <div className="grid gap-3 sm:grid-cols-3">
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="chargesAnnuelles">
            <Field label="Charges annuelles" htmlFor="est-ch-an">
              <TextInput
                id="est-ch-an"
                inputMode="numeric"
                value={bien.chargesAnnuelles ?? ''}
                onChange={(e) =>
                  editBien('chargesAnnuelles', { chargesAnnuelles: Number(e.target.value) || null })
                }
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="chargesCopro">
            <Field label="Charges de copropriété" htmlFor="est-ch-copro">
              <TextInput
                id="est-ch-copro"
                inputMode="numeric"
                value={bien.chargesCopro ?? ''}
                onChange={(e) =>
                  editBien('chargesCopro', { chargesCopro: Number(e.target.value) || null })
                }
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="taxeFonciere">
            <Field label="Taxe foncière" htmlFor="est-tf">
              <TextInput
                id="est-tf"
                inputMode="numeric"
                value={bien.taxeFonciere ?? ''}
                onChange={(e) =>
                  editBien('taxeFonciere', { taxeFonciere: Number(e.target.value) || null })
                }
              />
            </Field>
          </Propose>
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Annexes">
        <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="annexes">
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
                        edit('annexes', { annexes: next });
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
                        edit('annexes', { annexes: next });
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
                        edit('annexes', { annexes: next });
                      }}
                    />
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      onClick={() => removeAnnexe(a.id)}
                      aria-label={`Supprimer ${a.libelle || 'annexe'}`}
                      className="flex size-11 items-center justify-center rounded-full text-text-subtle hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <Trash2 size={15} strokeWidth={2} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Propose>
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
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="dpeVersion">
            <Field label="Version du DPE" htmlFor="est-dpe-v">
              <TextInput
                id="est-dpe-v"
                value={bien.dpeVersion ?? ''}
                onChange={(e) => editBien('dpeVersion', { dpeVersion: e.target.value || null })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="dpeClass">
            <Field label="Étiquette DPE" htmlFor="est-dpe">
              <Select
                id="est-dpe"
                value={estimation.dpeClass ?? ''}
                options={DPE.map((l) => ({ value: l, label: l || 'Non renseigné' }))}
                onChange={(v) => edit('dpeClass', { dpeClass: v || null })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="ges">
            <Field label="Étiquette GES" htmlFor="est-ges">
              <Select
                id="est-ges"
                value={bien.ges ?? ''}
                options={DPE.map((l) => ({ value: l, label: l || 'Non renseigné' }))}
                onChange={(v) => editBien('ges', { ges: v || null })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="consoKwh">
            <Field label="Consommation (kWh/m².an)" htmlFor="est-conso">
              <TextInput
                id="est-conso"
                inputMode="numeric"
                value={bien.consoKwh ?? ''}
                onChange={(e) => editBien('consoKwh', { consoKwh: Number(e.target.value) || null })}
              />
            </Field>
          </Propose>
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
            const field = s.sens === 'fort' ? 'pointsForts' : 'pointsFaibles';
            return (
              <li key={s.id}>
                <label className="flex min-h-11 items-center gap-2 text-[13.5px]">
                  <input
                    type="checkbox"
                    checked={deja}
                    onChange={() => {
                      const next = deja ? liste.filter((x) => x !== s.texte) : [...liste, s.texte];
                      edit(field, s.sens === 'fort' ? { pointsForts: next } : { pointsFaibles: next });
                    }}
                  />
                  <span>{s.texte}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {pointsHorsSuggestions.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {pointsHorsSuggestions.map((s) => {
              const field = s.sens === 'fort' ? 'pointsForts' : 'pointsFaibles';
              const liste = s.sens === 'fort' ? estimation.pointsForts : estimation.pointsFaibles;
              return (
                <li key={`${s.sens}-${s.texte}`}>
                  <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field={field}>
                    <label className="flex min-h-11 items-center gap-2 text-[13.5px]">
                      <input
                        type="checkbox"
                        checked
                        onChange={() => {
                          const next = liste.filter((x) => x !== s.texte);
                          edit(field, s.sens === 'fort' ? { pointsForts: next } : { pointsFaibles: next });
                        }}
                      />
                      <span>{s.texte}</span>
                    </label>
                  </Propose>
                </li>
              );
            })}
          </ul>
        ) : null}
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
        <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="commentairesPublics">
          <Field label="Commentaire public" htmlFor="est-pub">
            <TextArea
              id="est-pub"
              rows={3}
              value={estimation.commentairesPublics ?? ''}
              onChange={(e) =>
                edit('commentairesPublics', { commentairesPublics: e.target.value })
              }
            />
          </Field>
        </Propose>
      </SectionRepliable>

    </div>
  );
}
