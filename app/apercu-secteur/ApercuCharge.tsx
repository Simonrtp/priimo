'use client';

// TEMPORAIRE — aperçu visuel des secteurs. À supprimer.
import dynamic from 'next/dynamic';

const ApercuSecteur = dynamic(() => import('./ApercuSecteur'), { ssr: false });

export default function ApercuCharge({ etat }: { etat: string }) {
  return <ApercuSecteur etat={etat} />;
}
