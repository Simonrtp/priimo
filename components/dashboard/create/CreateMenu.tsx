'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Users, type LucideIcon } from 'lucide-react';
import type { Bien } from '@/types/bien';
import type { Contact } from '@/types/contact';
import { notifySuccess } from '@/lib/notify';
import { useOutsideDismiss } from '@/lib/hooks/useOutsideDismiss';
import { useUser } from '@/lib/hooks/useUser';
import ContactFormDialog from '@/components/dashboard/contacts/ContactFormDialog';
import BienFormDialog from '@/components/dashboard/biens/BienFormDialog';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';

type CreateKind = 'contact' | 'bien';

const CREATE_ITEMS: { value: CreateKind; label: string; Icon: LucideIcon }[] = [
  { value: 'contact', label: 'Nouveau contact', Icon: Users },
  { value: 'bien', label: 'Nouveau bien', Icon: Building2 },
];

export default function CreateMenu({
  className = '',
  compact = false,
}: {
  className?: string;
  /** Icône seule (barre mobile). */
  compact?: boolean;
}) {
  const router = useRouter();
  const { profile } = useUser();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CreateKind | null>(null);
  const [members, setMembers] = useState<AssigneeOption[]>([
    { id: profile.id, fullName: `${profile.first_name} ${profile.last_name}`.trim() || 'Moi' },
  ]);
  const [vendeurs, setVendeurs] = useState<Contact[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useOutsideDismiss(open, close, rootRef);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open && !kind) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/dashboard/create-context');
        if (!res.ok) return;
        const data = (await res.json()) as {
          members?: AssigneeOption[];
          vendeurs?: Contact[];
        };
        if (cancelled) return;
        if (data.members && data.members.length > 0) setMembers(data.members);
        if (data.vendeurs) setVendeurs(data.vendeurs);
      } catch {
        /* contexte optionnel */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, kind]);

  function pick(next: CreateKind) {
    setOpen(false);
    setKind(next);
  }

  return (
    <>
      <div ref={rootRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={open ? menuId : undefined}
          aria-label="Nouveau"
          className={
            compact
              ? 'flex size-11 items-center justify-center rounded-full bg-accent text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
              : 'inline-flex min-h-11 items-center gap-1.5 rounded-clay bg-accent px-3.5 text-[13.5px] font-semibold text-white hover:bg-accent-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:min-h-9 md:px-3 md:text-[13px]'
          }
        >
          <Plus size={compact ? 22 : 16} strokeWidth={2.2} aria-hidden />
          {compact ? null : 'Nouveau'}
        </button>
        {open ? (
          <div
            id={menuId}
            role="menu"
            aria-label="Créer"
            className="absolute right-0 top-[calc(100%+6px)] z-[40] w-max min-w-[13.5rem] overflow-hidden rounded-clay border border-black/[0.08] bg-surface pt-1 pb-2.5 shadow-clay-lg"
          >
            {CREATE_ITEMS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                role="menuitem"
                onClick={() => pick(value)}
                className="flex min-h-11 w-full items-center gap-2.5 whitespace-nowrap px-3.5 text-left text-[13.5px] font-medium text-text hover:bg-black/[0.04]"
              >
                <Icon size={16} strokeWidth={2} className="flex-shrink-0 text-text-muted" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {kind === 'contact' ? (
        <ContactFormDialog
          open
          onClose={() => setKind(null)}
          members={members}
          currentUserId={profile.id}
          skipSuccessToast
          onSaved={(contact) => {
            notifySuccess('Contact créé', {
              duration: 6000,
              action: {
                label: 'Ouvrir',
                onClick: () => router.push(`/dashboard/contacts?fiche=${contact.id}`),
              },
            });
          }}
          onOpenExisting={(contact) => {
            setKind(null);
            router.push(`/dashboard/contacts?fiche=${contact.id}`);
          }}
        />
      ) : null}

      {kind === 'bien' ? (
        <BienFormDialog
          open
          onClose={() => setKind(null)}
          vendeurs={vendeurs}
          skipSuccessToast
          onSaved={(bien: Bien) => {
            notifySuccess('Bien ajouté', {
              duration: 6000,
              action: {
                label: 'Ouvrir',
                onClick: () => router.push(`/dashboard/biens?fiche=${bien.id}`),
              },
            });
          }}
        />
      ) : null}
    </>
  );
}
