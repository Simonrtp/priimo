'use client';

import { useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { useVoiceCapture } from './VoiceCaptureProvider';
import { armPointerShield } from '@/lib/ui/pointer-guard';

/** Au-delà, le toucher devient un appui long : on écrit au lieu de dicter. */
const APPUI_LONG_MS = 450;

/**
 * Le bouton central de la barre terrain : un micro.
 *
 * Un toucher → la dictée démarre, sans menu intermédiaire. Un appui long → la
 * même feuille s'ouvre au clavier, pour les agents qui préfèrent écrire. Dans
 * la feuille de dictée, un bouton « Écrire » fait aussi la bascule à tout
 * moment : personne n'est obligé de parler.
 */
export default function BoutonNoteMobile() {
  const { openCapture, openEcrire } = useVoiceCapture();
  const minuteur = useRef(0);
  const longRef = useRef(false);
  const [appuye, setAppuye] = useState(false);

  function relacher() {
    window.clearTimeout(minuteur.current);
    setAppuye(false);
  }

  return (
    <button
      type="button"
      data-tour="voice-capture"
      aria-label="Dicter une note — maintenir pour écrire"
      onPointerDown={() => {
        longRef.current = false;
        setAppuye(true);
        window.clearTimeout(minuteur.current);
        minuteur.current = window.setTimeout(() => {
          longRef.current = true;
          setAppuye(false);
          armPointerShield();
          openEcrire();
        }, APPUI_LONG_MS);
      }}
      onPointerUp={relacher}
      onPointerLeave={relacher}
      onPointerCancel={relacher}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        // L'appui long a déjà ouvert l'écriture : le relâcher ne dicte pas.
        if (longRef.current) {
          longRef.current = false;
          return;
        }
        // Dans le geste : le micro et le direct s'ouvrent sans attendre.
        openCapture();
      }}
      className={`relative flex size-16 select-none items-center justify-center rounded-full text-white transition-transform duration-200 ease-clay focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [-webkit-touch-callout:none] [touch-action:manipulation] ${
        appuye ? 'scale-[0.92]' : 'scale-100'
      }`}
      style={{
        backgroundColor: '#E8743C',
        boxShadow: '0 8px 20px rgba(232, 116, 60, 0.38)',
      }}
    >
      <Mic size={27} strokeWidth={2.2} aria-hidden />
    </button>
  );
}
