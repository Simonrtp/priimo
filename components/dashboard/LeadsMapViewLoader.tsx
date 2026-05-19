'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const LeadsMapView = dynamic(() => import('./LeadsMapView'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-2xl border border-black/8 bg-[#F4F4F2] shadow-soft"
      style={{ minHeight: 480 }}
    >
      <p className="text-sm font-medium text-mute">Chargement de la carte…</p>
    </div>
  ),
});

export type LeadsMapViewLoaderProps = ComponentProps<typeof LeadsMapView>;

export default function LeadsMapViewLoader(props: LeadsMapViewLoaderProps) {
  return <LeadsMapView {...props} />;
}
