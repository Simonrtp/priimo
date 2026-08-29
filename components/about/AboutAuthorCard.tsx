import Image from 'next/image';

type AboutAuthorCardProps = {
  compact?: boolean;
};

export default function AboutAuthorCard({ compact = false }: AboutAuthorCardProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-black/8 bg-white px-3 py-2.5 lg:hidden">
        <Image
          src="/Tintin_image_2.jpg"
          alt="Priimo"
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">L&apos;équipe Priimo</p>
          <p className="truncate text-xs text-gray-500">Par des agents, pour des agents</p>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-black/8 bg-white p-4">
      <div className="flex items-start gap-3">
        <Image
          src="/Tintin_image_2.jpg"
          alt="Priimo"
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">L&apos;équipe Priimo</p>
          <p className="mt-0.5 text-sm text-gray-600">Par des agents immobiliers, pour des agents</p>
        </div>
      </div>
    </section>
  );
}
