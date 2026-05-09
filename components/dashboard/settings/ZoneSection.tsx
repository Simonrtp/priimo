'use client';

import { useState } from 'react';

export default function ZoneSection() {
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(5);

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-black/8 p-7">
      <p className="font-bold text-ink tracking-tight mb-1" style={{ fontSize: 17, letterSpacing: '-0.02em' }}>
        Ma zone de prospection
      </p>
      <p className="text-mute mb-6" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
        Définis le secteur géographique sur lequel Priimo va générer tes prospects.
      </p>

      {/* Map placeholder */}
      <div
        className="rounded-2xl bg-soft-gray flex items-center justify-center mb-5"
        style={{ height: 220 }}
      >
        <span className="text-mute" style={{ fontSize: 13 }}>🗺️ Carte interactive à venir</span>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-mute font-medium mb-1.5" style={{ fontSize: 11, letterSpacing: '0.02em' }}>
            Adresse de l&apos;agence
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ex: 14 avenue d'Italie, 75013 Paris"
            className="w-full border border-black/8 rounded-xl px-4 py-2.5 text-ink focus:outline-none focus:border-accent/40 placeholder-mute/50"
            style={{ fontSize: 13.5 }}
          />
        </div>

        <div>
          <label className="block text-mute font-medium mb-2" style={{ fontSize: 11, letterSpacing: '0.02em' }}>
            Rayon de prospection
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={1} max={10} step={1}
              value={radius}
              onChange={(e) => setRadius(+e.target.value)}
              className="flex-1 accent-accent"
            />
            <span className="font-bold tabular text-accent-dark" style={{ fontSize: 13, minWidth: 42 }}>
              {radius} km
            </span>
          </div>
        </div>
      </div>

      <p className="text-mute italic mt-4" style={{ fontSize: 12 }}>
        Cette zone correspond à environ <strong className="font-semibold not-italic">1 240 propriétaires</strong> identifiés.
      </p>
    </div>
  );
}
