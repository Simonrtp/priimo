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
          alt="Simon Ropiot"
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">Simon Ropiot</p>
          <p className="truncate text-xs text-gray-500">Fondateur de Priimo</p>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-black/8 bg-white p-4">
      <div className="flex items-start gap-3">
        <Image
          src="/Tintin_image_2.jpg"
          alt="Simon Ropiot"
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">Simon Ropiot</p>
          <p className="mt-0.5 text-sm text-gray-600">Fondateur de Priimo</p>
          <p className="mt-2 text-xs text-gray-400">Étudiant en école d&apos;ingénieurs</p>
        </div>
      </div>
    </section>
  );
}
