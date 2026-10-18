'use client';

import { useEffect, useState } from 'react';
import type { ApercuSecteur } from '@/lib/zones/accueil';
import { EVENEMENT_ATELIER_SECTEUR } from '@/lib/zones/atelier-event';
import MonSecteur from './MonSecteur';
import { DessinerMonSecteur } from './CarteTourneeFraicheur';
import AtelierSecteur, { type SecteursData } from './SecteurAtelier';

/**
 * Le secteur sur l'Accueil : l'invitation à le dessiner tant qu'il n'existe
 * pas, la carte ensuite. L'atelier est monté ici, au-dessus des deux, pour
 * survivre au basculement de l'un à l'autre : créer sa zone fait passer de
 * « dessiner » à « mon secteur », et l'agent doit rester dans son tracé.
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
  const [ouvert, setOuvert] = useState(false);
  const ouvrir = () => setOuvert(true);

  useEffect(() => {
    const onOpen = () => setOuvert(true);
    window.addEventListener(EVENEMENT_ATELIER_SECTEUR, onOpen);
    return () => window.removeEventListener(EVENEMENT_ATELIER_SECTEUR, onOpen);
  }, []);

  return (
    <div className="flex h-full min-w-0 flex-col">
      {apercu.zones.length > 0 ? (
        <MonSecteur
          apercu={apercu}
          toutesZones={secteurs.zones.filter((z) => z.actif)}
          centre={centre}
          estDirecteur={estDirecteur}
          onAtelier={ouvrir}
          prenom={prenom}
        />
      ) : (
        <DessinerMonSecteur estDirecteur={estDirecteur} onAtelier={ouvrir} prenom={prenom} />
      )}

      <AtelierSecteur
        open={ouvert}
        onClose={() => setOuvert(false)}
        data={secteurs}
        estDirecteur={estDirecteur}
      />
    </div>
  );
}
