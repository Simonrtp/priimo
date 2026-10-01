export const PASTILLE_TRACK =
  'flex w-fit shrink-0 rounded-clay bg-surface-2 p-1 shadow-clay-inset';

export function pastilleClass(actif: boolean) {
  return `rounded-[12px] px-2.5 py-1.5 text-[12px] font-semibold transition-colors duration-fluid-subtle ${
    actif
      ? 'bg-[#1a2a56] text-white'
      : 'text-text-muted hover:text-text-strong'
  }`;
}
