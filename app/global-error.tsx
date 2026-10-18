'use client';

import { useEffect } from 'react';
import EcranReprise from '@/components/erreurs/EcranReprise';

export default function ErreurGlobale({
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
    <html lang="fr">
      <body style={{ margin: 0, minHeight: '100vh', background: '#eef1fb' }}>
        <EcranReprise
          onRetry={() => {
            reset();
            window.location.reload();
          }}
          lien={{ href: '/', libelle: 'Retour à l’accueil' }}
        />
      </body>
    </html>
  );
}
