import { cookies } from 'next/headers';
import { getDevice } from '@/lib/device-server';
import { getServerUser } from '@/lib/auth/getServerUser';
import AccueilAmorce from '@/components/dashboard/accueil/AccueilAmorce';
import SqueletteAgence from '@/components/dashboard/directeur/SqueletteAgence';
import { ACCUEIL_VUE_COOKIE } from '@/lib/today/accueil-vue';
import { resolveVueAccueilDirecteur } from '@/lib/directeur/vue';

export default async function TodayLoading() {
  const device = await getDevice();
  const cookieStore = await cookies();
  const { profile } = await getServerUser();
  const vueAgence =
    profile?.role === 'directeur' &&
    resolveVueAccueilDirecteur({
      cookie: cookieStore.get(ACCUEIL_VUE_COOKIE)?.value,
    }) === 'directeur';

  if (vueAgence) return <SqueletteAgence />;

  return <AccueilAmorce periodeDemandee={null} mobile={device === 'mobile'} />;
}
