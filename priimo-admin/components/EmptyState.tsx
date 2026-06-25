import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/[0.06]">
        <Icon className="h-5 w-5 text-white/40" />
      </span>
      <div>
        <p className="text-sm font-medium text-white/70">{title}</p>
        {description ? <p className="mt-1 text-xs text-white/40">{description}</p> : null}
      </div>
    </div>
  );
}
