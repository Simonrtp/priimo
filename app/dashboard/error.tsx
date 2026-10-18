'use client';

import { useEffect } from 'react';
import EcranReprise from '@/components/erreurs/EcranReprise';

export default function ErreurDashboard({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ minHeight: '70vh', height: '100%', width: '100%' }}>
      <EcranReprise onRetry={reset} lien={{ href: '/dashboard', libelle: 'Retour à l’accueil' }} />
    </div>
  );
}
