import { getDevice } from '@/lib/device-server';

export default async function ProspectionLoading() {
  const mobile = (await getDevice()) === 'mobile';

  return (
    <div
      data-prospection-carte
      aria-busy="true"
      className={
        mobile
          ? 'field-map relative h-full min-h-0 w-full overflow-hidden'
          : 'relative flex min-h-0 w-full min-w-0 flex-1 flex-col'
      }
    >
      <span className="sr-only">Chargement de la prospection</span>
      <div
        className={`flex min-h-0 flex-1 gap-3 ${mobile ? 'p-3' : ''}`}
        style={{ height: mobile ? '100%' : undefined }}
      >
        <div className="squelette min-h-0 flex-1 rounded-[28px]" />
        {mobile ? null : <div className="squelette hidden w-72 shrink-0 rounded-[28px] md:block" />}
      </div>
    </div>
  );
}
