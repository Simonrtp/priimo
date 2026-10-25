'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';
import { notifyError } from '@/lib/notify';
import { useUser } from '@/lib/hooks/useUser';
import type { VoieTrouvee } from '@/lib/geo/ban-voie';
import { couleurZoneLibre } from '@/lib/zones/palette';
import { nomSecteurParDefaut, prenomDuMembre } from '@/lib/zones/nom';
import { resumerVoie } from '@/lib/zones/voie-trace';
import type { PariteVoie, ValeurVoie, Zone } from '@/lib/zones/types';

type Etape =
  | { kind: 'contour'; zoneId: string; regleId: string; libelle: string }
  | { kind: 'rue'; zoneId: string; regleId: string; libelle: string };

const COTES: readonly { id: PariteVoie; label: string }[] = [
  { id: 'toutes', label: 'Tous' },
  { id: 'paires', label: 'Pairs' },
  { id: 'impaires', label: 'Impairs' },
];

async function envoyer(url: string, methode: string, corps?: unknown): Promise<{ id?: string }> {
  const res = await fetch(url, {
    method: methode,
    headers: corps ? { 'Content-Type': 'application/json' } : undefined,
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Enregistrement impossible');
  return data;
}

/**
 * Carte de prospection, sans secteur encore : on trace sur la carte, on peut
 * poser une rue d'un côté ou de l'autre. Chaque geste est déjà en base.
 * Valider ferme le tracé pour que la carte affiche le secteur.
 */
export function useDessinSecteur({
  ouvert,
  zones,
  centre,
  onValider,
}: {
  ouvert: boolean;
  zones: readonly Zone[];
  centre: { latitude: number | null; longitude: number | null };
  onValider?: (zoneId: string) => void;
}): {
  panneau: ReactNode;
  couleur: string;
  polygone: GeoJSON.Polygon | null;
  poserContour: (polygone: GeoJSON.Polygon) => void;
} {
  const router = useRouter();
  const { profile } = useUser();
  const [pile, setPile] = useState<Etape[]>([]);
  const [contour, setContour] = useState<GeoJSON.Polygon | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [couleur, setCouleur] = useState(() => couleurZoneLibre(zones.map((z) => z.couleur)));
  const pileRef = useRef(pile);
  const zoneRef = useRef<string | null>(null);
  const contourRef = useRef(contour);
  const occupeRef = useRef(false);
  const couleurRef = useRef(couleur);
  pileRef.current = pile;
  contourRef.current = contour;
  couleurRef.current = couleur;

  useEffect(() => {
    if (!ouvert) return;
    setPile([]);
    setContour(null);
    zoneRef.current = null;
    const suivante = couleurZoneLibre(zones.map((z) => z.couleur));
    couleurRef.current = suivante;
    setCouleur(suivante);
    // On repart d'une carte vide à chaque ouverture, pas à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  const assurerZone = useCallback(async () => {
    if (zoneRef.current) return zoneRef.current;
    const nom = nomSecteurParDefaut(
      prenomDuMembre({ firstName: profile.first_name, fullName: profile.first_name }),
      zones.map((z) => z.nom),
    );
    const cree = await envoyer('/api/dashboard/zones', 'POST', {
      nom,
      assignedTo: profile.id,
      couleur: couleurRef.current,
    });
    if (!cree.id) throw new Error('Le secteur n’a pas pu être créé');
    zoneRef.current = cree.id;
    return cree.id;
  }, [profile.first_name, profile.id, zones]);

  const poserContour = useCallback(
    (polygone: GeoJSON.Polygon) => {
      if (occupeRef.current) return;
      occupeRef.current = true;
      setOccupe(true);
      const avant = contourRef.current;
      setContour(polygone);
      void (async () => {
        try {
          const zoneId = await assurerZone();
          const ancien = pileRef.current.find((e) => e.kind === 'contour');
          if (ancien) {
            await envoyer(`/api/dashboard/zones/${zoneId}/regles/${ancien.regleId}`, 'DELETE');
          }
          const cree = await envoyer(`/api/dashboard/zones/${zoneId}/regles`, 'POST', {
            type: 'polygone',
            valeur: polygone,
            inclusion: true,
          });
          if (!cree.id) throw new Error('Le contour n’a pas pu être enregistré');
          const etape: Etape = { kind: 'contour', zoneId, regleId: cree.id, libelle: 'Contour' };
          setPile((prev) => {
            const index = prev.findIndex((e) => e.kind === 'contour');
            if (index === -1) return [etape, ...prev];
            const next = prev.slice();
            next[index] = etape;
            return next;
          });
          router.refresh();
        } catch (e) {
          setContour(avant);
          notifyError(e instanceof Error ? e.message : 'Le secteur n’a pas pu être enregistré');
        } finally {
          occupeRef.current = false;
          setOccupe(false);
        }
      })();
    },
    [assurerZone, router],
  );

  const poserRue = useCallback(
    (voie: VoieTrouvee, parite: PariteVoie) => {
      if (occupeRef.current) return;
      occupeRef.current = true;
      setOccupe(true);
      const valeur: ValeurVoie = {
        nom_voie: voie.nom,
        code_postal: voie.codePostal,
        parite,
        numero_min: null,
        numero_max: null,
      };
      void (async () => {
        try {
          const zoneId = await assurerZone();
          const cree = await envoyer(`/api/dashboard/zones/${zoneId}/regles`, 'POST', {
            type: 'voie',
            valeur,
            inclusion: true,
          });
          if (!cree.id) throw new Error('La rue n’a pas pu être enregistrée');
          setPile((prev) => [
            ...prev,
            { kind: 'rue', zoneId, regleId: cree.id!, libelle: resumerVoie(valeur) },
          ]);
          router.refresh();
        } catch (e) {
          notifyError(e instanceof Error ? e.message : 'La rue n’a pas pu être enregistrée');
        } finally {
          occupeRef.current = false;
          setOccupe(false);
        }
      })();
    },
    [assurerZone, router],
  );

  const retour = useCallback(() => {
    const dernier = pileRef.current[pileRef.current.length - 1];
    if (!dernier || occupeRef.current) return;
    occupeRef.current = true;
    setOccupe(true);
    void (async () => {
      try {
        await envoyer(
          `/api/dashboard/zones/${dernier.zoneId}/regles/${dernier.regleId}`,
          'DELETE',
        );
        const reste = pileRef.current.slice(0, -1);
        if (dernier.kind === 'contour') setContour(null);
        if (reste.length === 0) {
          await envoyer(`/api/dashboard/zones/${dernier.zoneId}`, 'DELETE');
          zoneRef.current = null;
          setContour(null);
        }
        setPile(reste);
        router.refresh();
      } catch (e) {
        notifyError(e instanceof Error ? e.message : 'Retour impossible');
      } finally {
        occupeRef.current = false;
        setOccupe(false);
      }
    })();
  }, [router]);

  const valider = useCallback(() => {
    const id = zoneRef.current;
    if (!id || occupeRef.current || pileRef.current.length === 0) return;
    onValider?.(id);
  }, [onValider]);

  const trace = pile.length > 0 || contour != null;
  const panneau = ouvert ? (
    <Panneau
      centre={centre}
      etapes={pile}
      occupe={occupe}
      onRue={poserRue}
      onRetour={pile.length > 0 ? retour : null}
      onValider={trace ? valider : null}
      peutValider={pile.length > 0 && !occupe}
    />
  ) : null;

  return { panneau, couleur, polygone: ouvert ? contour : null, poserContour };
}

function Panneau({
  centre,
  etapes,
  occupe,
  onRue,
  onRetour,
  onValider,
  peutValider,
}: {
  centre: { latitude: number | null; longitude: number | null };
  etapes: readonly Etape[];
  occupe: boolean;
  onRue: (voie: VoieTrouvee, parite: PariteVoie) => void;
  onRetour: (() => void) | null;
  onValider: (() => void) | null;
  peutValider: boolean;
}) {
  return (
    <div className="rounded-[20px] bg-[#F4F6FB] px-3.5 py-4">
      <p className="text-[15px] font-semibold text-[#1A2A56]">Mon secteur</p>
      <p className="mt-1 text-[13px] text-text-muted">Tracez sur la carte.</p>
      <Rue centre={centre} occupe={occupe} onChoisir={onRue} />
      {etapes.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1">
          {etapes.map((etape) => (
            <li key={etape.regleId} className="truncate text-[13px] text-[#1A2A56]">
              {etape.libelle}
            </li>
          ))}
        </ul>
      ) : null}
      {onValider ? (
        <button
          type="button"
          disabled={!peutValider}
          onClick={onValider}
          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-full bg-[#1A2A56] text-[14px] font-semibold text-white disabled:opacity-50"
        >
          Valider
        </button>
      ) : null}
      {onRetour ? (
        <button
          type="button"
          disabled={occupe}
          onClick={onRetour}
          className="mt-2 flex min-h-10 w-full items-center justify-center rounded-full bg-white text-[13px] font-semibold text-[#1A2A56] disabled:opacity-50"
        >
          Retour
        </button>
      ) : null}
    </div>
  );
}

function Rue({
  centre,
  occupe,
  onChoisir,
}: {
  centre: { latitude: number | null; longitude: number | null };
  occupe: boolean;
  onChoisir: (voie: VoieTrouvee, parite: PariteVoie) => void;
}) {
  const [saisie, setSaisie] = useState('');
  const [voies, setVoies] = useState<VoieTrouvee[]>([]);
  const [voie, setVoie] = useState<VoieTrouvee | null>(null);

  useEffect(() => {
    const q = saisie.trim();
    if (voie || q.length < 3) return;
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
        .catch(() => undefined);
    }, 220);
    return () => {
      window.clearTimeout(minuterie);
      abandon.abort();
    };
  }, [saisie, voie, centre.latitude, centre.longitude]);

  const visibles = !voie && saisie.trim().length >= 3 ? voies : [];

  function choisirCote(parite: PariteVoie) {
    if (!voie || occupe) return;
    onChoisir(voie, parite);
    setVoie(null);
    setSaisie('');
    setVoies([]);
  }

  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[12px] font-medium text-text-muted">Rue</p>
      {voie ? (
        <button
          type="button"
          onClick={() => setVoie(null)}
          className="block w-full truncate text-left text-[13.5px] font-medium text-[#1A2A56]"
        >
          {voie.nom}
          <span className="ml-1.5 font-normal text-text-muted">{voie.codePostal}</span>
        </button>
      ) : (
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          aria-label="Rue"
          placeholder="Nom de la rue"
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13.5px] text-[#1A2A56] outline-none placeholder:text-text-muted/70 focus:border-[#1A2A56]"
        />
      )}
      {visibles.length > 0 ? (
        <ul role="listbox" aria-label="Rues" className="mt-1.5 flex max-h-36 flex-col overflow-y-auto rounded-xl bg-white p-1">
          {visibles.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  setVoie(v);
                  setSaisie('');
                }}
                className="flex w-full items-baseline gap-1.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-[#1A2A56] hover:bg-black/[0.04]"
              >
                <span className="min-w-0 truncate font-medium">{v.nom}</span>
                <span className="shrink-0 text-[12px] text-text-muted">{v.codePostal}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div role="group" aria-label="Côté de la rue" className={`${PASTILLE_TRACK} mt-2 w-full`}>
        {COTES.map((cote) => (
          <button
            key={cote.id}
            type="button"
            aria-pressed={false}
            disabled={!voie || occupe}
            onClick={() => choisirCote(cote.id)}
            className={`${pastilleClass(false)} min-w-0 flex-1 disabled:cursor-default disabled:opacity-40`}
          >
            {cote.label}
          </button>
        ))}
      </div>
    </div>
  );
}
