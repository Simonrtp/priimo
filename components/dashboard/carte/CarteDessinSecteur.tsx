'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, MapPin } from 'lucide-react';
import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';
import { notifyError, notifyInfo } from '@/lib/notify';
import { useUser } from '@/lib/hooks/useUser';
import { lireVoies, type VoieTrouvee } from '@/lib/geo/ban-voie';
import { pointDansPolygone } from '@/lib/zones/appartenance';
import { couleurZoneLibre } from '@/lib/zones/palette';
import { COULEURS_MEMBRES } from '@/lib/zones/couleurs-membres';
import { nomSecteurParDefaut, prenomDuMembre } from '@/lib/zones/nom';
import { rafraichirCarteSecteurs, type CarteSecteurs } from '@/lib/zones/useCarteSecteurs';
import type { PariteVoie, Zone } from '@/lib/zones/types';
import type { AtelierCalque, ParcelleAtelier } from '@/components/dashboard/carte/SecteursParcellesCalque';

export type OutilAtelier = 'entourer' | 'toucher';
type Mode = 'ajouter' | 'retirer';
type Pas = { ajoutees: string[]; retirees: string[]; rue?: string };
/** Une rue posée dans le secteur, gardée à l'écran avec ce qu'elle a apporté. */
type RuePosee = { cle: string; nom: string; parite: PariteVoie; nombre: number };

function cleRue(voie: VoieTrouvee, parite: PariteVoie): string {
  return `${voie.nom}|${voie.codePostal}|${parite}`;
}

const COTES: readonly { id: PariteVoie; label: string }[] = [
  { id: 'toutes', label: 'Tous' },
  { id: 'paires', label: 'Pairs' },
  { id: 'impaires', label: 'Impairs' },
];

/** Les parcelles se chargent par carreaux d'environ 1 km, à partir de ce zoom. */
const ZOOM_PARCELLES = 14;
const CARREAU = 0.01;

type Vue = { west: number; south: number; east: number; north: number; zoom: number };
type Reponse = { ajoutees?: string[]; retirees?: string[]; refusees?: { parcelleId: string }[]; parcelleIds?: string[] };

async function envoyer<T = { id?: string }>(url: string, methode: string, corps?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: methode,
    headers: corps ? { 'Content-Type': 'application/json' } : undefined,
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Enregistrement impossible');
  return data;
}

/**
 * Seul atelier où l'on définit un secteur. Nulle part ailleurs : l'Accueil
 * et les autres écrans renvoient à `/dashboard/prospection?atelier=`.
 *
 * On entoure des immeubles, on touche une parcelle pour l'ajouter ou la
 * retirer, on prend une rue d'un côté. Tout s'affiche aussitôt et
 * s'enregistre en arrière-plan. Une parcelle déjà tenue par un collègue
 * ne se prend pas.
 *
 * `zone` : le secteur à retoucher ; absent, un nouveau secteur naît au
 * premier geste.
 */
