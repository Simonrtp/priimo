'use client';

import { useState } from 'react';
import AvatarChooser from '@/components/dashboard/AvatarChooser';
import OnboardingShell, { OnboardingPrimaryButton } from './OnboardingShell';

/**
 * Écran 4 — avatar. Photo (crop carré) ou icônes (/avatars/*.png).
 */
export default function EtapeAvatar({
  rang,
  total,
  initials,
  initialUrl,
  onSuivant,
}: {
  rang: number;
  total: number;
  initials: string;
  initialUrl: string | null;
  onSuivant: (avatarUrl: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);

  return (
    <OnboardingShell
      rang={rang}
      total={total}
      titre="Choisissez votre avatar."
      compact
      action={
        <OnboardingPrimaryButton disabled={uploading} onClick={() => onSuivant(selected)}>
          Continuer
        </OnboardingPrimaryButton>
      }
    >
      <AvatarChooser
        variante="grille"
        initials={initials}
        selected={selected}
        onBusy={setUploading}
        onChange={(url) => setSelected(url)}
      />
      <p className="mt-3 text-[12.5px] text-[#8A8A8A]">
        Sans choix, vos initiales restent affichées partout.
      </p>
    </OnboardingShell>
  );
}
