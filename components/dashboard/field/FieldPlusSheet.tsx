'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  MessageCircle,
  Mic,
  NotebookPen,
  Settings,
  Target,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { FOUNDER_WHATSAPP_HREF } from '@/lib/founder-contact';
import { FIELD } from '@/lib/today/field';
import { notifySuccess } from '@/lib/notify';
import { armPointerShield } from '@/lib/ui/pointer-guard';
import { useUser } from '@/lib/hooks/useUser';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import ContactFormDialog from '@/components/dashboard/contacts/ContactFormDialog';
import BienFormDialog from '@/components/dashboard/biens/BienFormDialog';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import type { Bien } from '@/types/bien';
import type { Contact } from '@/types/contact';

const LINKS = [
  { href: '/dashboard/prospection', label: 'Prospection', Icon: Target },
  { href: '/dashboard/contacts', label: 'Contacts', Icon: Users },
  { href: '/dashboard/biens', label: 'Biens', Icon: Building2 },
  { href: '/dashboard/settings', label: 'Paramètres', Icon: Settings },
] as const;

type CreateKind = 'contact' | 'bien';

export default function FieldPlusSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { profile } = useUser();
  const { openCapture, openCompose } = useVoiceCapture();
  const [kind, setKind] = useState<CreateKind | null>(null);
  const [members, setMembers] = useState<AssigneeOption[]>([
    { id: profile.id, fullName: `${profile.first_name} ${profile.last_name}`.trim() || 'Moi' },
  ]);
  const [vendeurs, setVendeurs] = useState<Contact[]>([]);

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
        /* optionnel */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, kind]);

  function startCreate(next: CreateKind) {
    onClose();
    setKind(next);
  }

  function startNoteWrite() {
    onClose();
    armPointerShield();
    openCompose();
  }

  function startNoteVoice() {
    onClose();
    armPointerShield();
    openCapture();
  }

  const creates: { label: string; hint: string; Icon: LucideIcon; onClick: () => void }[] = [
    { label: 'Nouveau contact', hint: 'Fiche client', Icon: Users, onClick: () => startCreate('contact') },
    { label: 'Nouveau bien', hint: 'Mandat / annonce', Icon: Building2, onClick: () => startCreate('bien') },
    { label: 'Écrire une note', hint: 'Au clavier', Icon: NotebookPen, onClick: startNoteWrite },
    { label: 'Dicter une note', hint: 'À la voix', Icon: Mic, onClick: startNoteVoice },
  ];

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Plus">
          <button
            type="button"
            className="absolute inset-0 bg-[#15202F]/45"
            aria-label="Fermer"
            onClick={onClose}
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[min(88dvh,640px)] overflow-y-auto rounded-t-[24px] bg-surface shadow-[0_-12px_40px_rgba(15,23,34,0.18)]"
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

            <p className="px-5 pb-1 text-[12.5px] font-semibold uppercase tracking-wide text-text-muted">
              Créer
            </p>
            <ul className="px-3 pb-3">
              {creates.map(({ label, hint, Icon, onClick }) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={onClick}
                    className="app-press flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 text-left"
                  >
                    <span
                      className="flex size-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: FIELD.orangePastel, color: FIELD.orange }}
                      aria-hidden
                    >
                      <Icon size={18} strokeWidth={2.1} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15.5px] font-medium text-text-strong">{label}</span>
                      <span className="block text-[12.5px] text-text-muted">{hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <p className="px-5 pb-1 text-[12.5px] font-semibold uppercase tracking-wide text-text-muted">
              Aller à
            </p>
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
      ) : null}

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
