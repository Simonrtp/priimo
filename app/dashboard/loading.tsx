import { getDevice } from '@/lib/device-server';
import {
  TodayDesktopSkeleton,
  TodayMobileSkeleton,
} from '@/components/dashboard/today/TodaySkeletons';

export default async function TodayLoading() {
  const device = await getDevice();
  return device === 'mobile' ? <TodayMobileSkeleton /> : <TodayDesktopSkeleton />;
}
