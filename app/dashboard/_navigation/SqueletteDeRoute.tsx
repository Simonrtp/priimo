'use client';

import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import AccueilAmorce from '@/components/dashboard/accueil/AccueilAmorce';
import SqueletteAgence from '@/components/dashboard/directeur/SqueletteAgence';
import { WorkspaceListSkeleton } from '@/components/dashboard/today/TodaySkeletons';
import { useUser } from '@/lib/hooks/useUser';
import { resolveVueAccueilDirecteur } from '@/lib/directeur/vue';
import { vueProspection, type Emplacement } from '@/lib/navigation/cible';
import { ACCUEIL_VUE_COOKIE } from '@/lib/today/accueil-vue';
import ActionsLoading from '../actions/loading';
import EquipeLoading from '../equipe/loading';
import EstimationLoading from '../estimation/loading';
import SettingsLoading from '../settings/loading';
import OriginesLoading from '../statistiques/origines/loading';
import SqueletteProspection from '../prospection/SqueletteProspection';

function cookie(nom: string): string | null {
  const brut = document.cookie.split('; ').find((c) => c.startsWith(`${nom}=`));
  return brut ? decodeURIComponent(brut.slice(nom.length + 1)) : null;
}

/** L'Accueil d'un directeur ouvre sur L'agence, sauf s'il a choisi « Ma semaine ». */
function SqueletteAccueil() {
  const mobile = useDevice() === 'mobile';
  const { profile } = useUser();
  const vueAgence =
    profile?.role === 'directeur' &&
    resolveVueAccueilDirecteur({ cookie: cookie(ACCUEIL_VUE_COOKIE) }) === 'directeur';
  if (vueAgence) return <SqueletteAgence />;
  return <AccueilAmorce periodeDemandee={null} mobile={mobile} />;
}

/**
 * Le squelette de l'écran demandé, montré dès le clic : les mêmes cartes
 * grises que son `loading.tsx`, pour que rien ne saute quand le serveur prend
 * le relais.
 */
export default function SqueletteDeRoute({ vers }: { vers: Emplacement }) {
  const p = vers.pathname;
  if (p === '/dashboard') return <SqueletteAccueil />;
  if (vueProspection(vers)) return <SqueletteProspection />;
  if (p.startsWith('/dashboard/contacts') || p.startsWith('/dashboard/biens')) {
    return <WorkspaceListSkeleton rows={8} />;
  }
  if (p.startsWith('/dashboard/estimation')) return <EstimationLoading />;
  if (p.startsWith('/dashboard/equipe') || p.startsWith('/dashboard/parametres')) return <EquipeLoading />;
  if (p.startsWith('/dashboard/settings')) return <SettingsLoading />;
  if (p.startsWith('/dashboard/actions')) return <ActionsLoading />;
  if (p.startsWith('/dashboard/statistiques')) return <OriginesLoading />;
  return <WorkspaceListSkeleton rows={6} />;
}
