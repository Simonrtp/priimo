/** Date relative courte pour les cartes de notes. */

export function formatNoteWhen(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const minutes = Math.floor((now - t) / 60_000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  const weeks = Math.round(days / 7);
  if (weeks <= 1) return 'Il y a une semaine';
  if (days < 45) return `Il y a ${weeks} semaines`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'Il y a un mois' : `Il y a ${months} mois`;
}
