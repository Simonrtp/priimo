'use client';

import Link from 'next/link';
import {
  Building2,
  MessageCircle,
  Settings,
  Target,
  Users,
  X,
} from 'lucide-react';
import { FOUNDER_WHATSAPP_HREF } from '@/lib/founder-contact';
import { FIELD } from '@/lib/today/field';

const LINKS = [
  { href: '/dashboard/prospection', label: 'Prospection', Icon: Target },
  { href: '/dashboard/contacts', label: 'Contacts', Icon: Users },
  { href: '/dashboard/biens', label: 'Biens', Icon: Building2 },
  { href: '/dashboard/settings', label: 'Paramètres', Icon: Settings },
] as const;

export default function FieldPlusSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Plus">
      <button
        type="button"
        className="absolute inset-0 bg-[#15202F]/45"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[min(72dvh,480px)] overflow-y-auto rounded-t-[24px] bg-surface shadow-[0_-12px_40px_rgba(15,23,34,0.18)]"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <p className="font-semibold text-text-strong" style={{ fontSize: 17 }}>
            Plus
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="app-press flex size-11 items-center justify-center rounded-full text-text-muted"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <ul className="px-3 pb-2">
          {LINKS.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={onClose}
                className="app-press flex min-h-[52px] items-center gap-3 rounded-2xl px-3 text-[15.5px] font-medium text-text-strong"
              >
                <span
                  className="flex size-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: FIELD.ardoisePastel, color: FIELD.ardoise }}
                  aria-hidden
                >
                  <Icon size={18} strokeWidth={2.1} />
                </span>
                {label}
              </Link>
            </li>
          ))}
          <li>
            <a
              href={FOUNDER_WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="app-press flex min-h-[52px] items-center gap-3 rounded-2xl px-3 text-[15.5px] font-medium text-text-strong"
            >
              <span
                className="flex size-10 items-center justify-center rounded-full"
                style={{ backgroundColor: FIELD.orangePastel, color: FIELD.orange }}
                aria-hidden
              >
                <MessageCircle size={18} strokeWidth={2.1} />
              </span>
              Écrire au fondateur
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
