'use client';

// TEMPORAIRE — aperçu visuel des secteurs. À supprimer.
import DeviceProvider from '@/components/dashboard/device/DeviceProvider';
import AtelierSecteur from '@/components/dashboard/accueil/SecteurAtelier';
import MonSecteur from '@/components/dashboard/accueil/MonSecteur';
import { chercherVoies, numerosDeLaVoie } from '@/lib/geo/ban-voie';
import type { Zone } from '@/lib/zones/types';

const carre = (o: number, s: number, e: number, n: number) => ({
  type: 'Polygon' as const,
  coordinates: [[[o, s], [e, s], [e, n], [o, n], [o, s]] as [number, number][]],
});

const Z1: Zone = {
  id: 'z1', agencyId: 'a', nom: 'Secteur de Simon', couleur: '#4C7A9E', assignedTo: 'moi',
  joursSemaine: [], actif: true, verrouillee: false,
  regles: [
    { id: 'r1', zoneId: 'z1', inclusion: true, type: 'polygone', valeur: carre(2.364, 48.8615, 2.3745, 48.8668) },
    { id: 'r2', zoneId: 'z1', inclusion: true, type: 'voie', valeur: { nom_voie: 'Rue Oberkampf', code_postal: '75011', parite: 'paires', numero_min: 60, numero_max: 120 } },
    { id: 'r3', zoneId: 'z1', inclusion: false, type: 'voie', valeur: { nom_voie: 'Rue Amelot', code_postal: '75011', parite: 'impaires', numero_min: null, numero_max: null } },
  ],
};
const Z2: Zone = {
  id: 'z2', agencyId: 'a', nom: 'Secteur de Bruno', couleur: '#B8860B', assignedTo: 'b',
  joursSemaine: [], actif: true, verrouillee: false,
  regles: [{ id: 'r4', zoneId: 'z2', inclusion: true, type: 'polygone', valeur: carre(2.3755, 48.8585, 2.3865, 48.8655) }],
};

let installe = false;
function installerFauxServeur() {
  if (installe) return;
  installe = true;
  const vrai = window.fetch.bind(window);
  let n = 0;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.startsWith('/api/dashboard/zones/voies/numeros')) {
      const p = new URL(url, location.origin).searchParams;
      return json({ numeros: await numerosDeLaVoie({ nom: p.get('nom') ?? '', codePostal: p.get('cp') ?? '' }) });
    }
    if (url.startsWith('/api/dashboard/zones/voies')) {
      const p = new URL(url, location.origin).searchParams;
      return json({ voies: await chercherVoies(p.get('q') ?? '', { proche: { latitude: 48.8655, longitude: 2.3702 } }) });
    }
    if (url.includes('/statistiques')) return json({ immeubles: 412, rues: 18, immeublesVus: 0, couverture: null, adressesPriimo: 37, principalesRues: [], tronque: false });
    if (url.startsWith('/api/dashboard/zones')) {
      (window as unknown as { appels: string[] }).appels ??= [];
      (window as unknown as { appels: string[] }).appels.push(`${init?.method ?? 'GET'} ${url} ${init?.body ?? ''}`);
      n += 1;
      return json({ id: `nouveau-${n}` });
    }
    return vrai(input, init);
  };
}

export default function ApercuSecteur({ etat }: { etat: string }) {
  installerFauxServeur();
  const membres = [
    { id: 'moi', fullName: 'Simon Ropiot', firstName: 'Simon' },
    { id: 'b', fullName: 'Bruno Petit', firstName: 'Bruno' },
  ];
  const centre = { latitude: 48.8655, longitude: 2.3702 };
  if (etat === 'accueil') {
    return (
      <DeviceProvider device="desktop">
        <div className="min-h-dvh bg-bg-base p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="min-w-0">
              <MonSecteur
                apercu={{ zones: [Z1], points: [], repartition: { semaine: 3, cycle: 5, revoir: 2, jamais: 7 }, aRevoir: 9, cycleSemaines: null, phrase: null, zonesDirecteur: [] }}
                toutesZones={[Z1, Z2]}
                centre={centre}
                estDirecteur={false}
                onAtelier={() => {}}
              />
            </div>
          </div>
        </div>
      </DeviceProvider>
    );
  }
  const mobile = etat.endsWith('-mobile');
  const vide = etat.startsWith('vide');
  return (
    <DeviceProvider device={mobile ? 'mobile' : 'desktop'}>
      <div className={mobile ? 'dashboard-mobile h-dvh bg-bg-base' : 'h-dvh bg-bg-base'}>
        <AtelierSecteur
          open
          onClose={() => {}}
          estDirecteur={false}
          data={{ zones: vide ? [] : [Z1, Z2], membres, leads: [], centre, profileId: 'moi' }}
        />
      </div>
    </DeviceProvider>
  );
}
