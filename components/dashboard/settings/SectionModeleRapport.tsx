'use client';

import { useCallback, useEffect, useState } from 'react';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { notifyError, notifySuccess } from '@/lib/notify';
import { texteEmailModele } from '@/lib/rapport/modele-defaut';

const inputClass =
  'w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';
const labelClass = 'mb-1.5 block font-medium text-gray-700';

export default function SectionModeleRapport() {
  const [emailModele, setEmailModele] = useState('');
  const [charge, setCharge] = useState(false);
  const [sauvegardeEmail, setSauvegardeEmail] = useState(false);

  const charger = useCallback(async () => {
    const res = await fetch('/api/dashboard/agence/rapport-modele');
    const data = (await res.json()) as { emailModele?: string; error?: string };
    if (!res.ok) {
      notifyError(data.error ?? 'Message indisponible');
      return;
    }
    setEmailModele(texteEmailModele(data.emailModele));
    setCharge(true);
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function enregistrerEmail() {
    setSauvegardeEmail(true);
    try {
      const res = await fetch('/api/dashboard/agence/rapport-modele', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailModele }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        notifyError(data.error ?? 'Message non enregistré');
        return;
      }
      notifySuccess('Message enregistré');
    } finally {
      setSauvegardeEmail(false);
    }
  }

  return (
    <div className="border-t border-black/[0.06] pt-5">
      <h3 className="text-[15px] font-semibold text-ink">Message d’envoi</h3>
      <p className="mt-1 text-pretty text-[13px] text-mute">
        Texte proposé à l’agent avant l’envoi de l’avis de valeur. Il reste libre de le modifier.
      </p>
      {!charge ? (
        <div className="mt-3 h-24 animate-pulse rounded-lg bg-black/[0.04]" aria-hidden />
      ) : (
        <div className="mt-3">
          <label htmlFor="rapport-email-modele" className={labelClass}>
            Message
          </label>
          <textarea
            id="rapport-email-modele"
            className={`${inputClass} min-h-[8.5rem] resize-y`}
            maxLength={4000}
            value={emailModele}
            onChange={(e) => setEmailModele(e.target.value)}
          />
          <WorkspaceButton
            type="button"
            variant="secondary"
            className="mt-2"
            disabled={sauvegardeEmail}
            onClick={() => void enregistrerEmail()}
          >
            {sauvegardeEmail ? 'Enregistrement…' : 'Enregistrer le message'}
          </WorkspaceButton>
        </div>
      )}
    </div>
  );
}
