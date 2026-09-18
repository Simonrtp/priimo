'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, Pencil, Plus, Spline, Trash2, X } from 'lucide-react';
import {
  canCreateZone,
  canDeleteZone,
  canEditZone,
  canManageZone,
} from '@/lib/agency/visibility';
import { toast } from 'sonner';
import ClayButton from '@/components/ui/ClayButton';
import Select from '@/components/ui/Select';
import { assigneeSelectAvatar } from '@/components/dashboard/workspace/AssigneeSelect';
import CollaborateurNom from '@/components/dashboard/CollaborateurNom';
import { portraitDepuisMembre } from '@/lib/notes/auteur';
import StatistiquesSecteur from './StatistiquesSecteur';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import { COULEURS_ZONE } from '@/lib/zones/palette';
import { depuisTroisMois, proposerDecoupage } from '@/lib/zones/decoupage';
import { JOURS_TOURNEE, libelleJours } from '@/lib/zones/jour';
import { decouperAdresse } from '@/lib/zones/adresse';
import type { PariteVoie, RegleZone, ValeurPolygone, ValeurRegleZone, Zone } from '@/lib/zones/types';
import type { LeadPoint, ModeCarte } from './ZonesCarte';

const ZonesCarte = dynamic(() => import('./ZonesCarte'), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] animate-pulse rounded-clay-lg bg-black/[0.04]" aria-hidden />
  ),
});

/**
 * Écran des secteurs.
 *
 * Le négociateur dessine SA zone. Le directeur voit tout, peut réattribuer
 * ou verrouiller. Les zones des collègues restent affichées : c'est ce qui
 * rend les trous et les chevauchements visibles. Un recouvrement n'est pas
 * bloqué — il se hachure, le directeur arbitre.
 */

