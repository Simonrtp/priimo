'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Lead } from '@/types/lead';
import type { ItineraireStop } from '@/lib/today/directions';
import type { MapPoint, UnplacedRecord, WithoutPositionCount } from '@/lib/carte/points';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import SectorMapClient from '@/components/dashboard/carte/SectorMapClient';
import CarteMobile from '@/app/dashboard/_mobile/CarteMobile';
import ProspectsViewSwitch, { prospectionHref, type ProspectionVue } from './ProspectsViewSwitch';
import type { Zone } from '@/lib/zones/types';

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
  initialLeads,
  profileId,
  agencyOrigin,
  initialBanId,
  itineraryStops,
  showItineraire,
  autoTournee,
  zones = [],
  initialZoneId = null,
}: {
  points: MapPoint[];
  withoutPosition: WithoutPositionCount;
  unplaced: UnplacedRecord[];
  agencyPostalCodes: string[];
  center: { latitude: number | null; longitude: number | null };
  members: readonly AssigneeOption[];
  isDirector: boolean;
  initialLeads: Lead[];
  profileId: string;
  agencyOrigin: { latitude: number; longitude: number } | null;
  initialBanId: string | null;
  itineraryStops: ItineraireStop[] | null;
  showItineraire: boolean;
  autoTournee: boolean;
  zones?: readonly Zone[];
  initialZoneId?: string | null;
}) {
  const router = useRouter();
  const device = useDevice();

  const setVue = useCallback(
    (next: ProspectionVue) => {
      const params = new URLSearchParams(window.location.search);
      router.replace(prospectionHref(params, next), { scroll: false });
    },
    [router],
  );

  const switcherCarte = <ProspectsViewSwitch variant="bar" value="carte" onChange={setVue} />;
  const switcherBureau = <ProspectsViewSwitch variant="floating" value="carte" onChange={setVue} />;
  const zonesVisibles = zones.filter(
    (z) => z.actif && (isDirector || z.assignedTo === profileId),
  );

  if (device === 'mobile') {
    return (
      <div
        data-prospection-carte
        className="field-map relative h-full min-h-0 w-full overflow-hidden"
      >
        <div className="h-full min-h-0">
          <CarteMobile
            points={points}
            withoutPosition={withoutPosition}
            unplaced={unplaced}
            agencyPostalCodes={agencyPostalCodes}
            center={center}
            members={members}
            isDirector={isDirector}
            initialLeads={initialLeads}
            profileId={profileId}
            agencyOrigin={agencyOrigin}
            initialBanId={initialBanId}
            itineraryStops={itineraryStops}
            showItineraire={showItineraire}
            autoTournee={autoTournee}
            fillParent
            zones={zonesVisibles}
            initialZoneId={initialZoneId}
            viewSwitcher={switcherCarte}
          />
        </div>
      </div>
    );
  }

  return (
    <div data-prospection-carte className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <SectorMapClient
        points={points}
        withoutPosition={withoutPosition}
        unplaced={unplaced}
        agencyPostalCodes={agencyPostalCodes}
        center={center}
        members={members}
        isDirector={isDirector}
        initialBanId={initialBanId}
        itineraryStops={itineraryStops}
        showItineraire={showItineraire}
        embedded
        viewSwitcher={switcherBureau}
        zones={zonesVisibles}
        initialZoneId={initialZoneId}
      />
    </div>
  );
}
