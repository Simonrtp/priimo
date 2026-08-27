'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Building2, Mic, NotebookPen, Plus, Users, X, type LucideIcon } from 'lucide-react';
import type { Bien } from '@/types/bien';
import type { Contact } from '@/types/contact';
import { notifySuccess } from '@/lib/notify';
import { useUser } from '@/lib/hooks/useUser';
import { armPointerShield } from '@/lib/ui/pointer-guard';
import ContactFormDialog from '@/components/dashboard/contacts/ContactFormDialog';
import BienFormDialog from '@/components/dashboard/biens/BienFormDialog';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { FIELD } from '@/lib/today/field';

type CreateKind = 'contact' | 'bien';
type MenuAction = CreateKind | 'note-write' | 'note-voice';

const CREATE_ITEMS: { value: MenuAction; label: string; hint: string; Icon: LucideIcon }[] = [
  { value: 'contact', label: 'Nouveau contact', hint: 'Fiche client', Icon: Users },
  { value: 'bien', label: 'Nouveau bien', hint: 'Mandat / annonce', Icon: Building2 },
  { value: 'note-write', label: 'Écrire une note', hint: 'Au clavier', Icon: NotebookPen },
  { value: 'note-voice', label: 'Dicter une note', hint: 'À la voix', Icon: Mic },
];

export default function CreateMenu({
  className = '',
  compact = false,
}: {
  className?: string;
  /** Icône seule + feuille (terrain mobile). */
  compact?: boolean;
}) {
  const router = useRouter();
  const { profile } = useUser();
  const { openCapture, openCompose } = useVoiceCapture();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CreateKind | null>(null);
  const [members, setMembers] = useState<AssigneeOption[]>([
    { id: profile.id, fullName: `${profile.first_name} ${profile.last_name}`.trim() || 'Moi' },
  ]);
  const [vendeurs, setVendeurs] = useState<Contact[]>([]);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open || compact) return;
    function onPointer(e: PointerEvent) {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (menuPanelRef.current?.contains(target)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      close();
      armPointerShield();
    }
    document.addEventListener('pointerdown', onPointer, true);
    return () => document.removeEventListener('pointerdown', onPointer, true);
  }, [open, compact, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open || compact) {
      setMenuPos(null);
      return;
    }
    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuPos({
        top: r.bottom + 6,
        right: Math.max(8, window.innerWidth - r.right),
      });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, compact]);

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

  function pick(action: MenuAction) {
    setOpen(false);
    if (action === 'note-write') {
      armPointerShield();
      openCompose();
      return;
    }
    if (action === 'note-voice') {
      armPointerShield();
      openCapture();
      return;
    }
    setKind(action);
  }

  const menuItems = CREATE_ITEMS.map(({ value, label, hint, Icon }) => (
    <button
      key={value}
      type="button"
      role="menuitem"
      onClick={() => pick(value)}
      className={
        compact
          ? 'app-press flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 text-left'
          : 'flex min-h-10 w-full items-center gap-2.5 whitespace-nowrap px-3.5 text-left text-[13.5px] font-medium text-text hover:bg-black/[0.04]'
      }
    >
      {compact ? (
        <>
          <span
            className="flex size-10 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: FIELD.ardoisePastel, color: FIELD.ardoise }}
            aria-hidden
          >
            <Icon size={18} strokeWidth={2.1} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15.5px] font-medium text-text-strong">{label}</span>
            <span className="block text-[12.5px] text-text-muted">{hint}</span>
          </span>
        </>
      ) : (
        <>
          <Icon size={16} strokeWidth={2} className="flex-shrink-0 text-text-muted" aria-hidden />
          {label}
        </>
      )}
    </button>
  ));

  const sheet =
    open && compact && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[120]" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-[#15202F]/45"
              aria-label="Fermer"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                close();
                armPointerShield();
              }}
            />
            <div
              id={menuId}
              role="menu"
              aria-label="Créer"
              className="absolute inset-x-0 bottom-0 rounded-t-[24px] bg-surface shadow-[0_-12px_40px_rgba(15,23,34,0.18)]"
              style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pb-1 pt-4">
                <p className="font-semibold text-text-strong" style={{ fontSize: 17 }}>
                  Créer
                </p>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    armPointerShield();
                  }}
                  aria-label="Fermer"
                  className="app-press flex size-11 items-center justify-center rounded-full text-text-muted"
                >
                  <X size={20} strokeWidth={2} aria-hidden />
                </button>
              </div>
              <div className="px-3 pb-2">{menuItems}</div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const desktopMenu =
    open && !compact && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuPanelRef}
            id={menuId}
            role="menu"
            aria-label="Créer"
            className="fixed z-[120] w-max min-w-[13.5rem] overflow-hidden rounded-clay border border-black/[0.08] bg-surface py-1.5 shadow-clay-lg"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {menuItems}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={rootRef} className={`relative ${className}`}>
        <button
          ref={triggerRef}
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
        {sheet}
        {desktopMenu}
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
