/** Piste des sélecteurs : la même partout, la plus simple. */
export const PASTILLE_TRACK =
  'inline-flex w-fit max-w-full shrink-0 items-center rounded-full bg-black/[0.04] p-1';

export function pastilleClass(actif: boolean) {
  return `rounded-full px-3 py-1 text-[13px] font-medium transition-colors duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] ${
    actif ? 'bg-[#1A2A56] text-white' : 'text-text-muted hover:text-text-strong'
  }`;
}
