import type { DisplayItem, EvenementsVieDisplayFamily } from '@/lib/display-signals';

export const EVENEMENTS_VIE_SECTION_TITLE = 'Profil de transmission';

export const EVENEMENTS_VIE_SECTION_TOOLTIP =
  'Déduit des caractéristiques du bien (âge, absence de rénovation et de travaux), pas d\u2019un événement confirmé.';

export const EVENEMENTS_VIE_SECTION_INTRO =
  'Ce profil — grand bien ancien jamais rénové — correspond souvent à une succession ou une transmission familiale.';

/** Reformulations prudente des libellés pipeline → affichage agent. */
const LABEL_REFORMULATIONS: Record<string, string> = {
  'Grand appartement ancien (période avant 1948)':
    'Grand appartement ancien (avant 1948) — souvent un bien de famille',
  'Bien ancien jamais rénové (menuiseries d\u2019origine)':
    'Jamais rénové (menuiseries d\u2019origine) — typique d\u2019un bien détenu de longue date',
  'Aucun chantier déclaré sur l\u2019adresse':
    'Aucun chantier déclaré — fréquent sur les biens de succession',
  'Lot resté dans la même main pendant que l\u2019immeuble a tourné':
    'Lot resté dans la même main — fréquent sur les biens de transmission',
};

export function reformulateEvenementsVieItem(item: DisplayItem): DisplayItem {
  const mapped = LABEL_REFORMULATIONS[item.label];
  if (!mapped) return item;
  return { ...item, label: mapped };
}

export function reformulateEvenementsVieFamily(
  family: EvenementsVieDisplayFamily,
): EvenementsVieDisplayFamily {
  return {
    ...family,
    label: EVENEMENTS_VIE_SECTION_TITLE,
    tooltip: EVENEMENTS_VIE_SECTION_TOOLTIP,
    items: family.items.map(reformulateEvenementsVieItem),
  };
}
