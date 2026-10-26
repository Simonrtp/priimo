'use client';

import { useRouter } from 'next/navigation';
import type { ApercuSecteur } from '@/lib/zones/accueil';
import { hrefAtelierSecteur } from '@/lib/zones/atelier-event';
import MonSecteur from './MonSecteur';
import { DessinerMonSecteur } from './CarteTourneeFraicheur';
import type { SecteursData } from './SecteurAtelier';

/**
 * Le secteur sur l'Accueil : invitation à le dessiner, ou carte figée.
 * Le dessin n'a lieu que sur la carte de prospection.
 */
export default function SecteurAccueil({
  apercu,
  centre,
  estDirecteur,
  secteurs,
  prenom = null,
}: {
  apercu: ApercuSecteur;
  centre: { latitude: number | null; longitude: number | null };
  estDirecteur: boolean;
  secteurs: SecteursData;
  /** Prénom du titulaire, quand le directeur lit son tableau. */
  prenom?: string | null;
}) {
  const router = useRouter();
  const allerAtelier = (zoneId?: string) => router.push(hrefAtelierSecteur(zoneId ?? 'nouveau'));

  return (
    <div className="flex h-full min-w-0 flex-col">
      {apercu.zones.length > 0 ? (
        <MonSecteur
          apercu={apercu}
          toutesZones={secteurs.zones.filter((z) => z.actif)}
          centre={centre}
          estDirecteur={estDirecteur}
          onAtelier={() => allerAtelier(apercu.zones[0]?.id ?? 'nouveau')}
          prenom={prenom}
        />
      ) : (
        <DessinerMonSecteur estDirecteur={estDirecteur} onAtelier={() => allerAtelier()} prenom={prenom} />
      )}
    </div>
  );
}
