'use client';

import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useInstallPrompt } from '@/lib/pwa/useInstallPrompt';

/**
 * Entrée compacte pour la barre latérale. Elle disparaît dès que l'application
 * est installée, ou tant que le navigateur ne propose pas l'installation :
 * un bouton qui n'aboutirait à rien vaut moins que pas de bouton du tout.
 */
export default function InstallAppButton() {
  const { ready, canPrompt, installed, promptInstall } = useInstallPrompt();

  if (!ready || installed || !canPrompt) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        const outcome = await promptInstall();
        if (outcome === 'accepted') toast.success('Priimo est installé');
      }}
      className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-[#7B9AC0] transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
    >
      <Download size={18} strokeWidth={2} className="flex-shrink-0" aria-hidden />
      Installer l&apos;application
    </button>
  );
}
