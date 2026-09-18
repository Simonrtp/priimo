'use client';

import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import type { PortraitCollaborateur } from '@/types/contact';

export default function CollaborateurNom({
  portrait,
  nom,
  size = 22,
  className = '',
}: {
  portrait: PortraitCollaborateur;
  nom?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <ProfileAvatar
        firstName={portrait.firstName}
        lastName={portrait.lastName}
        avatarUrl={portrait.avatarUrl}
        size={size}
        className="shrink-0"
      />
      <span className="min-w-0 truncate">{nom ?? portrait.fullName}</span>
    </span>
  );
}
