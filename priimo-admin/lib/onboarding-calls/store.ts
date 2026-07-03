import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

/**
 * Suivi local des appels d'onboarding (case cochée par profil).
 * Même logique que les notes admin : fichier JSON dans data/, gitignoré.
 */

export type OnboardingCallRecord = {
  profileId: string;
  completedAt: string;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const CALLS_FILE = path.join(DATA_DIR, 'admin-onboarding-calls.json');

async function readAll(): Promise<OnboardingCallRecord[]> {
  try {
    const raw = await readFile(CALLS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OnboardingCallRecord[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeAll(records: OnboardingCallRecord[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CALLS_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

/** Profils avec appel d'onboarding effectué, indexés par id. */
export async function getOnboardingCallsByProfile(): Promise<Map<string, OnboardingCallRecord>> {
  const all = await readAll();
  const map = new Map<string, OnboardingCallRecord>();
  for (const record of all) {
    map.set(record.profileId, record);
  }
  return map;
}

export async function setOnboardingCallDone(
  profileId: string,
  done: boolean,
): Promise<OnboardingCallRecord | null> {
  const all = await readAll();
  const next = all.filter((r) => r.profileId !== profileId);

  if (done) {
    const record: OnboardingCallRecord = {
      profileId,
      completedAt: new Date().toISOString(),
    };
    next.push(record);
    await writeAll(next);
    return record;
  }

  await writeAll(next);
  return null;
}
