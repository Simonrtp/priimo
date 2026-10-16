import { House, NotebookPen, UserRound } from 'lucide-react';
import type { MapPointKind } from '@/lib/carte/points';

/** Icône du marqueur : maison pour un bien, personne pour un contact, calepin pour une note. */
export default function PinIcone({
  kind,
  size = 14,
}: {
  kind: MapPointKind;
  size?: number;
}) {
  const props = { size, strokeWidth: 2.25, 'aria-hidden': true as const };
  if (kind === 'bien') return <House {...props} />;
  if (kind === 'note') return <NotebookPen {...props} />;
  if (kind === 'contact') return <UserRound {...props} />;
  return null;
}