export function useDessinSecteur({
  ouvert,
  zone = null,
  zones,
  carte,
  centre,
  onValider,
  onFermer,
  onSupprime,
}: {
  ouvert: boolean;
  zone?: Zone | null;
  zones: readonly Zone[];
  carte: CarteSecteurs;
  centre: { latitude: number | null; longitude: number | null };
  onValider?: (zoneId: string) => void;
  onFermer?: () => void;
  /** Le secteur vient d’être effacé : la carte se recharge sans lui. */
  onSupprime?: () => void;
}): {
  panneau: ReactNode;
  couleur: string;
  calque: AtelierCalque | null;
  outil: OutilAtelier;
  poserContour: (polygone: GeoJSON.Polygon) => void;
  toucherParcelle: (parcelleId: string) => void;
  surVue: (vue: Vue) => void;
} {
  const { profile } = useUser();
  const [ouverture, setOuverture] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(zone?.id ?? null);
  const [mesIds, setMesIds] = useState<ReadonlySet<string>>(new Set());
  const [historique, setHistorique] = useState<Pas[]>([]);
  const [outil, setOutil] = useState<OutilAtelier>('entourer');
  const [mode, setMode] = useState<Mode>('ajouter');
  const [candidates, setCandidates] = useState<ReadonlyMap<string, ParcelleAtelier>>(new Map());
  const [enAttente, setEnAttente] = useState(0);
  const [rues, setRues] = useState<RuePosee[]>([]);
  const [zoom, setZoom] = useState<number | null>(null);

  // À chaque ouverture, et seulement là, on repart du secteur tel qu'il est :
  // la carte relue ensuite ne doit pas défaire les gestes en cours.
  const cleOuverture = ouvert ? `ouvert:${zone?.id ?? 'nouveau'}` : null;
  if (ouverture !== cleOuverture) {
    setOuverture(cleOuverture);
    if (cleOuverture) {
      const id = zone?.id ?? null;
      const siennes = id
        ? carte.features.filter((f) => f.properties.zoneId === id).map((f) => f.properties.parcelleId)
        : [];
      setZoneId(id);
      setHistorique([]);
      setRues([]);
      setMode('ajouter');
      setMesIds(new Set(siennes));
      setOutil(siennes.length > 0 ? 'toucher' : 'entourer');
    }
  }

  const zoneRef = useRef<string | null>(zoneId);
  const mesRef = useRef(mesIds);
  const candidatesRef = useRef(candidates);
  /** Secteur né dans cet atelier : abandonné vide, il ne reste pas en base. */
  const creeIciRef = useRef(false);
  const fileRef = useRef<Promise<void>>(Promise.resolve());
  const carreauxRef = useRef(new Set<string>());
  useEffect(() => {
    zoneRef.current = zoneId;
  }, [zoneId]);
  useEffect(() => {
    mesRef.current = mesIds;
  }, [mesIds]);
  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);
  useEffect(() => {
    creeIciRef.current = false;
  }, [cleOuverture]);

  // Parcelles tenues par d'autres secteurs : visibles, jamais prises.
  const prises = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of carte.features) {
      if (f.properties.zoneId !== zoneId) m.set(f.properties.parcelleId, f.properties.initiales);
    }
    return m;
  }, [carte.features, zoneId]);

  const couleurPropre = useMemo(() => {
    const mien = carte.secteurs.find((s) => s.assignedTo === profile.id)?.couleur;
    return mien ?? COULEURS_MEMBRES[0];
  }, [carte.secteurs, profile.id]);

  const assurerZone = useCallback(async () => {
    if (zoneRef.current) return zoneRef.current;
    const nom = nomSecteurParDefaut(
      prenomDuMembre({ firstName: profile.first_name, fullName: profile.first_name }),
      zones.map((z) => z.nom),
    );
    const cree = await envoyer('/api/dashboard/zones', 'POST', {
      nom,
      assignedTo: profile.id,
      couleur: couleurZoneLibre(zones.map((z) => z.couleur)),
    });
    if (!cree.id) throw new Error('Le secteur n’a pas pu être créé');
    zoneRef.current = cree.id;
    creeIciRef.current = true;
    setZoneId(cree.id);
    return cree.id;
  }, [profile.first_name, profile.id, zones]);

  /** Les écritures partent dans l'ordre des gestes, une à la fois. */
  const enregistrer = useCallback(
    (corps: Record<string, unknown>, surReponse?: (r: Reponse) => void, surEchec?: () => void) => {
      setEnAttente((n) => n + 1);
      fileRef.current = fileRef.current.then(async () => {
        try {
          const id = await assurerZone();
          const r = await envoyer<Reponse>(`/api/dashboard/zones/${id}/parcelles`, 'POST', corps);
          const refusees = (r.refusees ?? []).map((x) => x.parcelleId);
          if (refusees.length > 0) {
            setMesIds((prev) => {
              const next = new Set(prev);
              for (const p of refusees) next.delete(p);
              return next;
            });
            notifyError(
              refusees.length > 1
                ? `${refusees.length} parcelles sont déjà dans le secteur d’un collègue`
                : 'Cette parcelle est déjà dans le secteur d’un collègue',
            );
          }
          surReponse?.(r);
        } catch (e) {
          surEchec?.();
          notifyError(e instanceof Error ? e.message : 'Le secteur n’a pas pu être enregistré');
        } finally {
          setEnAttente((n) => n - 1);
        }
      });
    },
    [assurerZone],
  );

  const appliquer = useCallback(
    (ajoutees: readonly string[], retirees: readonly string[], memoriser = true) => {
      if (ajoutees.length === 0 && retirees.length === 0) return;
      setMesIds((prev) => {
        const next = new Set(prev);
        for (const id of ajoutees) next.add(id);
        for (const id of retirees) next.delete(id);
        return next;
      });
      if (memoriser) setHistorique((h) => [...h, { ajoutees: [...ajoutees], retirees: [...retirees] }]);
      enregistrer({ ajouter: ajoutees, retirer: retirees }, undefined, () =>
        setMesIds((prev) => {
          const next = new Set(prev);
          for (const id of ajoutees) next.delete(id);
          for (const id of retirees) next.add(id);
          return next;
        }),
      );
    },
    [enregistrer],
  );

  /** Entourer : les parcelles dont le centre est dans le tracé. */
  const poserContour = useCallback(
    (polygone: GeoJSON.Polygon) => {
      const trace = { type: 'Polygon' as const, coordinates: polygone.coordinates as [number, number][][] };
      const dedans = [...candidatesRef.current.values()]
        .filter((p) => pointDansPolygone({ longitude: p.centre[0], latitude: p.centre[1] }, trace))
        .map((p) => p.id);
      // Trop dézoomé pour connaître les parcelles ici : le serveur les trouve.
      if (dedans.length === 0 && (zoom ?? 0) < ZOOM_PARCELLES) {
        enregistrer({ trace, mode }, (r) => {
          const ajoutees = r.ajoutees ?? [];
          const retirees = r.retirees ?? [];
          setMesIds((prev) => {
            const next = new Set(prev);
            for (const id of ajoutees) next.add(id);
            for (const id of retirees) next.delete(id);
            return next;
          });
          setHistorique((h) => [...h, { ajoutees, retirees }]);
        });
        return;
      }
      if (mode === 'ajouter') {
        appliquer(dedans.filter((id) => !mesRef.current.has(id) && !prises.has(id)), []);
      } else {
        appliquer([], dedans.filter((id) => mesRef.current.has(id)));
      }
    },
    [appliquer, enregistrer, mode, prises, zoom],
  );

  const toucherParcelle = useCallback(
    (parcelleId: string) => {
      if (mesRef.current.has(parcelleId)) {
        appliquer([], [parcelleId]);
        return;
      }
      const initiales = prises.get(parcelleId);
      if (initiales !== undefined) {
        notifyError(initiales ? `Cette parcelle est déjà dans le secteur de ${initiales}` : 'Cette parcelle est déjà prise');
        return;
      }
      appliquer([parcelleId], []);
    },
    [appliquer, prises],
  );

  const poserRue = useCallback(
    (voie: VoieTrouvee, parite: PariteVoie) => {
      const cle = cleRue(voie, parite);
      enregistrer({ rue: { nom: voie.nom, codePostal: voie.codePostal, id: voie.id, parite } }, (r) => {
        const ajoutees = r.ajoutees ?? [];
        setMesIds((prev) => new Set([...prev, ...ajoutees]));
        if (ajoutees.length === 0) {
          notifyInfo(`Rien à ajouter sur ${voie.nom} : aucune parcelle libre de ce côté.`);
          return;
        }
        setHistorique((h) => [...h, { ajoutees, retirees: [], rue: cle }]);
        setRues((prev) => {
          if (prev.some((x) => x.cle === cle)) {
            return prev.map((x) => (x.cle === cle ? { ...x, nombre: x.nombre + ajoutees.length } : x));
          }
          return [...prev, { cle, nom: voie.nom, parite, nombre: ajoutees.length }];
        });
      });
    },
    [enregistrer],
  );

  const retour = useCallback(() => {
    const dernier = historique[historique.length - 1];
    if (!dernier) return;
    setHistorique((h) => h.slice(0, -1));
    if (dernier.rue) setRues((prev) => prev.filter((x) => x.cle !== dernier.rue));
    appliquer(dernier.retirees, dernier.ajoutees, false);
  }, [appliquer, historique]);

  const surVue = useCallback((vue: Vue) => {
    setZoom(vue.zoom);
    if (vue.zoom < ZOOM_PARCELLES) return;
    const carreaux: { cle: string; ouest: number; sud: number }[] = [];
    for (let x = Math.floor(vue.west / CARREAU); x * CARREAU < vue.east; x += 1) {
      for (let y = Math.floor(vue.south / CARREAU); y * CARREAU < vue.north; y += 1) {
        const cle = `${x}:${y}`;
        if (!carreauxRef.current.has(cle)) carreaux.push({ cle, ouest: x * CARREAU, sud: y * CARREAU });
      }
    }
    for (const c of carreaux) {
      carreauxRef.current.add(c.cle);
      const params = new URLSearchParams({
        ouest: String(c.ouest),
        sud: String(c.sud),
        est: String(c.ouest + CARREAU),
        nord: String(c.sud + CARREAU),
      });
      void fetch(`/api/dashboard/zones/parcelles?${params.toString()}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ parcelles?: { id: string; anneaux: [number, number][][]; c: [number, number] }[] }>) : null))
        .then((json) => {
          const lues = json?.parcelles ?? [];
          if (lues.length === 0) return;
          setCandidates((prev) => {
            const next = new Map(prev);
            for (const p of lues) next.set(p.id, { id: p.id, anneaux: p.anneaux, centre: p.c });
            return next;
          });
        })
        .catch(() => carreauxRef.current.delete(c.cle));
    }
  }, []);

  /** Valider attend les gestes en cours ; un secteur né ici et resté vide disparaît. */
  const terminer = useCallback(() => {
    void fileRef.current.then(async () => {
      const id = zoneRef.current;
      if (id && mesRef.current.size === 0 && creeIciRef.current) {
        await envoyer(`/api/dashboard/zones/${id}`, 'DELETE').catch(() => undefined);
        rafraichirCarteSecteurs();
        onSupprime?.();
        return;
      }
      rafraichirCarteSecteurs();
      if (id && mesRef.current.size > 0) onValider?.(id);
      else onFermer?.();
    });
  }, [onFermer, onSupprime, onValider]);

  /** Quitte l’atelier. Un brouillon vide né ici ne reste pas en base. */
  const quitter = useCallback(() => {
    void fileRef.current.then(async () => {
      const id = zoneRef.current;
      if (id && mesRef.current.size === 0 && creeIciRef.current) {
        await envoyer(`/api/dashboard/zones/${id}`, 'DELETE').catch(() => undefined);
        rafraichirCarteSecteurs();
        onSupprime?.();
        return;
      }
      onFermer?.();
    });
  }, [onFermer, onSupprime]);

  const supprimer = useCallback(() => {
    void fileRef.current.then(async () => {
      const id = zoneRef.current;
      if (!id) {
        onFermer?.();
        return;
      }
      try {
        await envoyer(`/api/dashboard/zones/${id}`, 'DELETE');
      } catch (e) {
        notifyError(e instanceof Error ? e.message : 'Le secteur n’a pas pu être supprimé');
        return;
      }
      rafraichirCarteSecteurs();
      onSupprime?.();
    });
  }, [onFermer, onSupprime]);

  const nombre = mesIds.size;
  const panneau = ouvert ? (
    <Panneau
      titre={zone?.nom ?? 'Nouveau secteur'}
      couleur={couleurPropre}
      nombre={nombre}
      outil={outil}
      onOutil={setOutil}
      mode={mode}
      onMode={setMode}
      zoomTropLoin={zoom != null && zoom < ZOOM_PARCELLES}
      enAttente={enAttente > 0}
      centre={centre}
      rues={rues}
      onRue={poserRue}
      onRetour={historique.length > 0 ? retour : null}
      onValider={terminer}
      onFermer={quitter}
      onSupprimer={zoneId ? supprimer : null}
    />
  ) : null;

  const calque = ouvert
    ? { zoneId, mesIds, couleur: couleurPropre, candidates, montrerAutres: zone != null }
    : null;
  return { panneau, couleur: couleurPropre, calque, outil, poserContour, toucherParcelle, surVue };
}

function Panneau({
  titre,
  couleur,
  nombre,
  outil,
  onOutil,
  mode,
  onMode,
  zoomTropLoin,
  enAttente,
  centre,
  rues,
  onRue,
  onRetour,
  onValider,
  onFermer,
  onSupprimer,
}: {
  titre: string;
  couleur: string;
  nombre: number;
  outil: OutilAtelier;
  onOutil: (o: OutilAtelier) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  zoomTropLoin: boolean;
  enAttente: boolean;
  centre: { latitude: number | null; longitude: number | null };
  rues: readonly RuePosee[];
  onRue: (voie: VoieTrouvee, parite: PariteVoie) => void;
  onRetour: (() => void) | null;
  onValider: () => void;
  onFermer: () => void;
  onSupprimer: (() => void) | null;
}) {
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);
  return (
    <div className="rounded-[20px] bg-[#F4F6FB] px-3.5 py-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onFermer}
          className="text-[13px] font-semibold text-[#1A2A56] underline decoration-[#1A2A56]/30 underline-offset-[3px] hover:decoration-[#1A2A56]"
        >
          Retour
        </button>
        {onSupprimer ? (
          confirmeSuppression ? (
            <span className="flex items-center gap-2.5 text-[13px]">
              <button
                type="button"
                onClick={onSupprimer}
                className="font-semibold text-rose-700 underline decoration-rose-700/30 underline-offset-[3px]"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={() => setConfirmeSuppression(false)}
                className="font-medium text-text-muted"
              >
                Annuler
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmeSuppression(true)}
              className="text-[13px] font-medium text-rose-700 underline decoration-rose-700/25 underline-offset-[3px] hover:decoration-rose-700"
            >
              Supprimer
            </button>
          )
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: couleur }} />
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#1A2A56]">{titre}</p>
        <span className="shrink-0 text-[12.5px] tabular-nums text-text-muted">
          {nombre} parcelle{nombre > 1 ? 's' : ''}
        </span>
      </div>

      <div role="group" aria-label="Outil" className={`${PASTILLE_TRACK} mt-3 w-full`}>
        <button
          type="button"
          aria-pressed={outil === 'entourer'}
          onClick={() => onOutil('entourer')}
          className={`${pastilleClass(outil === 'entourer')} min-w-0 flex-1`}
        >
          Entourer
        </button>
        <button
          type="button"
          aria-pressed={outil === 'toucher'}
          onClick={() => onOutil('toucher')}
          className={`${pastilleClass(outil === 'toucher')} min-w-0 flex-1`}
        >
          Une par une
        </button>
      </div>

      {outil === 'entourer' ? (
        <>
          <div role="group" aria-label="Entourer pour" className={`${PASTILLE_TRACK} mt-2 w-full`}>
            <button
              type="button"
              aria-pressed={mode === 'ajouter'}
              onClick={() => onMode('ajouter')}
              className={`${pastilleClass(mode === 'ajouter')} min-w-0 flex-1`}
            >
              Ajouter
            </button>
            <button
              type="button"
              aria-pressed={mode === 'retirer'}
              onClick={() => onMode('retirer')}
              className={`${pastilleClass(mode === 'retirer')} min-w-0 flex-1`}
            >
              Retirer
            </button>
          </div>
          <p className="mt-2 text-[12.5px] leading-snug text-text-muted">
            {mode === 'ajouter'
              ? 'Entourez des immeubles sur la carte : leurs parcelles rejoignent le secteur.'
              : 'Entourez les parcelles à sortir du secteur.'}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[12.5px] leading-snug text-text-muted">
          Touchez une parcelle pour l’ajouter, touchez-la encore pour la retirer. La carte se déplace normalement.
        </p>
      )}
      {zoomTropLoin ? (
        <p className="mt-1.5 text-[12px] leading-snug text-text-subtle">Approchez-vous pour voir les parcelles une à une.</p>
      ) : null}

      <Rue centre={centre} occupe={enAttente} rues={rues} onChoisir={onRue} />

      <div className="mt-4 flex gap-2">
        {onRetour ? (
          <button
            type="button"
            onClick={onRetour}
            className="flex min-h-10 flex-1 items-center justify-center rounded-full bg-white text-[13px] font-semibold text-[#1A2A56]"
          >
            Défaire
          </button>
        ) : null}
        <button
          type="button"
          onClick={onValider}
          className="flex min-h-10 flex-[2] items-center justify-center rounded-full bg-[#1A2A56] text-[14px] font-semibold text-white"
        >
          {enAttente ? 'Enregistrement…' : 'Valider'}
        </button>
      </div>
      {nombre === 0 ? (
        <button
          type="button"
          onClick={onFermer}
          className="mt-2 flex min-h-9 w-full items-center justify-center rounded-full text-[13px] font-medium text-text-muted hover:text-text-strong"
        >
          Annuler
        </button>
      ) : null}
    </div>
  );
}

function Rue({
  centre,
  occupe,
  rues,
  onChoisir,
}: {
  centre: { latitude: number | null; longitude: number | null };
  occupe: boolean;
  rues: readonly RuePosee[];
  onChoisir: (voie: VoieTrouvee, parite: PariteVoie) => void;
}) {
  const listeId = useId();
  const champRef = useRef<HTMLDivElement>(null);
  const centreRef = useRef(centre);
  centreRef.current = centre;
  const [saisie, setSaisie] = useState('');
  const [voies, setVoies] = useState<VoieTrouvee[]>([]);
  const [voie, setVoie] = useState<VoieTrouvee | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const [boite, setBoite] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const q = saisie.trim();
    if (voie || q.length < 3) {
      setVoies([]);
      setRecherche(false);
      setOuvert(false);
      return;
    }
    const abandon = new AbortController();
    setRecherche(true);
    setOuvert(true);
    setActif(0);
    const minuterie = window.setTimeout(() => {
      const params = new URLSearchParams({ q, type: 'street', limit: '6' });
      const ici = centreRef.current;
      if (ici.latitude != null && ici.longitude != null) {
        params.set('lat', String(ici.latitude));
        params.set('lon', String(ici.longitude));
      }
      fetch(`/api/ban/search?${params.toString()}`, { signal: abandon.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (abandon.signal.aborted) return;
          setVoies(lireVoies(data));
        })
        .catch(() => {
          if (!abandon.signal.aborted) setVoies([]);
        })
        .finally(() => {
          if (!abandon.signal.aborted) setRecherche(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(minuterie);
      abandon.abort();
    };
  }, [saisie, voie]);

  useLayoutEffect(() => {
    if (!ouvert) return;
    function placer() {
      const el = champRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const haut = 240;
      const dessous = window.innerHeight - r.bottom;
      const top = dessous < haut && r.top > haut ? r.top - 6 - haut : r.bottom + 6;
      setBoite({ top, left: r.left, width: r.width });
    }
    placer();
    window.addEventListener('resize', placer);
    window.addEventListener('scroll', placer, true);
    return () => {
      window.removeEventListener('resize', placer);
      window.removeEventListener('scroll', placer, true);
    };
  }, [ouvert, voies.length, recherche, saisie]);

  function choisirVoie(v: VoieTrouvee) {
    setVoie(v);
    setSaisie('');
    setVoies([]);
    setOuvert(false);
  }

  function choisirCote(parite: PariteVoie) {
    if (!voie || occupe) return;
    onChoisir(voie, parite);
  }

  // La rue choisie reste : l'autre côté se pose d'un clic, et les côtés déjà posés restent marqués.
  const cotesPoses = new Set(
    rues.filter((x) => voie && x.cle.startsWith(`${voie.nom}|${voie.codePostal}|`)).map((x) => x.parite),
  );

  const liste =
    ouvert && boite && typeof document !== 'undefined'
      ? createPortal(
          <div
            id={listeId}
            role="listbox"
            aria-label="Rues"
            style={{ top: boite.top, left: boite.left, width: boite.width }}
            className="fixed z-[420] max-h-60 overflow-y-auto rounded-2xl border border-black/[0.06] bg-white p-1.5 shadow-clay-lg"
          >
            {voies.length === 0 ? (
              <p className="px-3 py-2.5 text-[13px] text-text-muted" role="status">
                {recherche ? 'Recherche…' : `Aucune rue pour « ${saisie.trim()} ».`}
              </p>
            ) : (
              <ul className="flex flex-col">
                {voies.map((v, i) => (
                  <li key={v.id} id={`${listeId}-${i}`} role="option" aria-selected={actif === i}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseMove={() => setActif(i)}
                      onClick={() => choisirVoie(v)}
                      className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left ${
                        actif === i ? 'bg-[#EEF1F8]' : ''
                      }`}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#F4F6FB] text-[#1A2A56]">
                        <MapPin size={15} strokeWidth={2} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-[#1A2A56]">{v.nom}</span>
                        <span className="mt-px block truncate text-[12px] text-text-muted">
                          {v.codePostal} {v.commune}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[12px] font-medium text-text-muted">Ou toute une rue</p>
      {voie ? (
        <button
          type="button"
          onClick={() => setVoie(null)}
          className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-left"
        >
          <MapPin size={15} strokeWidth={2} aria-hidden className="shrink-0 text-[#1A2A56]" />
          <span className="min-w-0 truncate text-[13.5px] font-medium text-[#1A2A56]">
            {voie.nom}
            <span className="ml-1.5 font-normal text-text-muted">
              {voie.codePostal} {voie.commune}
            </span>
          </span>
        </button>
      ) : (
        <div ref={champRef} className="relative">
          <MapPin
            size={15}
            strokeWidth={2}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1A2A56]"
          />
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onFocus={() => {
              if (saisie.trim().length >= 3) setOuvert(true);
            }}
            onKeyDown={(e) => {
              if (!ouvert) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActif((i) => Math.min(i + 1, Math.max(voies.length - 1, 0)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActif((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && voies[actif]) {
                e.preventDefault();
                choisirVoie(voies[actif]);
              } else if (e.key === 'Escape') {
                setOuvert(false);
              }
            }}
            aria-label="Rue"
            aria-expanded={ouvert}
            aria-controls={listeId}
            aria-autocomplete="list"
            role="combobox"
            autoComplete="off"
            placeholder="Nom de la rue"
            className="w-full rounded-xl border border-black/10 bg-white py-2 pl-9 pr-3 text-[13.5px] text-[#1A2A56] outline-none placeholder:text-text-muted/70 focus:border-[#1A2A56]"
          />
        </div>
      )}
      {liste}
      <div role="group" aria-label="Côté de la rue" className={`${PASTILLE_TRACK} mt-2 w-full`}>
        {COTES.map((cote) => (
          <button
            key={cote.id}
            type="button"
            aria-pressed={cotesPoses.has(cote.id)}
            disabled={!voie || occupe}
            onClick={() => choisirCote(cote.id)}
            className={`${pastilleClass(cotesPoses.has(cote.id))} min-w-0 flex-1 disabled:cursor-default disabled:opacity-40`}
          >
            {cote.label}
          </button>
        ))}
      </div>
      {rues.length > 0 ? (
        <ul aria-label="Rues du secteur" className="mt-2.5 flex flex-col gap-1.5">
          {rues.map((x) => (
            <li key={x.cle} className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-[13px] text-[#1A2A56]">
              <Check size={14} strokeWidth={2.5} aria-hidden className="shrink-0" />
              <span className="min-w-0 flex-1 truncate font-medium">{x.nom}</span>
              <span className="shrink-0 text-[12px] text-text-muted">
                {COTES.find((c) => c.id === x.parite)?.label ?? ''} · {x.nombre} parcelle{x.nombre > 1 ? 's' : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
