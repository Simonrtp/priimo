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

/**
 * Vue Carte de la prospection : même carte qu’avant, avec le switch Liste / Pipeline / Carte.
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

  const switcher = (
    <div className="mb-3 flex shrink-0 justify-end px-1 md:px-0">
      <ProspectsViewSwitch value="carte" onChange={setVue} />
    </div>
  );

  if (device === 'mobile') {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        {switcher}
        <div className="min-h-0 flex-1">
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
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      {switcher}
      <div className="min-h-0 flex-1">
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
        />
      </div>
    </div>
  );
}
