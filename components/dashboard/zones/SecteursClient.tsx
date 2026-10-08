'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, PenLine, Plus, Search, Spline, Trash2, X } from 'lucide-react';
import {
  canCreateZone,
  canDeleteZone,
  canEditZone,
  canManageZone,
} from '@/lib/agency/visibility';
import { toast } from 'sonner';
import Select from '@/components/ui/Select';
import Pastilles from '@/components/ui/Pastilles';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { assigneeSelectAvatar } from '@/components/dashboard/workspace/AssigneeSelect';
import CollaborateurNom from '@/components/dashboard/CollaborateurNom';
import { portraitDepuisMembre } from '@/lib/notes/auteur';
import StatistiquesSecteur from './StatistiquesSecteur';
import { couleurZoneLibre } from '@/lib/zones/palette';
import { estNomParDefaut, nomSecteurParDefaut, prenomDuMembre, trierSecteurs } from '@/lib/zones/nom';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import { depuisTroisMois, proposerDecoupage } from '@/lib/zones/decoupage';
import { resumerVoie } from '@/lib/zones/voie-trace';
import type { VoieTrouvee } from '@/lib/geo/ban-voie';
import type {
  PariteVoie,
  RegleZone,
  ValeurPolygone,
  ValeurRegleZone,
  ValeurVoie,
  Zone,
} from '@/lib/zones/types';
import type { LeadPoint, ModeCarte } from './ZonesCarte';

