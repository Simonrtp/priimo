'use client';

import { useState } from 'react';
import type { ApercuSecteur } from '@/lib/zones/accueil';
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
}: {
  apercu: ApercuSecteur;
  centre: { latitude: number | null; longitude: number | null };
  estDirecteur: boolean;
  secteurs: SecteursData;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ouvrir = () => setOuvert(true);

  return (
    <>
      {apercu.zones.length > 0 ? (
        <MonSecteur
          apercu={apercu}
          centre={centre}
          estDirecteur={estDirecteur}
          onAtelier={ouvrir}
        />
      ) : (
        <DessinerMonSecteur estDirecteur={estDirecteur} onAtelier={ouvrir} />
      )}

      <AtelierSecteur
        open={ouvert}
        onClose={() => setOuvert(false)}
        data={secteurs}
        estDirecteur={estDirecteur}
      />
    </>
  );
}
