'use server';

import {
  invaliderAccueilEtProspection,
  invaliderContacts,
  invaliderEstimation,
} from '@/lib/cache/dashboard';

export async function invaliderNavigationApresLead(): Promise<void> {
  invaliderAccueilEtProspection();
}

export async function invaliderNavigationApresNote(): Promise<void> {
  invaliderAccueilEtProspection();
  invaliderContacts();
}

export async function invaliderNavigationApresEstimation(): Promise<void> {
  invaliderEstimation();
  invaliderAccueilEtProspection();
}
