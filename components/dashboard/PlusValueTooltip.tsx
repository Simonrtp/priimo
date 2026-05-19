'use client';

import InfoTooltip from '@/components/ui/InfoTooltip';

const PLUS_VALUE_TOOLTIP_TEXT =
  'Estimation basée sur le prix médian au m² des ventes récentes (<3 ans) dans ce code postal. Donne une idée du gain potentiel si le bien était vendu aujourd’hui.';

/** Infobulle Plus-value — à droite du ?, dans la zone libre du panneau (max 280px). */
export default function PlusValueTooltip() {
  return <InfoTooltip content={PLUS_VALUE_TOOLTIP_TEXT} placement="right" />;
}
