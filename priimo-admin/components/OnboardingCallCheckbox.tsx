'use client';

import { useState, useTransition } from 'react';
import { toggleOnboardingCall } from '@/lib/actions/onboarding-calls';
import { formatDate } from '@/lib/utils/format';

export function OnboardingCallCheckbox({
  profileId,
  profileName,
  initialDone,
  completedAt,
}: {
  profileId: string;
  profileName: string;
  initialDone: boolean;
  completedAt: string | null;
}) {
  const [done, setDone] = useState(initialDone);
  const [doneAt, setDoneAt] = useState(completedAt);
  const [pending, startTransition] = useTransition();

  return (
    <label
      className={`inline-flex cursor-pointer items-center justify-center rounded-lg border px-2 py-1.5 transition ${
        done
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : 'border-white/10 bg-white/[0.03] hover:border-indigo-500/40'
      } ${pending ? 'opacity-60' : ''}`}
      title={
        done && doneAt
          ? `Appel effectué le ${formatDate(doneAt)}`
          : `Marquer l'appel d'onboarding pour ${profileName}`
      }
    >
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setDone(next);
          if (!next) setDoneAt(null);

          startTransition(async () => {
            const res = await toggleOnboardingCall(profileId, next);
            if (!res.ok) {
              setDone(!next);
              if (next) setDoneAt(completedAt);
              alert(res.error);
              return;
            }
            setDoneAt(res.record?.completedAt ?? null);
          });
        }}
        className="h-4 w-4 rounded border-white/20 bg-white/[0.05] text-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:ring-offset-0"
        aria-label={`Appel d'onboarding effectué pour ${profileName}`}
      />
    </label>
  );
}
