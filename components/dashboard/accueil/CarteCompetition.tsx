'use client';

import { useState } from 'react';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import Modal from '@/components/ui/Modal';
import type { AgentPodium } from '@/lib/activite/podium';

const MARCHE = {
  1: { hauteur: 104, fond: '#F5C542', texte: '#7A5B00' },
  2: { hauteur: 76, fond: '#D5Dbe3', texte: '#3E4C5E' },
  3: { hauteur: 52, fond: '#E7C4A4', texte: '#7A4E2A' },
} as const;

export default function CarteCompetition({
  podium,
}: {
  podium: readonly AgentPodium[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const places = [podium[1], podium[0], podium[2]].filter((p): p is AgentPodium => Boolean(p));

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="col-span-2 flex h-full min-w-0 flex-col justify-center rounded-clay-lg bg-surface px-4 py-4 text-left shadow-clay-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-clay focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] lg:col-span-1"
      >
        <p className="text-[13px] font-semibold text-text-strong">Compétition</p>
        <p className="mt-1 text-[12px] text-text-muted">Le podium de la semaine</p>
      </button>
      <Modal
        open={ouvert}
        onClose={() => setOuvert(false)}
        title="Compétition"
        description="Les trois meilleurs agents de la semaine."
        maxWidth="md"
      >
        {places.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-text-muted">
            Pas encore de passage cette semaine.
          </p>
        ) : (
          <div className="flex items-end justify-center gap-4 px-2 pb-2 pt-6">
            {places.map((agent) => {
              const rang = (podium.indexOf(agent) + 1) as 1 | 2 | 3;
              const marche = MARCHE[rang];
              return (
                <div key={agent.id} className="flex w-24 flex-col items-center">
                  <ProfileAvatar
                    firstName={agent.prenom}
                    lastName={agent.nom}
                    avatarUrl={agent.avatarUrl}
                    size={rang === 1 ? 64 : 52}
                  />
                  <p className="mt-2 max-w-full truncate text-center text-[13px] font-semibold text-text-strong">
                    {agent.prenom}
                  </p>
                  <div
                    className="mt-2 flex w-full items-start justify-center rounded-t-[18px] pt-2"
                    style={{ height: marche.hauteur, backgroundColor: marche.fond, color: marche.texte }}
                  >
                    <span className="font-display text-[20px] font-bold leading-none">{rang}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}
