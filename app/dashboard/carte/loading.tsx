import { getDevice } from '@/lib/device-server';

export default async function CarteLoading() {
  const device = await getDevice();
  if (device === 'mobile') {
    return <div className="h-dvh animate-pulse bg-black/[0.05]" aria-hidden />;
  }

  return (
    <div className="h-[calc(100dvh-8rem)] animate-pulse rounded-clay bg-black/[0.05] md:-m-6 md:h-[calc(100dvh-5rem)] lg:-m-8" />
  );
}
