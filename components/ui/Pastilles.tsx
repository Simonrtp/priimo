'use client';

import { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';

export { PASTILLE_TRACK, pastilleClass } from '@/components/ui/pastille-classes';

type Pastille<T extends string> = {
  id: T;
  label: string;
};

export default function Pastilles<T extends string>({
  value,
  options,
  onChange,
  label,
  role = 'group',
}: {
  value: T;
  options: readonly Pastille<T>[];
  onChange?: (id: T) => void;
  label: string;
  role?: 'group' | 'tablist';
}) {
  const asTabs = role === 'tablist';

  return (
    <div role={role} aria-label={label} className={PASTILLE_TRACK}>
      {options.map((opt) => {
        const actif = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role={asTabs ? 'tab' : undefined}
            aria-selected={asTabs ? actif : undefined}
            aria-pressed={asTabs ? undefined : actif}
            disabled={!onChange}
            onClick={() => onChange?.(opt.id)}
            className={pastilleClass(actif)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
