'use client';

import { useState } from 'react';
import { Video } from 'lucide-react';
import { CALENDLY_URL } from '@/lib/calendly';
import { FOUNDER_WHATSAPP_FORMATION_HREF } from '@/lib/founder-contact';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import OnboardingShell, {
  OnboardingGhostLink,
  OnboardingPrimaryButton,
} from './OnboardingShell';

type Reponse = 'oui' | 'non' | null;

/** Formé → Suivant. Pas encore → visio Calendly ou message WhatsApp. */
export default function EtapeFormation({
  rang,
  total,
  onSuivant,
}: {
  rang: number;
  total: number;
  onSuivant: () => void;
}) {
  const [reponse, setReponse] = useState<Reponse>(null);

  return (
    <OnboardingShell
      rang={rang}
      total={total}
      titre="Vous avez déjà été formé ?"
      phrase="Si oui, on continue. Sinon, on vous forme."
      action={
        reponse === 'oui' ? (
          <OnboardingPrimaryButton onClick={onSuivant}>Suivant</OnboardingPrimaryButton>
        ) : reponse === 'non' ? (
          <OnboardingGhostLink onClick={onSuivant}>Continuer</OnboardingGhostLink>
        ) : null
      }
    >
      <div className="flex max-w-[36rem] flex-col gap-6 md:max-w-2xl">
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Avez-vous déjà été formé ?">
          <Choix actif={reponse === 'oui'} onClick={() => setReponse('oui')}>
            Oui
          </Choix>
          <Choix actif={reponse === 'non'} onClick={() => setReponse('non')}>
            Pas encore
          </Choix>
        </div>

        {reponse === 'non' ? (
          <div>
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#8A8A8A]">
              Nous contacter
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] font-semibold text-[#1A1A1A] shadow-clay-sm transition hover:border-black/[0.14]"
                >
                  <span
                    className="flex size-10 items-center justify-center rounded-full bg-[#E8743C]/[0.12] text-[#E8743C]"
                    aria-hidden
                  >
                    <Video size={18} strokeWidth={2.1} />
                  </span>
                  Prendre rendez-vous en visio
                </a>
              </li>
              <li>
                <a
                  href={FOUNDER_WHATSAPP_FORMATION_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] font-semibold text-[#1A1A1A] shadow-clay-sm transition hover:border-black/[0.14]"
                >
                  <span
                    className="flex size-10 items-center justify-center rounded-full bg-[#25D366]/[0.14] text-[#25D366]"
                    aria-hidden
                  >
                    <WhatsAppIcon size={18} />
                  </span>
                  Envoyer un message
                </a>
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    </OnboardingShell>
  );
}

function Choix({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`min-h-[52px] rounded-2xl border px-4 text-[15px] font-semibold transition ${
        actif
          ? 'border-[#E8743C] bg-[#E8743C]/[0.1] text-[#1A1A1A] shadow-clay-sm'
          : 'border-black/[0.08] bg-white text-[#3A3A3A] hover:border-black/[0.14]'
      }`}
    >
      {children}
    </button>
  );
}
