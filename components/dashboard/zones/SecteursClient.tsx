'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2, Pencil, Plus, Spline, Trash2, X } from 'lucide-react';
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
import { couleurZoneLibre } from '@/lib/zones/palette';
import { depuisTroisMois, proposerDecoupage } from '@/lib/zones/decoupage';
import type { RegleZone, ValeurPolygone, ValeurRegleZone, Zone } from '@/lib/zones/types';
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

const champClass =
  'w-full rounded-lg border border-black/10 px-3 py-2 text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

const labelClass = 'mb-1 block text-[12px] font-medium text-mute';

/** Déclencheur de menu : la même boîte que les champs texte du panneau. */
const declencheurClass = `${champClass} flex items-center justify-between gap-2 text-left`;

const boutonAtelier =
  'inline-flex w-full items-center justify-center gap-2 rounded-[9999px] px-3 py-2.5 text-[13px] font-semibold transition-colors duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8743C] disabled:cursor-not-allowed disabled:opacity-60';

const boutonNuit = `${boutonAtelier} bg-[#1a2a56] text-white hover:bg-[#152348]`;
const boutonClair = `${boutonAtelier} bg-white text-ink shadow-clay-sm hover:bg-black/[0.03]`;
const boutonValiderInerte =
  `${boutonAtelier} cursor-not-allowed bg-[#D5D8E4] text-[#4E5A82] disabled:opacity-100`;

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
  /** Ferme l’atelier une fois qu’un changement a été fait dans cette session. */
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

  // Fermé d'office : le menu d'un secteur ne s'ouvre que si on le choisit.
  const [zoneActiveId, setZoneActiveId] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [modeDessin, setModeDessin] = useState<ModeCarte>('inactif');
  const [survol, setSurvol] = useState<string | null>(null);
  const [nbZonesProposees, setNbZonesProposees] = useState(4);
  /** Premier secteur : d’abord le bouton, ensuite le nom, ensuite le panneau. */
  const [nommerPremier, setNommerPremier] = useState(false);
  /** Valider n’est actif que s’il y a eu un vrai changement dans l’atelier. */
  const [aValider, setAValider] = useState(false);
  const marquerAValider = useCallback(() => setAValider(true), []);

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
        if (id) {
          setZoneActiveId(id);
          setNommerPremier(false);
          marquerAValider();
          const nouvelle: Zone = {
            id,
            agencyId: '',
            nom,
            couleur: couleur ?? couleurZoneLibre(zonesRef.current.map((z) => z.couleur)),
            assignedTo: estDirecteur ? null : profileId,
            joursSemaine: [],
            actif: true,
            verrouillee: false,
            regles: [],
          };
          setZonesLocales((liste) => (liste.some((z) => z.id === id) ? liste : [...liste, nouvelle]));
        }
        rafraichir();
        return id ?? null;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Le secteur n’a pas pu être créé');
        return null;
      }
    },
    [appeler, estDirecteur, marquerAValider, profileId, rafraichir],
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
      marquerAValider();
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
    [appeler, marquerAValider],
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
        setNommerPremier(false);
        poserZones(zonesRef.current.filter((z) => z.id !== zoneId));
        marquerAValider();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Suppression impossible');
      }
    },
    [appeler, marquerAValider, poserZones],
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
      marquerAValider();
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
    [appeler, marquerAValider, poserZones, zoneActiveId],
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
      marquerAValider();
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
    [appeler, marquerAValider, poserZones],
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
      marquerAValider();
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
    [appeler, marquerAValider, poserZones],
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
            modeDessin={modeDessin}
            onSurvolZone={setSurvol}
            onChoisirZone={(id) => {
              setZoneActiveId(id);
              setModeDessin('inactif');
            }}
            onPolygoneDessine={
              peutEditer
                ? (polygone) => {
                    setModeDessin('inactif');
                    ajouterRegle('polygone', polygone, true);
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

        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          {zonesLocales.length === 0 ? (
            peutCreer ? (
              nommerPremier ? (
                <NommerPremierSecteur
                  enCours={enCours}
                  onCreer={(nom) => void creerZone(nom)}
                  onAnnuler={() => setNommerPremier(false)}
                />
              ) : (
                <button type="button" className={`${boutonNuit}`} onClick={() => setNommerPremier(true)}>
                  Créer mon premier secteur
                </button>
              )
            ) : (
              <p className="text-pretty text-[13px] text-mute">Aucun secteur pour l’instant.</p>
            )
          ) : (
            <>
              <ListeZones
                zones={zonesLocales}
                membres={membres}
                zoneActiveId={zoneActiveId}
                onChoisir={(id) => {
                  setZoneActiveId((actuel) => (actuel === id ? null : id));
                  setModeDessin('inactif');
                }}
                profileId={profileId}
                panneau={
                  zoneActive
                    ? (zone) => (
                        <PanneauZone
                          zone={zone}
                          membres={membres}
                          peutEditer={peutEditer}
                          peutGerer={peutGerer}
                          peutSupprimer={peutSupprimer}
                          enCours={enCours}
                          modeDessin={modeDessin}
                          onModeDessin={setModeDessin}
                          onModifier={(patch) => modifierZone(zone.id, patch)}
                          onSupprimer={() => void supprimerZone(zone.id)}
                          onSupprimerRegle={(regleId) => supprimerRegle(regleId)}
                        />
                      )
                    : undefined
                }
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

              {onValider ? (
                <button
                  type="button"
                  disabled={!aValider}
                  className={`${aValider ? boutonNuit : boutonValiderInerte} py-2.5`}
                  onClick={() => {
                    if (!aValider) return;
                    setModeDessin('inactif');
                    onValider();
                  }}
                >
                  Valider
                </button>
              ) : null}
            </>
          )}
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
  panneau,
}: {
  zones: readonly Zone[];
  membres: readonly Membre[];
  zoneActiveId: string | null;
  onChoisir: (id: string) => void;
  profileId: string;
  panneau?: (zone: Zone) => ReactNode;
}) {
  if (zones.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1.5">
      {zones.map((zone) => {
        const titulaire = membres.find((m) => m.id === zone.assignedTo);
        const ouvert = zone.id === zoneActiveId;
        const panneauId = `secteur-panneau-${zone.id}`;
        return (
          <li key={zone.id} className="rounded-clay bg-white shadow-clay-sm">
            <button
              type="button"
              onClick={() => onChoisir(zone.id)}
              aria-expanded={ouvert}
              aria-controls={panneauId}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-black/[0.02]"
            >
              <span
                aria-hidden
                className="size-3.5 shrink-0 rounded-[4px]"
                style={{ backgroundColor: zone.couleur }}
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
                </span>
              </span>
              <ChevronDown
                size={16}
                aria-hidden
                className={`shrink-0 text-mute transition-transform duration-200 ease-out ${
                  ouvert ? 'rotate-180' : ''
                }`}
              />
            </button>
            <div id={panneauId} hidden={!ouvert}>
              {ouvert && panneau ? (
                <div className="border-t border-black/[0.06] px-3 pb-3.5 pt-3">{panneau(zone)}</div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function NommerPremierSecteur({
  enCours,
  onCreer,
  onAnnuler,
}: {
  enCours: boolean;
  onCreer: (nom: string) => void;
  onAnnuler: () => void;
}) {
  const [nom, setNom] = useState('');

  return (
    <form
      className="flex flex-col gap-3 rounded-clay bg-bg-subtle px-4 py-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (nom.trim() === '') return;
        onCreer(nom.trim());
      }}
    >
      <div>
        <label className={labelClass} htmlFor="zone-premier-nom">
          Donner un nom à mon secteur
        </label>
        <input
          id="zone-premier-nom"
          className={champClass}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex : Charonne"
          maxLength={60}
          autoFocus
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <ClayButton type="submit" className="flex-1 px-3 py-2 text-[13px]" disabled={enCours || nom.trim() === ''}>
          {enCours ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
          Créer
        </ClayButton>
        <ClayButton type="button" variant="secondary" className="px-3 py-2 text-[13px]" onClick={onAnnuler}>
          Annuler
        </ClayButton>
      </div>
    </form>
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
        <ClayButton
          type="submit"
          variant="secondary"
          className="px-3 py-2 text-[13px]"
          disabled={enCours || nom.trim() === ''}
        >
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
  onSupprimerRegle,
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
  onSupprimerRegle: (regleId: string) => void;
}) {
  const [renommage, setRenommage] = useState<string | null>(null);
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);
  const aUnContour = zone.regles.some((r) => r.type === 'polygone' && r.inclusion);

  return (
    <div className="flex flex-col gap-3">
      {renommage === null ? (
        peutEditer ? (
          <button
            type="button"
            onClick={() => setRenommage(zone.nom)}
            className="self-start text-[12.5px] font-medium text-mute hover:text-ink"
          >
            <span className="inline-flex items-center gap-1.5">
              <Pencil size={13} aria-hidden />
              Renommer
            </span>
          </button>
        ) : null
      ) : (
        <form
          className="flex items-center gap-1.5"
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
          <button type="submit" className={`${boutonNuit} w-auto px-3 py-2 text-[12px]`}>
            OK
          </button>
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
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            className={modeDessin === 'polygone' ? boutonNuit : boutonClair}
            onClick={() => onModeDessin(modeDessin === 'polygone' ? 'inactif' : 'polygone')}
          >
            {modeDessin === 'polygone' ? 'Annuler le tracé' : 'Dessiner le contour'}
          </button>
          {aUnContour ? (
            <button
              type="button"
              className={modeDessin === 'ajuster' ? boutonNuit : boutonClair}
              onClick={() => onModeDessin(modeDessin === 'ajuster' ? 'inactif' : 'ajuster')}
            >
              <Spline size={14} aria-hidden />
              {modeDessin === 'ajuster' ? 'Terminer l’ajustement' : 'Ajuster le contour'}
            </button>
          ) : null}
          {modeDessin === 'polygone' ? (
            <p className="text-pretty text-[11.5px] text-mute">
              Maintenez le clic et suivez vos rues. Le contour s’enregistre au relâchement.
            </p>
          ) : null}
          {modeDessin === 'ajuster' ? (
            <p className="text-pretty text-[11.5px] text-mute">
              Tirez un rond pour déplacer un angle. Double-cliquez pour le retirer.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-pretty text-[12.5px] text-mute">Consultation seule.</p>
      )}

      {zone.regles.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {zone.regles.map((regle) => (
            <li
              key={regle.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-ink"
            >
              <span className="min-w-0 flex-1 truncate">{resumerRegle(regle)}</span>
              {peutEditer ? (
                <button
                  type="button"
                  aria-label="Retirer cette règle"
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
      ) : (
        <p className="text-pretty text-[12.5px] text-mute">
          Aucun contour pour l’instant. Dessinez-le sur la carte.
        </p>
      )}

      {peutSupprimer ? (
        confirmeSuppression ? (
          <div className="flex flex-col gap-2 rounded-clay bg-rose-50 px-3 py-2.5">
            <p className="text-pretty text-[12.5px] text-rose-900">
              Supprimer « {zone.nom} » ? Les adresses restent, elles ne seront plus rattachées à
              un secteur.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={enCours}
                className="rounded-[9999px] bg-rose-700 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-rose-800"
                onClick={() => {
                  setConfirmeSuppression(false);
                  onSupprimer();
                }}
              >
                Oui, supprimer
              </button>
              <button
                type="button"
                className="text-[12.5px] font-medium text-mute hover:text-ink"
                onClick={() => setConfirmeSuppression(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={enCours}
            onClick={() => setConfirmeSuppression(true)}
            className="self-start text-[12.5px] font-medium text-rose-700 hover:text-rose-800"
          >
            Supprimer le secteur
          </button>
        )
      ) : null}
    </div>
  );
}

