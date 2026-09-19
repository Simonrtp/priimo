/** Mention discrète sous le champ de texte d'une note (écrite ou vocale). */
export const NOTE_MENTION_SENSIBLE =
  'Évitez les informations personnelles sensibles ; notez les faits utiles au bien et à la vente.';

export default function NoteMentionSensible() {
  return <p className="mt-1.5 text-[12px] leading-snug text-text-muted">{NOTE_MENTION_SENSIBLE}</p>;
}
