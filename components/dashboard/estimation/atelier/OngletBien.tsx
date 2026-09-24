'use client';

import { type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import { Field, ADDRESS_FIELD_INPUT_CLASS } from '@/components/dashboard/workspace/Field';
import { ChampSaisi, ZoneSaisie, texteEuro, texteNombre } from './ChampSaisi';
import Select from '@/components/ui/Select';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import SectionRepliable from './SectionRepliable';
import ChampPropose from './ChampPropose';
import CartesAdresseProposee from './CartesAdresseProposee';
import { patchDepuisAdresseProposee, type AdresseProposee } from '@/lib/notes/rattacher-catalogue';
import { inferDernierEtage, numeroEtage, optionsEtage, optionsEtagesImmeuble } from '@/lib/estimation/etages';
import { optionsQualiteEmplacement } from '@/lib/estimation/qualite-emplacement';
import { optionsNiveaux } from '@/lib/estimation/niveaux';
import { optionsSousType } from '@/lib/estimation/sous-types';
import {
  nombreSaisi,
  nombreStrictementPositif,
  pointsVersTexte,
  texteVersPoints,
  type EstimationAnnexe,
  type EstimationBien,
  type EstimationObjet,
} from '@/lib/estimation/objet';
import ZoneDepotPhotos from './ZoneDepotPhotos';
import type { EstimationVoiceField } from '@/lib/estimation/voice-extract';

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
  propositions = [],
}: {
  estimation: EstimationObjet;
  parkingMedian: number | null;
  onPatch: (body: Record<string, unknown>) => void;
  pendingVoice?: ReadonlySet<EstimationVoiceField>;
  onClearPending?: (key: EstimationVoiceField) => void;
  propositions?: AdresseProposee[];
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

  return (
    <div className="flex flex-col gap-3">
      <SectionRepliable titre="Localisation" ouvertDefaut>
        <Field label="Adresse" htmlFor="est-adresse">
          <div className="flex flex-col gap-2">
            <CartesAdresseProposee
              propositions={propositions}
              actuel={{ address: estimation.address, bienId: estimation.bienId }}
              onChoisir={(p) => onPatch(patchDepuisAdresseProposee(p, estimation))}
            />
            <AddressAutocomplete
              id="est-adresse"
              value={estimation.address ?? ''}
              onChange={onAdresse}
              inputClassName={ADDRESS_FIELD_INPUT_CLASS}
            />
          </div>
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
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="anneeConstruction">
            <Field label="Année de construction" htmlFor="est-annee">
              <Select
                id="est-annee"
                searchable
                searchPlaceholder="Année…"
                value={bien.anneeConstruction != null ? String(bien.anneeConstruction) : ''}
                options={optionsAnneesConstruction(bien.anneeConstruction)}
                onChange={(v) => editBien('anneeConstruction', { anneeConstruction: v ? Number(v) : null })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="rooms">
            <Field label="Pièces" htmlFor="est-pieces">
              <ChampSaisi
                id="est-pieces"
                inputMode="numeric"
                value={texteNombre(estimation.rooms)}
                onCommit={(raw) => edit('rooms', { rooms: nombreStrictementPositif(raw) })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="chambres">
            <Field label="Chambres" htmlFor="est-chambres">
              <ChampSaisi
                id="est-chambres"
                inputMode="numeric"
                value={texteNombre(bien.chambres)}
                onCommit={(raw) => editBien('chambres', { chambres: nombreSaisi(raw) })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="surfaceM2">
            <Field label="Surface habitable (m²)" htmlFor="est-surf">
              <ChampSaisi
                id="est-surf"
                inputMode="numeric"
                value={texteNombre(estimation.surfaceM2)}
                onCommit={(raw) => edit('surfaceM2', { surfaceM2: nombreStrictementPositif(raw) })}
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
          <Field label="Surface Carrez (m²)" htmlFor="est-surf-carrez">
            <ChampSaisi
              id="est-surf-carrez"
              inputMode="numeric"
              value={texteNombre(bien.surfaceCarrez)}
              onCommit={(raw) => editBien('carrez', { surfaceCarrez: nombreSaisi(raw) })}
            />
          </Field>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="surfaceTerrain">
            <Field label="Terrain (m²)" htmlFor="est-terrain">
              <ChampSaisi
                id="est-terrain"
                inputMode="numeric"
                value={texteNombre(bien.surfaceTerrain)}
                onCommit={(raw) =>
                  editBien('surfaceTerrain', { surfaceTerrain: nombreSaisi(raw) })
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
                <ChampSaisi
                  id="est-loyer"
                  inputMode="numeric"
                  value={texteEuro(estimation.loyerAnnuel)}
                  onCommit={(raw) => edit('loyerAnnuel', { loyerAnnuel: nombreSaisi(raw) })}
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
              <ChampSaisi
                id="est-ch-an"
                inputMode="numeric"
                value={texteEuro(bien.chargesAnnuelles)}
                onCommit={(raw) =>
                  editBien('chargesAnnuelles', { chargesAnnuelles: nombreSaisi(raw) })
                }
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="chargesCopro">
            <Field label="Charges de copropriété" htmlFor="est-ch-copro">
              <ChampSaisi
                id="est-ch-copro"
                inputMode="numeric"
                value={texteEuro(bien.chargesCopro)}
                onCommit={(raw) =>
                  editBien('chargesCopro', { chargesCopro: nombreSaisi(raw) })
                }
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="taxeFonciere">
            <Field label="Taxe foncière" htmlFor="est-tf">
              <ChampSaisi
                id="est-tf"
                inputMode="numeric"
                value={texteEuro(bien.taxeFonciere)}
                onCommit={(raw) =>
                  editBien('taxeFonciere', { taxeFonciere: nombreSaisi(raw) })
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
                    <ChampSaisi
                      value={a.libelle}
                      onCommit={(raw) => {
                        const next = estimation.annexes.map((x, j) =>
                          j === i ? { ...x, libelle: raw } : x,
                        );
                        edit('annexes', { annexes: next });
                      }}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <ChampSaisi
                      inputMode="numeric"
                      value={texteNombre(a.surfaceM2)}
                      onCommit={(raw) => {
                        const next = estimation.annexes.map((x, j) =>
                          j === i ? { ...x, surfaceM2: nombreSaisi(raw) } : x,
                        );
                        edit('annexes', { annexes: next });
                      }}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <ChampSaisi
                      inputMode="numeric"
                      value={texteEuro(a.valorisationEur)}
                      onCommit={(raw) => {
                        const next = estimation.annexes.map((x, j) =>
                          j === i ? { ...x, valorisationEur: nombreSaisi(raw) } : x,
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
              <ChampSaisi
                id="est-dpe-v"
                value={bien.dpeVersion ?? ''}
                onCommit={(raw) => editBien('dpeVersion', { dpeVersion: raw || null })}
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
              <ChampSaisi
                id="est-conso"
                inputMode="numeric"
                value={texteNombre(bien.consoKwh)}
                onCommit={(raw) => editBien('consoKwh', { consoKwh: nombreSaisi(raw) })}
              />
            </Field>
          </Propose>
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Photos et plan" ouvertDefaut>
        <ZoneDepotPhotos
          photos={estimation.photos}
          onChange={(photos) => onPatch({ photos })}
        />
      </SectionRepliable>

      <SectionRepliable titre="Positif et négatif">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="pointsForts">
            <Field label="Positif" htmlFor="est-positif" hint="Un point par ligne">
              <ZoneSaisie
                id="est-positif"
                rows={4}
                placeholder="Lumineux, dernier étage…"
                value={pointsVersTexte(estimation.pointsForts)}
                onCommit={(raw) => edit('pointsForts', { pointsForts: texteVersPoints(raw) })}
              />
            </Field>
          </Propose>
          <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="pointsFaibles">
            <Field label="Négatif" htmlFor="est-negatif" hint="Un point par ligne">
              <ZoneSaisie
                id="est-negatif"
                rows={4}
                placeholder="Rez-de-chaussée, travaux…"
                value={pointsVersTexte(estimation.pointsFaibles)}
                onCommit={(raw) => edit('pointsFaibles', { pointsFaibles: texteVersPoints(raw) })}
              />
            </Field>
          </Propose>
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Commentaires confidentiels">
        <Field label="Notes internes" htmlFor="est-conf">
          <ZoneSaisie
            id="est-conf"
            rows={4}
            value={estimation.commentairesConfidentiels ?? ''}
            onCommit={(raw) => onPatch({ commentairesConfidentiels: raw })}
          />
        </Field>
        <Propose pendingVoice={pendingVoice} onClearPending={onClearPending} field="commentairesPublics">
          <Field label="Commentaire public" htmlFor="est-pub">
            <ZoneSaisie
              id="est-pub"
              rows={3}
              value={estimation.commentairesPublics ?? ''}
              onCommit={(raw) =>
                edit('commentairesPublics', { commentairesPublics: raw })
              }
            />
          </Field>
        </Propose>
      </SectionRepliable>

    </div>
  );
}
