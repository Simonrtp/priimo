import { getDevice } from '@/lib/device-server';
import AccueilAmorce from '@/components/dashboard/accueil/AccueilAmorce';

export default async function TodayLoading() {
  const device = await getDevice();
  return <AccueilAmorce periodeDemandee={null} mobile={device === 'mobile'} />;
}
