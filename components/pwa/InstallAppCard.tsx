'use client';

import { Check, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useInstallPrompt } from '@/lib/pwa/useInstallPrompt';

/**
 * Carte des paramètres. Contrairement au raccourci de la barre latérale, elle
 * reste visible même quand le navigateur ne sait pas installer l'application :
 * Safari et Firefox n'implémentent pas `beforeinstallprompt`, et l'utilisateur
 * doit alors passer par le menu. Mieux vaut l'expliquer que ne rien afficher.
 */
export default function InstallAppCard() {
  const { ready, canPrompt, installed, promptInstall } = useInstallPrompt();

  if (!ready) return null;

  return (
    <section className="mb-6 rounded-2xl border border-black/8 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold text-ink" style={{ letterSpacing: '-0.01em' }}>
            Installer Priimo sur cet appareil
          </h2>
          <p className="mt-1.5 max-w-prose text-pretty text-[14px] leading-relaxed text-mute">
            {installed
              ? 'Priimo est installé sur cet appareil : vous le lancez depuis votre écran d’accueil, sans passer par le navigateur.'
              : 'Priimo s’ouvre alors dans sa propre fenêtre, avec son icône sur votre bureau ou votre écran d’accueil. Vos données restent les mêmes.'}
          </p>

          {!installed && !canPrompt ? (
            <p className="mt-3 text-[13px] leading-relaxed text-text-subtle">
              Votre navigateur ne propose pas l’installation automatique. Sur iPhone et iPad,
              ouvrez le menu Partager de Safari puis « Sur l’écran d’accueil ». Sur ordinateur,
              cherchez l’icône d’installation à droite de la barre d’adresse.
            </p>
          ) : null}
        </div>

        {installed ? (
          <span className="inline-flex min-h-[40px] flex-shrink-0 items-center gap-2 rounded-clay bg-soft-warm px-4 text-[13.5px] font-semibold text-accent-dark">
            <Check size={16} strokeWidth={2.4} aria-hidden />
            Installée
          </span>
        ) : (
          <button
            type="button"
            disabled={!canPrompt}
            onClick={async () => {
              const outcome = await promptInstall();
              if (outcome === 'accepted') toast.success('Priimo est installé');
            }}
            className="inline-flex min-h-[40px] flex-shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-clay bg-accent px-4 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-accent-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
          >
            <Download size={16} strokeWidth={2} aria-hidden />
            Installer l&apos;application
          </button>
        )}
      </div>
    </section>
  );
}
