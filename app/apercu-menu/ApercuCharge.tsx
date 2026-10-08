'use client';

// TEMPORAIRE — aperçu du menu « Nouveau ». À supprimer.
import dynamic from 'next/dynamic';

const ApercuMenu = dynamic(() => import('./ApercuMenu'), { ssr: false });

export default function ApercuCharge() {
  return <ApercuMenu />;
}
