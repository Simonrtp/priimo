'use client';

import { FacadeStreetView } from '@/components/dashboard/FacadeLead';

export default function ImmeubleFacade({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  return (
    <div className="mt-3">
      <FacadeStreetView latitude={latitude} longitude={longitude} className="h-[180px] w-full" />
      <p className="mt-1.5 text-[12px] text-text-subtle">Façade de l&apos;immeuble</p>
    </div>
  );
}
