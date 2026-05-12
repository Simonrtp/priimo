'use client';

import { Map } from 'lucide-react';

const PARIS_MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Paris, France');

export default function MapViewPlaceholder() {
  return (
    <div
      className="rounded-2xl border border-black/8 shadow-soft bg-[#F4F4F2] flex flex-col items-center justify-center text-center px-6"
      style={{ minHeight: 480 }}
    >
      <div
        className="rounded-2xl bg-white/80 border border-black/[0.06] flex items-center justify-center mb-5"
        style={{ width: 72, height: 72 }}
      >
        <Map className="text-accent" size={40} strokeWidth={1.5} aria-hidden />
      </div>
      <p className="font-semibold text-ink mb-1" style={{ fontSize: 16, letterSpacing: '-0.02em' }}>
        Vue carte interactive
      </p>
      <p className="text-mute max-w-md mb-6" style={{ fontSize: 13, lineHeight: 1.55 }}>
        Bientôt disponible — pour l’instant :
      </p>
      <a
        href={PARIS_MAPS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary inline-flex items-center justify-center"
        style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
      >
        Ouvrir dans Google Maps
      </a>
    </div>
  );
}
