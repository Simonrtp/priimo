import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  Clock,
  Download,
  FileText,
  Flame,
  Hammer,
  LayoutGrid,
  List,
  Lock,
  Mail,
  Map,
  MapPin,
  Pause,
  Phone,
  ShieldCheck,
  Star,
  TrendingUp,
  User,
  UserX,
  X,
  Zap,
} from 'lucide-react';
import type { SignalType } from '@/types/lead';

export const ICONS = {
  building: Building2,
  user: User,
  alertTriangle: AlertTriangle,
  flame: Flame,
  fileText: FileText,
  zap: Zap,
  trendingUp: TrendingUp,
  hammer: Hammer,
  download: Download,
  map: Map,
  list: List,
  phone: Phone,
  mail: Mail,
  lock: Lock,
  check: Check,
  x: X,
  pause: Pause,
  arrowRight: ArrowRight,
  layoutGrid: LayoutGrid,
  mapPin: MapPin,
  shieldCheck: ShieldCheck,
  star: Star,
  clock: Clock,
  userX: UserX,
} as const;

export const ICON_SIZE = {
  sm: 16,
  md: 18,
  lg: 24,
} as const;

export const ICON_COLORS = {
  neutral: '#4B5563',
  primary: '#E97B3D',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  red600: '#DC2626',
  orange500: '#F97316',
  green600: '#059669',
  muted500: '#6B7280',
} as const;

export function signalIconForType(sig: SignalType): { Icon: LucideIcon; color: string } {
  switch (sig) {
    case 'dissolution_sci':
      return { Icon: AlertTriangle, color: ICON_COLORS.primary };
    case 'liquidation':
      return { Icon: Flame, color: ICON_COLORS.red600 };
    case 'cession_parts':
      return { Icon: FileText, color: ICON_COLORS.info };
    case 'changement_gerant':
      return { Icon: User, color: ICON_COLORS.neutral };
    case 'deces_associe':
      return { Icon: UserX, color: ICON_COLORS.neutral };
    case 'dpe_recent':
      return { Icon: Zap, color: ICON_COLORS.warning };
    case 'dpe_passoire':
      return { Icon: AlertTriangle, color: ICON_COLORS.warning };
    case 'detention_longue':
      return { Icon: Clock, color: ICON_COLORS.muted500 };
    case 'plus_value':
      return { Icon: TrendingUp, color: ICON_COLORS.green600 };
    case 'travaux_recents':
      return { Icon: Hammer, color: ICON_COLORS.orange500 };
    case 'zone_rotation':
      return { Icon: MapPin, color: ICON_COLORS.info };
  }
}