export type SecteurLead = LeadPoint & {
  address: string;
  postalCode: string | null;
  assignedTo: string | null;
  stageId: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

type Membre = {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
};

const PARITES: { valeur: PariteVoie; label: string }[] = [
  { valeur: 'toutes', label: 'Tous les numéros' },
  { valeur: 'paires', label: 'Numéros pairs' },
  { valeur: 'impaires', label: 'Numéros impairs' },
];

const champClass =
  'w-full rounded-lg border border-black/10 px-3 py-2 text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

const labelClass = 'mb-1 block text-[12px] font-medium text-mute';

/** Déclencheur de menu : la même boîte que les champs texte du panneau. */
const declencheurClass = `${champClass} flex items-center justify-between gap-2 text-left`;

function appliquerPatch(zone: Zone, patch: Record<string, unknown>): Zone {
  return {
    ...zone,
    ...(typeof patch.nom === 'string' ? { nom: patch.nom } : {}),
    ...(typeof patch.couleur === 'string' ? { couleur: patch.couleur } : {}),
    ...(patch.assignedTo === null || typeof patch.assignedTo === 'string'
      ? { assignedTo: patch.assignedTo }
      : {}),
    ...(Array.isArray(patch.joursSemaine)
      ? {
          joursSemaine: [...(patch.joursSemaine as number[])].sort((a, b) => a - b),
        }
      : {}),
    ...(typeof patch.actif === 'boolean' ? { actif: patch.actif } : {}),
    ...(typeof patch.verrouillee === 'boolean' ? { verrouillee: patch.verrouillee } : {}),
  };
}

/** Résumé d'une règle en une ligne, pour le panneau latéral. */
function resumerRegle(regle: RegleZone): string {
  const prefixe = regle.inclusion ? '' : 'Sauf ';
  switch (regle.type) {
    case 'polygone': {
      const n = (regle.valeur.coordinates[0]?.length ?? 1) - 1;
      return `${prefixe}Contour dessiné · ${n} sommets`;
    }
    case 'voie': {
      const { nom_voie, parite, numero_min, numero_max } = regle.valeur;
      const cote =
        parite === 'paires' ? ' · pairs' : parite === 'impaires' ? ' · impairs' : '';
      const plage =
        numero_min !== null || numero_max !== null
          ? ` · ${numero_min ?? 1} à ${numero_max ?? '…'}`
          : '';
      return `${prefixe}${nom_voie}${cote}${plage}`;
    }
    case 'code_postal':
      return `${prefixe}Code postal ${regle.valeur.code_postal}`;
    case 'parcelles':
      return `${prefixe}${regle.valeur.parcelle_ids.length} parcelles`;
  }
}

export default function SecteursClient({
  zones,
  membres,
  leads,
  centre,
  estDirecteur,
  profileId,
  onValider,
}: {
  zones: Zone[];
  membres: Membre[];
  leads: SecteurLead[];
  centre: { latitude: number | null; longitude: number | null };
  estDirecteur: boolean;
  profileId: string;
  /** Ferme l’atelier : le secteur est déjà enregistré au fil de l’eau. */
  onValider?: () => void;
}) {
  const router = useRouter();
  // Copie locale : un PATCH ne doit pas relancer l'Accueil (le Suspense
  // démonterait l'atelier). On écrit tout de suite, le serveur suit.
  const [zonesLocales, setZonesLocales] = useState(zones);
  const zonesRef = useRef(zones);
  useEffect(() => {
    setZonesLocales(zones);
  }, [zones]);
  useEffect(() => {
    zonesRef.current = zonesLocales;
  }, [zonesLocales]);

  // Un négociateur ouvre sur SA zone. À défaut, sur rien : lui poser d'office
  // le secteur d'un collègue, qu'il ne peut que lire, ferait croire à un bug.
  const [zoneActiveId, setZoneActiveId] = useState<string | null>(
    zones.find((z) => z.assignedTo === profileId)?.id ??
      (estDirecteur ? (zones[0]?.id ?? null) : null),
  );
  const [enCours, setEnCours] = useState(false);
  const [modeDessin, setModeDessin] = useState<ModeCarte>('inactif');
  const [apercu, setApercu] = useState<GeoJSON.Polygon | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [nbZonesProposees, setNbZonesProposees] = useState(4);
  /** Repère posé sur la voie choisie dans la BAN, pour vérifier avant d'ajouter. */
  const [voieSurlignee, setVoieSurlignee] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );

  const zoneActive = useMemo(
    () => zonesLocales.find((z) => z.id === zoneActiveId) ?? null,
    [zonesLocales, zoneActiveId],
  );
  const viewer = useMemo(
    () => ({ id: profileId, role: estDirecteur ? ('directeur' as const) : ('collaborateur' as const) }),
    [estDirecteur, profileId],
  );
  const peutEditer = zoneActive ? canEditZone(viewer, zoneActive) : false;
  const peutSupprimer = zoneActive ? canDeleteZone(viewer, zoneActive) : false;
  const peutGerer = canManageZone(viewer);
  const peutCreer = canCreateZone(viewer, profileId);

  const pointsLeads = useMemo(
    () => leads.map((l) => ({ id: l.id, latitude: l.latitude, longitude: l.longitude, pris: l.pris })),
    [leads],
  );

  const rafraichir = useCallback(() => router.refresh(), [router]);

  const appeler = useCallback(
    async (
      url: string,
      methode: string,
      corps?: unknown,
      opts?: { silencieux?: boolean },
    ) => {
      if (!opts?.silencieux) setEnCours(true);
      try {
        const res = await fetch(url, {
          method: methode,
          headers: corps ? { 'Content-Type': 'application/json' } : undefined,
          body: corps ? JSON.stringify(corps) : undefined,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? 'Enregistrement impossible');
        }
        return (await res.json().catch(() => ({}))) as Record<string, unknown>;
      } finally {
        if (!opts?.silencieux) setEnCours(false);
      }
    },
    [],
  );

  const creerZone = useCallback(
    async (nom: string, couleur?: string, polygone?: GeoJSON.Polygon) => {
      try {
        const { id } = (await appeler('/api/dashboard/zones', 'POST', { nom, couleur })) as {
          id?: string;
        };
        if (id && polygone) {
          await appeler(`/api/dashboard/zones/${id}/regles`, 'POST', {
            type: 'polygone',
            valeur: polygone,
            inclusion: true,
          });
        }
        if (id) setZoneActiveId(id);
        rafraichir();
        return id ?? null;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Le secteur n’a pas pu être créé');
        return null;
      }
    },
    [appeler, rafraichir],
  );

  const modifierZone = useCallback(
    (
      zoneId: string,
      patch: Record<string, unknown> | ((zone: Zone) => Record<string, unknown>),
    ) => {
      const actuelle = zonesRef.current.find((z) => z.id === zoneId);
      if (!actuelle) return;
      const corps = typeof patch === 'function' ? patch(actuelle) : patch;
      const suivante = appliquerPatch(actuelle, corps);
      zonesRef.current = zonesRef.current.map((z) => (z.id === zoneId ? suivante : z));
      setZonesLocales(zonesRef.current);
      void (async () => {
        try {
          await appeler(`/api/dashboard/zones/${zoneId}`, 'PATCH', corps, { silencieux: true });
        } catch (e) {
          zonesRef.current = zonesRef.current.map((z) => (z.id === zoneId ? actuelle : z));
          setZonesLocales(zonesRef.current);
          toast.error(e instanceof Error ? e.message : 'Modification impossible');
        }
      })();
    },
    [appeler],
  );

  const poserZones = useCallback((liste: Zone[]) => {
    zonesRef.current = liste;
    setZonesLocales(liste);
  }, []);

  const supprimerZone = useCallback(
    async (zoneId: string) => {
      try {
        await appeler(`/api/dashboard/zones/${zoneId}`, 'DELETE');
        setZoneActiveId((id) => (id === zoneId ? null : id));
        poserZones(zonesRef.current.filter((z) => z.id !== zoneId));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Suppression impossible');
      }
    },
    [appeler, poserZones],
  );

  const ajouterRegle = useCallback(
    (type: RegleZone['type'], valeur: unknown, inclusion: boolean) => {
      const zoneId = zoneActiveId;
      if (!zoneId) return;
      const avant = zonesRef.current.find((z) => z.id === zoneId);
      if (!avant) return;
      const temporaire = `temp-${crypto.randomUUID()}`;
      const regle = {
        id: temporaire,
        zoneId,
        inclusion,
        type,
        valeur: valeur as ValeurRegleZone,
      } as RegleZone;
      poserZones(
        zonesRef.current.map((z) =>
          z.id === zoneId ? { ...z, regles: [...z.regles, regle] } : z,
        ),
      );
      setApercu(null);
      void (async () => {
        try {
          const { id } = (await appeler(
            `/api/dashboard/zones/${zoneId}/regles`,
            'POST',
            { type, valeur, inclusion },
            { silencieux: true },
          )) as { id?: string };
          if (id) {
            poserZones(
              zonesRef.current.map((z) =>
                z.id === zoneId
                  ? {
                      ...z,
                      regles: z.regles.map((r) => (r.id === temporaire ? { ...r, id } : r)),
                    }
                  : z,
              ),
            );
          }
        } catch (e) {
          poserZones(zonesRef.current.map((z) => (z.id === zoneId ? avant : z)));
          toast.error(e instanceof Error ? e.message : 'Règle non enregistrée');
        }
      })();
    },
    [appeler, poserZones, zoneActiveId],
  );

  const supprimerRegle = useCallback(
    (regleId: string) => {
      const zone = zonesRef.current.find((z) => z.regles.some((r) => r.id === regleId));
      if (!zone) return;
      const avant = zone;
      poserZones(
        zonesRef.current.map((z) =>
          z.id === zone.id
            ? { ...z, regles: z.regles.filter((r) => r.id !== regleId) }
            : z,
        ),
      );
      void (async () => {
        try {
          await appeler(`/api/dashboard/zones/${zone.id}/regles/${regleId}`, 'DELETE', undefined, {
            silencieux: true,
          });
        } catch (e) {
          poserZones(zonesRef.current.map((z) => (z.id === zone.id ? avant : z)));
          toast.error(e instanceof Error ? e.message : 'Suppression impossible');
        }
      })();
    },
    [appeler, poserZones],
  );

  /** Déplacement d'un sommet : le trait bouge tout de suite, le serveur suit. */
  const deplacerContour = useCallback(
    (regleId: string, polygone: GeoJSON.Polygon) => {
      const zone = zonesRef.current.find((z) => z.regles.some((r) => r.id === regleId));
      if (!zone) return;
      const avant = zone;
      poserZones(
        zonesRef.current.map((z) =>
          z.id === zone.id
            ? {
                ...z,
                regles: z.regles.map((r) =>
                  r.id === regleId && r.type === 'polygone'
                    ? {
                        ...r,
                        valeur: {
                          type: 'Polygon',
                          coordinates: polygone.coordinates.map((anneau) =>
                            anneau.map((p) => [Number(p[0]), Number(p[1])] as const),
                          ),
                        } satisfies ValeurPolygone,
                      }
                    : r,
                ),
              }
            : z,
        ),
      );
      void (async () => {
        try {
          await appeler(
            `/api/dashboard/zones/${zone.id}/regles/${regleId}`,
            'PATCH',
            { type: 'polygone', valeur: polygone },
            { silencieux: true },
          );
        } catch (e) {
          poserZones(zonesRef.current.map((z) => (z.id === zone.id ? avant : z)));
          toast.error(e instanceof Error ? e.message : 'Contour non enregistré');
        }
      })();
    },
    [appeler, poserZones],
  );

  const proposer = useCallback(async () => {
    const recents = depuisTroisMois(leads);
    const propositions = proposerDecoupage(
      recents,
      nbZonesProposees,
      zonesLocales.map((z) => z.nom),
    );
    if (propositions.length === 0) {
      toast.error('Pas assez de leads géolocalisés pour proposer un découpage');
      return;
    }
    for (const proposition of propositions) {
      await creerZone(proposition.nom, proposition.couleur, {
        type: 'Polygon',
        coordinates: proposition.polygone.coordinates as unknown as number[][][],
      });
    }
    toast.success(
      `${propositions.length} secteurs proposés, équilibrés sur ${recents.length} leads. À retoucher librement.`,
    );
  }, [creerZone, leads, nbZonesProposees, zonesLocales]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        {/* La carte reste sous les yeux pendant qu'on fait défiler les règles
            du panneau : on dessine en regardant, pas de mémoire. */}
        <div className="min-w-0 lg:sticky lg:top-0 lg:self-start">
          <ZonesCarte
            zones={zonesLocales}
            zoneActive={peutEditer ? zoneActive : null}
            leads={pointsLeads}
            centre={centre}
            hauteur={520}
            apercu={apercu}
            voieSurlignee={voieSurlignee}
            modeDessin={modeDessin}
            onSurvolZone={setSurvol}
            onPolygoneDessine={
              peutEditer
                ? (polygone) => {
                    setModeDessin('inactif');
                    setApercu(polygone);
                  }
                : undefined
            }
            onPolygoneModifie={peutEditer ? deplacerContour : undefined}
          />

          {survol ? (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-mute">
              <span>{zonesLocales.find((z) => z.id === survol)?.nom} ·</span>
              {(() => {
                const titulaire = membres.find(
                  (m) => m.id === zonesLocales.find((z) => z.id === survol)?.assignedTo,
                );
                return titulaire ? (
                  <CollaborateurNom portrait={portraitDepuisMembre(titulaire)} size={16} />
                ) : (
                  <span>sans titulaire</span>
                );
              })()}
            </p>
          ) : null}

          {apercu && peutEditer ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-clay bg-bg-subtle px-4 py-3">
              <span className="flex-1 text-[13px] text-ink">
                Contour dessiné. À ajouter à {zoneActive ? `« ${zoneActive.nom} »` : 'un secteur'}.
              </span>
              <ClayButton
                variant="secondary"
                className="px-3 py-1.5 text-[13px]"
                onClick={() => setApercu(null)}
              >
                Annuler
              </ClayButton>
              <ClayButton
                className="px-3 py-1.5 text-[13px]"
                disabled={!zoneActive}
                onClick={() => ajouterRegle('polygone', apercu, true)}
              >
                Ajouter au secteur
              </ClayButton>
              <ClayButton
                variant="secondary"
                className="px-3 py-1.5 text-[13px]"
                disabled={!zoneActive}
                onClick={() => ajouterRegle('polygone', apercu, false)}
              >
                Retirer du secteur
              </ClayButton>
            </div>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <ListeZones
            zones={zonesLocales}
            membres={membres}
            zoneActiveId={zoneActiveId}
            onChoisir={(id) => {
              setZoneActiveId(id);
              setModeDessin('inactif');
            }}
            profileId={profileId}
          />

          {peutCreer ? (
            <CreerZone
              enCours={enCours}
              onCreer={(nom) => void creerZone(nom)}
              nbZones={nbZonesProposees}
              onNbZones={setNbZonesProposees}
              onProposer={() => void proposer()}
              peutProposer={peutGerer}
            />
          ) : null}

          {zoneActive ? (
            <PanneauZone
              zone={zoneActive}
              membres={membres}
              peutEditer={peutEditer}
              peutGerer={peutGerer}
              peutSupprimer={peutSupprimer}
              enCours={enCours}
              modeDessin={modeDessin}
              onModeDessin={setModeDessin}
              onModifier={(patch) => modifierZone(zoneActive.id, patch)}
              onSupprimer={() => void supprimerZone(zoneActive.id)}
              onAjouterRegle={(type, valeur, inclusion) => ajouterRegle(type, valeur, inclusion)}
              onSupprimerRegle={(regleId) => supprimerRegle(regleId)}
              onSurlignerVoie={setVoieSurlignee}
              onValider={
                onValider
                  ? () => {
                      setModeDessin('inactif');
                      onValider();
                    }
                  : undefined
              }
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ListeZones({
  zones,
  membres,
  zoneActiveId,
  onChoisir,
  profileId,
}: {
  zones: readonly Zone[];
  membres: readonly Membre[];
  zoneActiveId: string | null;
  onChoisir: (id: string) => void;
  profileId: string;
}) {
  if (zones.length === 0) {
    return (
      <p className="rounded-clay bg-bg-subtle px-4 py-3 text-pretty text-[13px] text-mute">
        Aucun secteur pour l’instant. Dessinez le vôtre pour commencer.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {zones.map((zone) => {
        const titulaire = membres.find((m) => m.id === zone.assignedTo);
        const actif = zone.id === zoneActiveId;
        const jours = libelleJours(zone.joursSemaine);
        return (
          <li key={zone.id}>
            <button
              type="button"
              onClick={() => onChoisir(zone.id)}
              aria-current={actif}
              className={`flex w-full items-center gap-2.5 rounded-clay px-3 py-2.5 text-left transition-[box-shadow,background-color] duration-fluid-subtle ease-in-out ${
                actif ? 'bg-white shadow-clay-sm ring-1 ring-black/[0.06]' : 'hover:bg-white/70'
              }`}
            >
              <span
                aria-hidden
                className="size-3.5 shrink-0 rounded-[4px]"
                style={{ backgroundColor: zone.couleur, opacity: zone.actif ? 1 : 0.35 }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-ink">{zone.nom}</span>
                <span className="block truncate text-[11.5px] text-mute">
                  {titulaire
                    ? zone.assignedTo === profileId
                      ? 'Mon secteur'
                      : (
                          <CollaborateurNom
                            portrait={portraitDepuisMembre(titulaire)}
                            size={16}
                            className="text-[11.5px] text-mute"
                          />
                        )
                    : 'Sans titulaire'}
                  {jours ? ` · ${jours}` : ''}
                  {zone.verrouillee ? ' · direction' : ''}
                  {zone.actif ? '' : ' · désactivé'}
                </span>
              </span>
              {zone.verrouillee ? (
                <Lock size={12} className="shrink-0 text-mute" aria-label="Verrouillé" />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CreerZone({
  enCours,
  onCreer,
  nbZones,
  onNbZones,
  onProposer,
  peutProposer,
}: {
  enCours: boolean;
  onCreer: (nom: string) => void;
  nbZones: number;
  onNbZones: (n: number) => void;
  onProposer: () => void;
  peutProposer: boolean;
}) {
  const [nom, setNom] = useState('');

  return (
    <div className="flex flex-col gap-3 rounded-clay bg-bg-subtle px-4 py-3.5">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nom.trim() === '') return;
          onCreer(nom.trim());
          setNom('');
        }}
      >
        <span className="min-w-0 flex-1">
          <label className={labelClass} htmlFor="zone-nouveau-nom">
            Nouveau secteur
          </label>
          <input
            id="zone-nouveau-nom"
            className={champClass}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex : Charonne"
            maxLength={60}
          />
        </span>
        <ClayButton type="submit" className="px-3 py-2 text-[13px]" disabled={enCours || nom.trim() === ''}>
          <Plus size={14} aria-hidden />
          Créer
        </ClayButton>
      </form>

      {peutProposer ? (
      <div className="border-t border-black/[0.06] pt-3">
        <label className={labelClass} htmlFor="zone-nb-propose">
          Proposer un découpage équilibré
        </label>
        <div className="flex items-end gap-2">
          <input
            id="zone-nb-propose"
            type="number"
            min={2}
            max={8}
            className={`${champClass} w-20`}
            value={nbZones}
            onChange={(e) => onNbZones(Number.parseInt(e.target.value, 10) || 2)}
          />
          <ClayButton
            variant="secondary"
            className="flex-1 px-3 py-2 text-[13px]"
            disabled={enCours}
            onClick={onProposer}
          >
            {enCours ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
            Proposer
          </ClayButton>
        </div>
        <p className="mt-1.5 text-[11px] text-mute">
          Équilibré sur les leads des trois derniers mois. Les contours restent modifiables.
        </p>
      </div>
      ) : null}
    </div>
  );
}

function PanneauZone({
  zone,
  membres,
  peutEditer,
  peutGerer,
  peutSupprimer,
  enCours,
  modeDessin,
  onModeDessin,
  onModifier,
  onSupprimer,
  onAjouterRegle,
  onSupprimerRegle,
  onSurlignerVoie,
  onValider,
}: {
  zone: Zone;
  membres: readonly Membre[];
  peutEditer: boolean;
  peutGerer: boolean;
  peutSupprimer: boolean;
  enCours: boolean;
  modeDessin: ModeCarte;
  onModeDessin: (m: ModeCarte) => void;
  onModifier: (
    patch: Record<string, unknown> | ((zone: Zone) => Record<string, unknown>),
  ) => void;
  onSupprimer: () => void;
  onAjouterRegle: (type: RegleZone['type'], valeur: unknown, inclusion: boolean) => void;
  onSupprimerRegle: (regleId: string) => void;
  onSurlignerVoie: (coord: { latitude: number; longitude: number } | null) => void;
  onValider?: () => void;
}) {
  const [renommage, setRenommage] = useState<string | null>(null);
  // Supprimer se demande deux fois : un secteur, c'est une demi-heure de tracé.
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);
  // Sans contour, il n'y a rien à reprendre : le bouton mentirait.
  const aUnContour = zone.regles.some((r) => r.type === 'polygone' && r.inclusion);

  return (
    <div className="flex flex-col gap-3 rounded-clay bg-white px-4 py-3.5 shadow-clay-sm">
      <div className="flex items-start gap-2">
        {renommage === null ? (
          <>
            <h3 className="min-w-0 flex-1 truncate font-semibold text-ink" style={{ fontSize: 15 }}>
              {zone.nom}
            </h3>
            {peutEditer ? (
              <button
                type="button"
                aria-label="Renommer le secteur"
                onClick={() => setRenommage(zone.nom)}
                className="rounded-lg p-1.5 text-mute transition-colors hover:bg-black/[0.04] hover:text-ink"
              >
                <Pencil size={14} aria-hidden />
              </button>
            ) : null}
          </>
        ) : (
          <form
            className="flex flex-1 items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const nom = renommage.trim();
              if (nom !== '' && nom !== zone.nom) onModifier({ nom });
              setRenommage(null);
            }}
          >
            <input
              autoFocus
              className={champClass}
              value={renommage}
              onChange={(e) => setRenommage(e.target.value)}
              maxLength={60}
              aria-label="Nom du secteur"
            />
            <ClayButton type="submit" className="px-2.5 py-1.5 text-[12px]">
              OK
            </ClayButton>
            <button
              type="button"
              aria-label="Annuler"
              onClick={() => setRenommage(null)}
              className="rounded-lg p-1.5 text-mute hover:bg-black/[0.04]"
            >
              <X size={14} aria-hidden />
            </button>
          </form>
        )}
      </div>

      {zone.verrouillee ? (
        <p className="text-pretty text-[12.5px] text-mute">Secteur défini par la direction</p>
      ) : null}

      {zone.regles.length > 0 ? <StatistiquesSecteur zone={zone} /> : null}

      {peutGerer ? (
        <div>
          <label className={labelClass} htmlFor={`zone-titulaire-${zone.id}`}>
            Titulaire
          </label>
          <Select
            id={`zone-titulaire-${zone.id}`}
            value={zone.assignedTo ?? ''}
            onChange={(valeur) => onModifier({ assignedTo: valeur || null })}
            options={[
              { value: '', label: 'Sans titulaire' },
              ...membres.map((m) => ({
                value: m.id,
                label: m.fullName,
                avatar: assigneeSelectAvatar({
                  id: m.id,
                  fullName: m.fullName,
                  firstName: m.firstName,
                  lastName: m.lastName,
                  avatarUrl: m.avatarUrl,
                }),
              })),
            ]}
            searchable={membres.length > 8}
            triggerClassName={declencheurClass}
          />
        </div>
      ) : null}

      {peutEditer ? (
        <>
          <div>
            <span className={labelClass}>Jours de tournée</span>
            <div className="flex gap-1.5" role="group" aria-label="Jours de tournée">
              {JOURS_TOURNEE.map((jour) => {
                const retenu = zone.joursSemaine.includes(jour.valeur);
                return (
                  <button
                    key={jour.valeur}
                    type="button"
                    aria-pressed={retenu}
                    aria-label={jour.label}
                    title={jour.label}
                    onClick={() =>
                      onModifier((actuelle) => ({
                        joursSemaine: actuelle.joursSemaine.includes(jour.valeur)
                          ? actuelle.joursSemaine.filter((j) => j !== jour.valeur)
                          : [...actuelle.joursSemaine, jour.valeur],
                      }))
                    }
                    className={`flex h-9 flex-1 items-center justify-center rounded-clay text-[13px] font-semibold transition-[background-color,box-shadow,color] duration-fluid-subtle ease-in-out disabled:opacity-50 ${
                      retenu
                        ? 'bg-[#D4E8F5] text-ink shadow-clay-sm'
                        : 'bg-black/[0.04] text-mute hover:bg-black/[0.07] hover:text-ink'
                    }`}
                  >
                    {jour.initiale}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-mute">
              {libelleJours(zone.joursSemaine) ??
                'Aucun jour : la tournée ne se filtre pas sur ce secteur.'}
            </p>
          </div>

          <div>
            <span className={labelClass}>Couleur</span>
            <div className="flex flex-wrap gap-1.5">
              {COULEURS_ZONE.map((couleur) => (
                <button
                  key={couleur}
                  type="button"
                  aria-label={`Couleur ${couleur}`}
                  aria-pressed={zone.couleur.toUpperCase() === couleur.toUpperCase()}
                  onClick={() => onModifier({ couleur })}
                  className={`size-6 rounded-[7px] transition-transform duration-fluid-subtle ease-in-out hover:scale-110 ${
                    zone.couleur.toUpperCase() === couleur.toUpperCase()
                      ? 'ring-2 ring-offset-2 ring-black/25'
                      : ''
                  }`}
                  style={{ backgroundColor: couleur }}
                />
              ))}
            </div>
          </div>
        </>
      ) : !zone.verrouillee ? (
        <p className="text-pretty text-[12.5px] text-mute">Consultation seule.</p>
      ) : null}

      {peutGerer ? (
        <button
          type="button"
          onClick={() => onModifier({ verrouillee: !zone.verrouillee })}
          className="rounded-lg px-2 py-1.5 text-left text-[12.5px] font-medium text-mute transition-colors hover:bg-black/[0.04] hover:text-ink"
        >
          {zone.verrouillee ? 'Déverrouiller le secteur' : 'Verrouiller le secteur'}
        </button>
      ) : null}

      <div className="border-t border-black/[0.06] pt-3">
        <span className={labelClass}>Règles du secteur</span>
        {zone.regles.length === 0 ? (
          <p className="text-[12.5px] text-mute">
            Aucune règle : ce secteur ne capte encore aucune adresse.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {zone.regles.map((regle) => (
              <li
                key={regle.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] ${
                  regle.inclusion ? 'bg-black/[0.02] text-ink' : 'bg-rose-50 text-rose-900'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{resumerRegle(regle)}</span>
                {peutEditer ? (
                  <button
                    type="button"
                    aria-label="Supprimer la règle"
                    disabled={enCours}
                    onClick={() => onSupprimerRegle(regle.id)}
                    className="rounded p-1 text-mute transition-colors hover:bg-black/[0.05] hover:text-rose-700"
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {peutEditer ? (
        <>
          <div className="flex flex-col gap-1.5">
            <ClayButton
              variant={modeDessin === 'polygone' ? 'primary' : 'secondary'}
              className="px-3 py-2 text-[13px]"
              onClick={() => onModeDessin(modeDessin === 'polygone' ? 'inactif' : 'polygone')}
            >
              {modeDessin === 'polygone' ? 'Annuler le tracé' : 'Dessiner un contour'}
            </ClayButton>
            {aUnContour ? (
              <ClayButton
                variant={modeDessin === 'ajuster' ? 'primary' : 'secondary'}
                className="px-3 py-2 text-[13px]"
                onClick={() => onModeDessin(modeDessin === 'ajuster' ? 'inactif' : 'ajuster')}
              >
                <Spline size={14} aria-hidden />
                {modeDessin === 'ajuster' ? 'Terminer l’ajustement' : 'Ajuster le contour'}
              </ClayButton>
            ) : null}
            {modeDessin === 'polygone' ? (
              <p className="text-pretty text-[11.5px] text-mute">
                Maintenez le clic et suivez vos rues. Le contour se ferme quand vous relâchez.
              </p>
            ) : null}
            {modeDessin === 'ajuster' ? (
              <p className="text-pretty text-[11.5px] text-mute">
                Tirez un rond plein pour déplacer un angle, un rond creux pour étirer le trait
                entre deux angles. Double-cliquez un rond plein pour le retirer.
              </p>
            ) : null}
          </div>

          <RegleVoie onAjouter={onAjouterRegle} enCours={enCours} onSurligner={onSurlignerVoie} />
        </>
      ) : null}

      {onValider ? (
        <ClayButton className="w-full px-3 py-2.5 text-[14px]" onClick={onValider}>
          Valider
        </ClayButton>
      ) : null}

      {peutGerer || peutSupprimer ? (
        <div className="flex flex-col gap-2 border-t border-black/[0.06] pt-3">
          <div className="flex items-center gap-2">
            {peutGerer ? (
              <button
                type="button"
                onClick={() => onModifier({ actif: !zone.actif })}
                className="flex-1 rounded-lg px-2 py-1.5 text-left text-[12.5px] font-medium text-mute transition-colors hover:bg-black/[0.04] hover:text-ink"
              >
                {zone.actif ? 'Désactiver' : 'Réactiver'}
              </button>
            ) : (
              <span className="flex-1" />
            )}
            {peutSupprimer ? (
              <button
                type="button"
                disabled={enCours}
                onClick={() => setConfirmeSuppression((v) => !v)}
                aria-expanded={confirmeSuppression}
                className="rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-rose-700 transition-colors hover:bg-rose-50"
              >
                {confirmeSuppression ? 'Annuler' : 'Supprimer le secteur'}
              </button>
            ) : null}
          </div>

          {peutSupprimer && confirmeSuppression ? (
            <div className="flex flex-col gap-2 rounded-clay bg-rose-50 px-3 py-2.5">
              <p className="text-pretty text-[12.5px] text-rose-900">
                Supprimer « {zone.nom} » et toutes ses règles. Les adresses ne bougent pas,
                elles ne seront plus rattachées à un secteur.
              </p>
              <ClayButton
                variant="secondary"
                className="self-start px-3 py-1.5 text-[12.5px] text-rose-700"
                disabled={enCours}
                onClick={() => {
                  setConfirmeSuppression(false);
                  onSupprimer();
                }}
              >
                <Trash2 size={13} aria-hidden />
                Oui, supprimer
              </ClayButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Règle de voie : le seul moyen de séparer deux côtés d'une rue distants de
 * trois mètres. L'autocomplétion BAN évite les fautes de frappe, qui rendraient
 * la règle muette sans jamais prévenir.
 */
function RegleVoie({
  onAjouter,
  enCours,
  onSurligner,
}: {
  onAjouter: (type: RegleZone['type'], valeur: unknown, inclusion: boolean) => void;
  enCours: boolean;
  onSurligner: (coord: { latitude: number; longitude: number } | null) => void;
}) {
  const [choix, setChoix] = useState<SelectedAddress | null>(null);
  const [parite, setParite] = useState<PariteVoie>('toutes');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [inclusion, setInclusion] = useState(true);

  const voie = choix ? decouperAdresse(choix.label).nomVoie : null;

  return (
    <div className="flex flex-col gap-2 border-t border-black/[0.06] pt-3">
      <span className={labelClass}>Ajouter une voie</span>
      <AddressAutocomplete
        value={choix?.label ?? ''}
        onChange={(adresse) => {
          setChoix(adresse);
          // Le repère apparaît sur la carte avant l'ajout : on vérifie d'abord
          // qu'on parle bien de la même rue.
          onSurligner(
            adresse ? { latitude: adresse.latitude, longitude: adresse.longitude } : null,
          );
        }}
        placeholder="Ex : rue des Maraîchers"
        inputClassName={`${champClass} pl-9`}
        aria-label="Rechercher une voie"
      />
      {choix ? (
        <>
          <p className="text-[11.5px] text-mute">
            {voie ?? choix.label} · {choix.postcode}
          </p>
          <Select
            value={parite}
            onChange={(valeur) => setParite(valeur as PariteVoie)}
            options={PARITES.map((p) => ({ value: p.valeur, label: p.label }))}
            aria-label="Parité des numéros"
            triggerClassName={declencheurClass}
          />
          <div className="flex items-center gap-2">
            <input
              className={champClass}
              inputMode="numeric"
              placeholder="Du n°"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              aria-label="Numéro minimum"
            />
            <input
              className={champClass}
              inputMode="numeric"
              placeholder="Au n°"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              aria-label="Numéro maximum"
            />
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-ink">
            <input
              type="checkbox"
              checked={!inclusion}
              onChange={(e) => setInclusion(!e.target.checked)}
              className="size-3.5 rounded border-black/20"
            />
            Retirer cette voie du secteur
          </label>
          <ClayButton
            className="px-3 py-2 text-[13px]"
            disabled={enCours || !choix.postcode}
            onClick={() => {
              if (!choix.postcode) return;
              onAjouter(
                'voie',
                {
                  nom_voie: voie ?? choix.label,
                  code_postal: choix.postcode,
                  parite,
                  numero_min: min === '' ? null : Number.parseInt(min, 10),
                  numero_max: max === '' ? null : Number.parseInt(max, 10),
                },
                inclusion,
              );
              setChoix(null);
              onSurligner(null);
              setMin('');
              setMax('');
              setParite('toutes');
              setInclusion(true);
            }}
          >
            {inclusion ? 'Ajouter la voie' : 'Retirer la voie'}
          </ClayButton>
        </>
      ) : null}
    </div>
  );
}
