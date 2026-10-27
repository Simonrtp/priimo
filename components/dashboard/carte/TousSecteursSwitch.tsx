'use client';

import Switch from '@/components/ui/Switch';

/**
 * Au-dessus de Contacts : afficher aussi les secteurs des collègues.
 * Décoché = uniquement mon secteur. Coché = toute l’agence.
 */
export default function TousSecteursSwitch({
  checked,
  onChange,
  compact = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  compact?: boolean;
}) {
  const row = compact ? 'min-h-[44px]' : 'min-h-[40px]';
  const pad = compact ? 'px-1' : 'px-2.5 py-1.5';
  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`flex ${row} w-full cursor-pointer items-center gap-3 rounded-xl ${pad} text-left transition-colors duration-fluid-subtle ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] ${
          checked ? 'bg-blue/10' : 'hover:bg-black/[0.03]'
        }`}
      >
        <Switch checked={checked} />
        <span
          className={`min-w-0 flex-1 text-[13.5px] font-medium ${
            checked ? 'text-text-strong' : 'text-text-muted'
          } ${compact ? 'text-[14.5px]' : ''}`}
        >
          Tous les secteurs
        </span>
      </button>
    </li>
  );
}
