import { Clock } from 'lucide-react';
import {
  formatDetentionPrimary,
  formatDetentionSecondary,
} from '@/lib/lead-display';

interface DetentionLabelProps {
  acquiredYear: number | null;
  variant?: 'inline' | 'stacked';
  className?: string;
}

export default function DetentionLabel({
  acquiredYear,
  variant = 'stacked',
  className = '',
}: DetentionLabelProps) {
  const primary = formatDetentionPrimary(acquiredYear);
  const secondary = formatDetentionSecondary(acquiredYear);
  if (!primary) return null;

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1 text-mute ${className}`} style={{ fontSize: 12 }}>
        <Clock size={13} className="flex-shrink-0 opacity-70" strokeWidth={2} aria-hidden />
        <span>{primary}</span>
        {secondary && <span className="opacity-60">· {secondary}</span>}
      </span>
    );
  }

  return (
    <div className={`flex items-start gap-1.5 ${className}`}>
      <Clock size={14} className="mt-0.5 flex-shrink-0 text-mute" strokeWidth={2} aria-hidden />
      <span className="min-w-0">
        <span className="block font-medium text-ink" style={{ fontSize: 12.5 }}>
          {primary}
        </span>
        {secondary && (
          <span className="mt-0.5 block text-mute" style={{ fontSize: 11 }}>
            {secondary}
          </span>
        )}
      </span>
    </div>
  );
}
