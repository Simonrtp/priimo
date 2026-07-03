'use server';

import { revalidatePath } from 'next/cache';
import {
  setOnboardingCallDone,
  type OnboardingCallRecord,
} from '@/lib/onboarding-calls/store';

export type ToggleOnboardingCallResult =
  | { ok: true; record: OnboardingCallRecord | null }
  | { ok: false; error: string };

export async function toggleOnboardingCall(
  profileId: string,
  done: boolean,
): Promise<ToggleOnboardingCallResult> {
  if (!profileId.trim()) {
    return { ok: false, error: 'Profil invalide.' };
  }

  try {
    const record = await setOnboardingCallDone(profileId, done);
    revalidatePath('/utilisateurs');
    return { ok: true, record };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur lors de l\u2019enregistrement.',
    };
  }
}