const ZonesCarte = dynamic(() => import('./ZonesCarte'), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[280px] animate-pulse rounded-clay-lg bg-black/[0.04] lg:h-[520px]" aria-hidden />
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
    case 'polygone':
      return `${prefixe}Contour`;
    case 'voie':
      return `${prefixe}${resumerVoie(regle.valeur)}`;
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
  /** Une écriture a eu lieu : la page se rafraîchira en sortant de l'atelier. */
  const aChangeRef = useRef(false);
  useEffect(() => {
    // Un rafraîchissement venu d'ailleurs ne doit pas écraser ce qu'on vient
    // d'écrire : il ramenait l'ancien nom sous les yeux de l'agent.
    if (!aChangeRef.current) setZonesLocales(zones);
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
  /** Règle de rue en cours de saisie, montrée sur la carte avant l'ajout. */
  const [voieApercu, setVoieApercu] = useState<{ valeur: ValeurVoie; inclusion: boolean } | null>(
    null,
  );
  const mobile = useDevice() === 'mobile';
  /** Valider n’est actif que s’il y a eu un vrai changement dans l’atelier. */
  const [aValider, setAValider] = useState(false);
  const marquerAValider = useCallback(() => {
    aChangeRef.current = true;
    setAValider(true);
  }, []);

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

  // Rien ne relance la page pendant qu'on travaille : un rafraîchissement
  // arrivé entre deux écritures remettait l'ancien nom. Une seule fois, en
  // sortant, pour que l'Accueil montre le secteur tel qu'on l'a laissé.
  useEffect(
    () => () => {
      if (aChangeRef.current) router.refresh();
    },
    [router],
  );

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
          zonesRef.current = zonesRef.current.some((z) => z.id === id)
            ? zonesRef.current
            : [...zonesRef.current, nouvelle];
          setZonesLocales(zonesRef.current);
        }
        return id ?? null;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Le secteur n’a pas pu être créé');
        return null;
      }
    },
    [appeler, estDirecteur, marquerAValider, profileId],
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

  const prenomDe = useCallback(
    (membreId: string | null) => prenomDuMembre(membres.find((m) => m.id === membreId)),
    [membres],
  );

  /**
   * Créer d'abord, nommer ensuite : le secteur naît « Secteur de Camille »
   * (le négociateur en est titulaire d'office) ou « Nouveau secteur » chez le
   * directeur, et son nom s'ouvre aussitôt pour qui veut en changer.
   */
  const creerSecteur = useCallback(() => {
    const prenom = estDirecteur ? null : prenomDe(profileId);
    void creerZone(nomSecteurParDefaut(prenom, zonesRef.current.map((z) => z.nom)));
  }, [creerZone, estDirecteur, prenomDe, profileId]);

  /** Un nom donné d'office suit son titulaire ; un nom choisi ne bouge pas. */
  const changerTitulaire = useCallback(
    (zone: Zone, assignedTo: string | null) => {
      const patch: Record<string, unknown> = { assignedTo };
      if (estNomParDefaut(zone.nom, prenomDe(zone.assignedTo))) {
        const autres = zonesRef.current.filter((z) => z.id !== zone.id).map((z) => z.nom);
        patch.nom = nomSecteurParDefaut(prenomDe(assignedTo), autres);
      }
      modifierZone(zone.id, patch);
    },
    [modifierZone, prenomDe],
  );

  /**
   * Un secteur, un contour : le nouveau tracé remplace l'ancien au lieu de
   * s'y superposer.
   */
  const remplacerContour = useCallback(
    (polygone: GeoJSON.Polygon) => {
      const zone = zonesRef.current.find((z) => z.id === zoneActiveId);
      if (!zone) return;
      const contours = zone.regles.filter((r) => r.type === 'polygone' && r.inclusion);
      const [premier, ...autres] = contours;
      if (!premier || premier.id.startsWith('temp-')) {
        ajouterRegle('polygone', polygone, true);
        return;
      }
      deplacerContour(premier.id, polygone);
      for (const r of autres) supprimerRegle(r.id);
    },
    [ajouterRegle, deplacerContour, supprimerRegle, zoneActiveId],
  );

  const choisirZone = useCallback((id: string | null) => {
    setZoneActiveId(id);
    setVoieApercu(null);
    setModeDessin('inactif');
  }, []);

  const zonesTriees = useMemo(() => trierSecteurs(zonesLocales, profileId), [zonesLocales, profileId]);
  const aDejaLeSien = zonesLocales.some((z) => z.assignedTo === profileId);
  const libelleCreer = estDirecteur
    ? 'Créer un secteur'
    : aDejaLeSien
      ? 'Créer un autre secteur'
      : 'Créer mon secteur';

  const carte = (
    <ZonesCarte
      zones={zonesLocales}
      zoneActive={peutEditer ? zoneActive : null}
      leads={pointsLeads}
      centre={centre}
      hauteur={mobile ? undefined : 520}
      tactile={mobile}
      modeDessin={modeDessin}
      voieApercu={voieApercu}
      onSurvolZone={setSurvol}
      onChoisirZone={choisirZone}
      onPolygoneDessine={
        peutEditer
          ? (polygone) => {
              setModeDessin('inactif');
              remplacerContour(polygone);
            }
          : undefined
      }
      onPolygoneModifie={peutEditer ? deplacerContour : undefined}
    />
  );

  const reglages =
    zonesLocales.length === 0 ? (
      peutCreer ? (
        <div className="flex flex-col gap-2">
          <button type="button" className={boutonNuit} disabled={enCours} onClick={creerSecteur}>
            <Plus size={14} aria-hidden />
            {libelleCreer}
          </button>
        </div>
      ) : (
        <p className="text-pretty text-[13px] text-mute">Aucun secteur pour l’instant.</p>
      )
    ) : (
      <>
        <ListeZones
          zones={zonesTriees}
          membres={membres}
          zoneActiveId={zoneActiveId}
          onChoisir={(id) => choisirZone(zoneActiveId === id ? null : id)}
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
                    centre={centre}
                    exempleNom={nomSecteurParDefaut(prenomDe(zone.assignedTo) ?? prenomDe(profileId), [])}
                    onModeDessin={setModeDessin}
                    onModifier={(patch) => modifierZone(zone.id, patch)}
                    onChangerTitulaire={(assignedTo) => changerTitulaire(zone, assignedTo)}
                    onSupprimer={() => void supprimerZone(zone.id)}
                    onSupprimerRegle={(regleId) => supprimerRegle(regleId)}
                    onAjouterRegle={ajouterRegle}
                    onApercuVoie={setVoieApercu}
                  />
                )
              : undefined
          }
        />

        {peutCreer ? (
          <CreerZone
            enCours={enCours}
            libelle={libelleCreer}
            onCreer={creerSecteur}
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
    );

  // Téléphone : la carte en haut, toujours visible, les réglages défilent
  // dessous. Une carte de 520 px dans une fenêtre qui défile captait le doigt
  // et rendait les boutons sous elle inatteignables.
  if (mobile) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative min-h-0 flex-[1.15] px-3">{carte}</div>
        <aside className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-4">
          {reglages}
        </aside>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        {/* La carte reste sous les yeux pendant qu'on fait défiler les règles
            du panneau : on dessine en regardant, pas de mémoire. */}
        <div className="min-w-0 lg:sticky lg:top-0 lg:self-start">
          {carte}

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

        <aside className="flex min-w-0 flex-col gap-3">{reglages}</aside>
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

function CreerZone({
  enCours,
  libelle,
  onCreer,
  nbZones,
  onNbZones,
  onProposer,
  peutProposer,
}: {
  enCours: boolean;
  libelle: string;
  onCreer: () => void;
  nbZones: number;
  onNbZones: (n: number) => void;
  onProposer: () => void;
  peutProposer: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-clay bg-bg-subtle px-4 py-3.5">
      <WorkspaceButton variant="secondary" className="w-full" busy={enCours} onClick={onCreer}>
        <Plus size={14} aria-hidden />
        {libelle}
      </WorkspaceButton>

      {peutProposer ? (
      <div className="border-t border-black/[0.06] pt-3">
        <label className={labelClass} htmlFor="zone-nb-propose">
          Découpage équilibré
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
          <WorkspaceButton
            variant="secondary"
            className="flex-1"
            busy={enCours}
            onClick={onProposer}
          >
            Proposer
          </WorkspaceButton>
        </div>
      </div>
      ) : null}
    </div>
  );
}

/** Rouge des exclusions, le même que sur la carte. */
const ROUGE_EXCLUSION = '#B42318';

function PanneauZone({
  zone,
  membres,
  peutEditer,
  peutGerer,
  peutSupprimer,
  enCours,
  modeDessin,
  centre,
  exempleNom,
  onModeDessin,
  onModifier,
  onChangerTitulaire,
  onSupprimer,
  onSupprimerRegle,
  onAjouterRegle,
  onApercuVoie,
}: {
  zone: Zone;
  membres: readonly Membre[];
  peutEditer: boolean;
  peutGerer: boolean;
  peutSupprimer: boolean;
  enCours: boolean;
  modeDessin: ModeCarte;
  centre: { latitude: number | null; longitude: number | null };
  exempleNom: string;
  onModeDessin: (m: ModeCarte) => void;
  onModifier: (
    patch: Record<string, unknown> | ((zone: Zone) => Record<string, unknown>),
  ) => void;
  onChangerTitulaire: (assignedTo: string | null) => void;
  onSupprimer: () => void;
  onSupprimerRegle: (regleId: string) => void;
  onAjouterRegle: (type: RegleZone['type'], valeur: unknown, inclusion: boolean) => void;
  onApercuVoie: (apercu: { valeur: ValeurVoie; inclusion: boolean } | null) => void;
}) {
  /**
   * Le nom est un champ, toujours ouvert : pas de bouton « Renommer » qui
   * ouvre un formulaire, se referme au premier clic ailleurs et décale tout
   * le panneau sous le doigt. Il s'enregistre en quittant le champ.
   */
  const [nom, setNom] = useState(zone.nom);
  const [nomConnu, setNomConnu] = useState(zone.nom);
  if (nomConnu !== zone.nom) {
    // Renommé d'office (nouveau titulaire) : le champ suit.
    setNomConnu(zone.nom);
    setNom(zone.nom);
  }
  const [ajoutRue, setAjoutRue] = useState(false);
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);

  const contours = zone.regles.filter((r) => r.type === 'polygone' && r.inclusion);
  const rues = zone.regles.filter(
    (r): r is Extract<RegleZone, { type: 'voie' }> => r.type === 'voie',
  );
  const autres = zone.regles.filter(
    (r) => r.type !== 'voie' && !(r.type === 'polygone' && r.inclusion),
  );

  // Lu sur le champ lui-même : la valeur à l'écran fait foi, même si l'état
  // React n'a pas encore suivi la dernière frappe.
  const validerNom = (saisie: string) => {
    const propre = saisie.trim();
    if (propre !== '' && propre !== zone.nom) onModifier({ nom: propre });
    else setNom(zone.nom);
  };

  const fermerRue = () => {
    setAjoutRue(false);
    onApercuVoie(null);
  };

  return (
    <div className="flex flex-col gap-3.5">
      {peutEditer ? (
        <input
          aria-label="Nom du secteur"
          className={champClass}
          value={nom}
          maxLength={60}
          placeholder={`Ex : ${exempleNom}`}
          onChange={(e) => setNom(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => validerNom(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      ) : null}

      {peutGerer ? (
        <div>
          <label className={labelClass} htmlFor={`zone-titulaire-${zone.id}`}>
            Titulaire
          </label>
          <Select
            id={`zone-titulaire-${zone.id}`}
            value={zone.assignedTo ?? ''}
            onChange={(valeur) => onChangerTitulaire(valeur || null)}
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`${modeDessin === 'polygone' ? boutonNuit : boutonClair} flex-1`}
            onClick={() => onModeDessin(modeDessin === 'polygone' ? 'inactif' : 'polygone')}
          >
            <PenLine size={14} aria-hidden />
            {modeDessin === 'polygone' ? 'Annuler' : contours.length > 0 ? 'Redessiner' : 'Dessiner'}
          </button>
          {contours.length > 0 ? (
            <>
              <button
                type="button"
                className={`${modeDessin === 'ajuster' ? boutonNuit : boutonClair} flex-1`}
                onClick={() => onModeDessin(modeDessin === 'ajuster' ? 'inactif' : 'ajuster')}
              >
                <Spline size={14} aria-hidden />
                {modeDessin === 'ajuster' ? 'Terminer' : 'Ajuster'}
              </button>
              <button
                type="button"
                aria-label="Effacer le contour"
                title="Effacer le contour"
                disabled={enCours}
                onClick={() => {
                  onModeDessin('inactif');
                  for (const r of contours) onSupprimerRegle(r.id);
                }}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-mute shadow-clay-sm transition-colors hover:text-rose-700"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-[12.5px] text-mute">Consultation seule.</p>
      )}

      {autres.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {autres.map((regle) => (
            <LigneRegle
              key={regle.id}
              couleur={regle.inclusion ? zone.couleur : ROUGE_EXCLUSION}
              texte={resumerRegle(regle)}
              enCours={enCours}
              onRetirer={peutEditer ? () => onSupprimerRegle(regle.id) : undefined}
            />
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-mute">Rues</span>
          {peutEditer && !ajoutRue ? (
            <button
              type="button"
              onClick={() => setAjoutRue(true)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12.5px] font-semibold text-[#1a2a56] transition-colors hover:bg-black/[0.04]"
            >
              <Plus size={13} aria-hidden />
              Ajouter
            </button>
          ) : null}
        </div>
        {rues.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {rues.map((regle) => (
              <LigneRegle
                key={regle.id}
                couleur={regle.inclusion ? zone.couleur : ROUGE_EXCLUSION}
                texte={resumerRegle(regle)}
                enCours={enCours}
                onRetirer={peutEditer ? () => onSupprimerRegle(regle.id) : undefined}
              />
            ))}
          </ul>
        ) : null}
        {ajoutRue ? (
          <RegleVoie
            centre={centre}
            onApercu={onApercuVoie}
            onAnnuler={fermerRue}
            onAjouter={(valeur, inclusion) => {
              onAjouterRegle('voie', valeur, inclusion);
              fermerRue();
            }}
          />
        ) : null}
      </div>

      {zone.regles.length > 0 ? <StatistiquesSecteur zone={zone} /> : null}

      {peutSupprimer ? (
        confirmeSuppression ? (
          <div className="flex items-center gap-2 rounded-clay bg-rose-50 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-rose-900">
              Supprimer ce secteur ?
            </span>
            <button
              type="button"
              disabled={enCours}
              className="rounded-full bg-rose-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-800"
              onClick={() => {
                setConfirmeSuppression(false);
                onSupprimer();
              }}
            >
              Supprimer
            </button>
            <button
              type="button"
              className="text-[12px] font-medium text-mute hover:text-ink"
              onClick={() => setConfirmeSuppression(false)}
            >
              Annuler
            </button>
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

function LigneRegle({
  couleur,
  texte,
  enCours,
  onRetirer,
}: {
  couleur: string;
  texte: string;
  enCours: boolean;
  onRetirer?: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg bg-black/[0.03] py-1 pl-2.5 pr-1 text-[12.5px] text-ink">
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: couleur }} />
      <span className="min-w-0 flex-1 truncate">{texte}</span>
      {onRetirer ? (
        <button
          type="button"
          aria-label={`Retirer : ${texte}`}
          disabled={enCours}
          onClick={onRetirer}
          className="rounded-full p-1.5 text-mute transition-colors hover:bg-black/[0.05] hover:text-rose-700"
        >
          <Trash2 size={13} aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

function entier(saisie: string): number | null {
  const t = saisie.trim();
  if (!/^\d{1,4}$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

const COTES: readonly { id: PariteVoie; label: string }[] = [
  { id: 'toutes', label: 'Tous' },
  { id: 'paires', label: 'Pairs' },
  { id: 'impaires', label: 'Impairs' },
];

const SENS = [
  { id: 'ajouter', label: 'Ajouter au secteur' },
  { id: 'retirer', label: 'Retirer du secteur' },
] as const;

/**
 * Règle de rue : le seul moyen de séparer deux côtés d'une rue distants de
 * quelques mètres. La rue choisie s'affiche aussitôt sur la carte, côté et
 * numéros compris, avant d'être ajoutée.
 */
function RegleVoie({
  centre,
  onApercu,
  onAjouter,
  onAnnuler,
}: {
  centre: { latitude: number | null; longitude: number | null };
  onApercu: (apercu: { valeur: ValeurVoie; inclusion: boolean } | null) => void;
  onAjouter: (valeur: ValeurVoie, inclusion: boolean) => void;
  onAnnuler: () => void;
}) {
  const [voie, setVoie] = useState<VoieTrouvee | null>(null);
  const [parite, setParite] = useState<PariteVoie>('toutes');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [inclusion, setInclusion] = useState(true);

  type Saisie = { voie: VoieTrouvee | null; parite: PariteVoie; du: string; au: string; inclusion: boolean };

  const valeurDe = (x: Saisie): ValeurVoie | null => {
    if (!x.voie) return null;
    let min = entier(x.du);
    let max = entier(x.au);
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    return {
      nom_voie: x.voie.nom,
      code_postal: x.voie.codePostal,
      parite: x.parite,
      numero_min: min,
      numero_max: max,
    };
  };

  // Chaque retouche redessine l'aperçu sur la carte.
  const changer = (patch: Partial<Saisie>) => {
    const suivante: Saisie = { voie, parite, du, au, inclusion, ...patch };
    setVoie(suivante.voie);
    setParite(suivante.parite);
    setDu(suivante.du);
    setAu(suivante.au);
    setInclusion(suivante.inclusion);
    const valeur = valeurDe(suivante);
    onApercu(valeur ? { valeur, inclusion: suivante.inclusion } : null);
  };

  const valeur = valeurDe({ voie, parite, du, au, inclusion });

  return (
    <div className="flex flex-col gap-2.5 rounded-clay bg-bg-subtle p-3">
      {voie ? (
        <div className="flex items-center gap-2 rounded-lg bg-white py-1.5 pl-3 pr-1 shadow-clay-sm">
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
            {voie.nom}
            <span className="ml-1.5 font-normal text-mute">{voie.codePostal}</span>
          </span>
          <button
            type="button"
            aria-label="Changer de rue"
            onClick={() => changer({ voie: null })}
            className="rounded-full p-1.5 text-mute transition-colors hover:bg-black/[0.05] hover:text-ink"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ) : (
        <ChampVoie centre={centre} onChoisir={(v) => changer({ voie: v })} />
      )}

      {voie ? (
        <>
          <Pastilles
            label="Côté de la rue"
            value={parite}
            options={COTES}
            onChange={(p) => changer({ parite: p })}
          />
          <div className="flex items-center gap-2">
            <input
              className={champClass}
              inputMode="numeric"
              aria-label="Du numéro"
              placeholder="Du n°"
              value={du}
              onChange={(e) => changer({ du: e.target.value })}
            />
            <span aria-hidden className="text-mute">
              –
            </span>
            <input
              className={champClass}
              inputMode="numeric"
              aria-label="Au numéro"
              placeholder="Au n°"
              value={au}
              onChange={(e) => changer({ au: e.target.value })}
            />
          </div>
          <Pastilles
            label="Ajouter ou retirer la rue"
            value={inclusion ? 'ajouter' : 'retirer'}
            options={SENS}
            onChange={(sens) => changer({ inclusion: sens === 'ajouter' })}
          />
        </>
      ) : null}

      <div className="flex gap-2">
        <WorkspaceButton variant="secondary" className="flex-1" onClick={onAnnuler}>
          Annuler
        </WorkspaceButton>
        <WorkspaceButton
          className="flex-1"
          disabled={!valeur}
          onClick={() => {
            if (valeur) onAjouter(valeur, inclusion);
          }}
        >
          Valider
        </WorkspaceButton>
      </div>
    </div>
  );
}

/** Les rues de la Base Adresse Nationale, au plus près de l'agence. */
function ChampVoie({
  centre,
  onChoisir,
}: {
  centre: { latitude: number | null; longitude: number | null };
  onChoisir: (voie: VoieTrouvee) => void;
}) {
  const [saisie, setSaisie] = useState('');
  const [voies, setVoies] = useState<VoieTrouvee[]>([]);

  useEffect(() => {
    const q = saisie.trim();
    if (q.length < 3) return;
    const abandon = new AbortController();
    const minuterie = window.setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (centre.latitude != null && centre.longitude != null) {
        params.set('lat', String(centre.latitude));
        params.set('lon', String(centre.longitude));
      }
      fetch(`/api/dashboard/zones/voies?${params.toString()}`, { signal: abandon.signal })
        .then((res) => (res.ok ? (res.json() as Promise<{ voies?: VoieTrouvee[] }>) : { voies: [] }))
        .then((data) => setVoies(data.voies ?? []))
        .catch(() => {
          // Saisie suivante déjà partie, ou réseau coupé : la liste reste.
        });
    }, 220);
    return () => {
      window.clearTimeout(minuterie);
      abandon.abort();
    };
  }, [saisie, centre.latitude, centre.longitude]);

  const visibles = saisie.trim().length >= 3 ? voies : [];

  return (
    <div className="relative">
      <Search
        size={15}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"
      />
      <input
        autoFocus
        className={`${champClass} pl-9`}
        aria-label="Rechercher une rue"
        placeholder="Rechercher une rue"
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
      />
      {visibles.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Rues trouvées"
          className="mt-1.5 flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-xl bg-white p-1 shadow-clay"
        >
          {visibles.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => onChoisir(v)}
                className="flex w-full items-baseline gap-1.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink transition-colors hover:bg-black/[0.04]"
              >
                <span className="min-w-0 truncate font-medium">{v.nom}</span>
                <span className="shrink-0 text-[12px] text-mute">
                  {v.codePostal} {v.commune}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
