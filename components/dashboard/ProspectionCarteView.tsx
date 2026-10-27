'use client';

import { useCallback } from 'react';
import {
  useEmplacementAffiche,
  useNavigationInstantanee,
} from '@/components/dashboard/navigation/NavigationInstantanee';
import { vueProspection } from '@/lib/navigation/cible';
import type { ItineraireStop } from '@/lib/today/directions';
import type { MapPoint, UnplacedRecord, WithoutPositionCount } from '@/lib/carte/points';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import SectorMapClient from '@/components/dashboard/carte/SectorMapClient';
import RechercheAdresseCarte from '@/components/dashboard/carte/RechercheAdresseCarte';
import CarteMobile from '@/app/dashboard/_mobile/CarteMobile';
import { LimiteErreur } from '@/components/erreurs/EcranReprise';
import ProspectsViewSwitch, { prospectionHref, type ProspectionVue } from './ProspectsViewSwitch';
import type { Zone } from '@/lib/zones/types';
import type { RepliImmeuble } from '@/lib/carte/buildings';

/**
 * Vue Carte de la prospection : même carte qu’avant, avec le switch Carte / Liste / Pipeline.
 */
export default function ProspectionCarteView({
  points,
  withoutPosition,
  unplaced,
  agencyPostalCodes,
  center,
  members,
  isDirector,
  profileId,
  initialBanId,
  initialBanPos = null,
  initialParcelleId = null,
  itineraryStops,
  showItineraire,
  autoTournee,
  zones = [],
  initialZoneId = null,
  initialAtelier = null,
}: {
  points: MapPoint[];
  withoutPosition: WithoutPositionCount;
  unplaced: UnplacedRecord[];
  agencyPostalCodes: string[];
  center: { latitude: number | null; longitude: number | null };
  members: readonly AssigneeOption[];
  isDirector: boolean;
  profileId: string;
  initialBanId: string | null;
  initialBanPos?: RepliImmeuble | null;
  initialParcelleId?: string | null;
  itineraryStops: ItineraireStop[] | null;
  showItineraire: boolean;
  autoTournee: boolean;
  zones?: readonly Zone[];
  initialZoneId?: string | null;
  initialAtelier?: string | null;
}) {
  const device = useDevice();
  const { naviguer } = useNavigationInstantanee();
  // La pastille glisse dès le clic ; la carte reste jusqu'au squelette de la vue demandée.
  const vueOnglet = vueProspection(useEmplacementAffiche()) ?? 'carte';

  const setVue = useCallback(
    (next: ProspectionVue) => {
      const params = new URLSearchParams(window.location.search);
      naviguer(prospectionHref(params, next), { remplacer: true });
    },
    [naviguer],
  );

  const switcherCarte = <ProspectsViewSwitch variant="bar" value={vueOnglet} onChange={setVue} />;
  // Sur ordinateur, la loupe d'adresse vit dans l'onglet de la carte, juste avant « Carte ».
  const switcherBureau = (
    <ProspectsViewSwitch variant="floating" value={vueOnglet} onChange={setVue} debut={<RechercheAdresseCarte />} />
  );
  const zonesVisibles = zones.filter(
    (z) => z.actif && (isDirector || z.assignedTo === profileId),
  );

  if (device === 'mobile') {
    return (
      <LimiteErreur
        titre="La carte n’a pas pu s’afficher."
        detail="Réessayez. La tournée en cours est toujours là."
        action="Réessayer"
      >
      <div
        data-prospection-carte
        className="field-map relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div className="min-h-0 flex-1">
          <CarteMobile
            points={points}
            withoutPosition={withoutPosition}
            unplaced={unplaced}
            agencyPostalCodes={agencyPostalCodes}
            center={center}
            members={members}
            isDirector={isDirector}
            profileId={profileId}
            initialBanId={initialBanId}
            initialBanPos={initialBanPos}
            initialParcelleId={initialParcelleId}
            itineraryStops={itineraryStops}
            showItineraire={showItineraire}
            autoTournee={autoTournee}
            fillParent
            zones={zonesVisibles}
            initialZoneId={initialZoneId}
            initialAtelier={initialAtelier}
            viewSwitcher={switcherCarte}
          />
        </div>
      </div>
      </LimiteErreur>
    );
  }

  return (
    <LimiteErreur
      titre="La carte n’a pas pu s’afficher."
      detail="Réessayez. Rien n’est perdu."
      action="Réessayer"
    >
    <div data-prospection-carte className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <SectorMapClient
        points={points}
        withoutPosition={withoutPosition}
        unplaced={unplaced}
        center={center}
        members={members}
        isDirector={isDirector}
        initialBanId={initialBanId}
        initialBanPos={initialBanPos}
        initialParcelleId={initialParcelleId}
        itineraryStops={itineraryStops}
        showItineraire={showItineraire}
        embedded
        viewSwitcher={switcherBureau}
        zones={zonesVisibles}
        initialZoneId={initialZoneId}
        initialAtelier={initialAtelier}
      />
    </div>
    </LimiteErreur>
  );
}
