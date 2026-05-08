'use client';

import { useState } from 'react';

export default function ZoneSection() {
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(5);

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-[8px] p-6">
      <p className="font-semibold tracking-tight text-gray-900 mb-2" style={{ fontSize: '20px' }}>
        Ma zone de prospection
      </p>
      <p className="text-gray-700 leading-relaxed mb-6" style={{ fontSize: '14px' }}>
        Définis le secteur géographique sur lequel Priimo va générer tes prospects.
      </p>

      <div
        className="bg-gray-100 rounded-[8px] flex items-center justify-center mb-4"
        style={{ height: '240px' }}
      >
        <span className="font-medium text-gray-400" style={{ fontSize: '13px' }}>
          🗺️ Carte interactive à venir
        </span>
      </div>

      <div className="mb-4">
        <label
          className="block font-medium text-gray-700"
          style={{ fontSize: '13px', marginBottom: '6px' }}
        >
          Adresse de l&apos;agence
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Ex: 12 avenue d'Italie, 75013 Paris"
          className="w-full border border-[#E5E5E5] rounded-[6px] text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
          style={{ padding: '10px 14px', fontSize: '14px' }}
        />
      </div>

      <div className="mb-4">
        <label
          className="block font-medium text-gray-700"
          style={{ fontSize: '13px', marginBottom: '6px' }}
        >
          Rayon de prospection
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="flex-1 accent-[#2563EB]"
          />
          <span className="font-bold text-[#2563EB]" style={{ fontSize: '14px', minWidth: '48px' }}>
            {radius} km
          </span>
        </div>
      </div>

      <p className="text-gray-500 italic" style={{ fontSize: '13px' }}>
        Cette zone correspond à environ <strong>1 240 propriétaires</strong> identifiés.
      </p>
    </div>
  );
}
