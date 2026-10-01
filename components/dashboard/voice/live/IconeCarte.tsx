import {
  CalendarClock,
  CheckSquare,
  Footprints,
  HelpCircle,
  Home,
  Mail,
  MapPin,
  Phone,
  Search,
  Target,
  TrendingDown,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { CarteKind } from '@/lib/voice/cartes';

const ICONES: Record<CarteKind, LucideIcon> = {
  personne: UserRound,
  rappel: Phone,
  tache: CheckSquare,
  rdv: CalendarClock,
  visite: Footprints,
  lieu: MapPin,
  bien: Home,
  mise_a_jour: TrendingDown,
  recherche: Search,
  prospect: Target,
  email: Mail,
  question: HelpCircle,
};

/** Icône sobre sur fond teinté clair : jamais de pastille en dégradé. */
export default function IconeCarte({ kind, size = 32 }: { kind: CarteKind; size?: number }) {
  const Icone = ICONES[kind];
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icone size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  );
}
