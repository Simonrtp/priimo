'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic, NotebookPen, Plus, X } from 'lucide-react';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { useOutsideDismiss } from '@/lib/hooks/useOutsideDismiss';
import { armPointerShield } from '@/lib/ui/pointer-guard';

type Variant = 'sidebar' | 'fab' | 'toolbar';

export default function NoteCreateChooser({
  variant,
  collapsed = false,
  adresse,
  className = '',
}: {
  variant: Variant;
  collapsed?: boolean;
  adresse?: string;
  className?: string;
}) {
  const { openCapture, openCompose, gestureActive } = useVoiceCapture();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useOutsideDismiss(open && variant !== 'fab', close, rootRef);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function pickWrite() {
    setOpen(false);
    armPointerShield();
    openCompose({ adresse });
  }

  function pickVoice() {
    setOpen(false);
    armPointerShield();
    openCapture({ adresse });
  }

  const opts = (
    <>
      <ChoiceButton
        variant={variant}
        collapsed={collapsed}
        icon={NotebookPen}
        label="Écrire"
        hint="Au clavier"
        onClick={pickWrite}
      />
      <ChoiceButton
        variant={variant}
        collapsed={collapsed}
        icon={Mic}
        label="Dicter"
        hint="À la voix"
        onClick={pickVoice}
      />
    </>
  );

  if (variant === 'fab') {
    const menu =
      open && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[120]" role="presentation">
              <button
                type="button"
                className="absolute inset-0 bg-[#1E3148]/35"
                aria-label="Fermer le menu de note"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  armPointerShield();
                }}
              />
              <div
                id={menuId}
                role="menu"
                aria-label="Créer une note"
                className="absolute left-1/2 z-[1] flex w-max -translate-x-1/2 flex-col items-center gap-2.5"
                style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px) + 12px)' }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {opts}
              </div>
            </div>,
            document.body,
          )
        : null;

    return (
      <div ref={rootRef} className={`relative ${className}`}>
        {menu}
        <button
          type="button"
          onClick={() => {
            if (gestureActive) return;
            setOpen((v) => !v);
          }}
          aria-label={open ? 'Fermer' : 'Nouvelle note'}
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-haspopup="menu"
          data-tour="voice-capture"
          className="flex size-16 items-center justify-center rounded-full text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{
            backgroundColor: '#E8743C',
            boxShadow: '0 8px 20px rgba(232, 116, 60, 0.38)',
          }}
        >
          {open ? <X size={26} strokeWidth={2.2} aria-hidden /> : <Plus size={28} strokeWidth={2.2} aria-hidden />}
        </button>
      </div>
    );
  }

  if (variant === 'toolbar') {
    return (
      <div ref={rootRef} className={`relative ${className}`}>
        {open ? (
          <div
            id={menuId}
            role="menu"
            aria-label="Créer une note"
            className="absolute right-0 top-[calc(100%+6px)] z-[40] flex min-w-[11.5rem] flex-col overflow-hidden rounded-clay border border-black/[0.08] bg-surface py-1 shadow-clay-sm"
          >
            {opts}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Nouvelle note"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-haspopup="menu"
          className="inline-flex min-h-[40px] items-center justify-center gap-2 whitespace-nowrap rounded-clay bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors duration-fluid-subtle ease-in-out hover:bg-accent-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-5 sm:text-[14px]"
        >
          <Plus size={16} strokeWidth={2.2} aria-hidden />
          Note
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Créer une note"
          className={`absolute bottom-full z-10 mb-1.5 flex flex-col gap-0.5 rounded-[14px] bg-[#15202F]/95 p-1 ${
            collapsed ? 'left-1/2 w-max -translate-x-1/2 items-center' : 'w-full'
          }`}
        >
          {opts}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-tour="voice-capture"
        aria-label={open ? 'Fermer' : 'Nouvelle note'}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="menu"
        title={open ? 'Fermer' : 'Nouvelle note'}
        className={`flex w-full items-center rounded-[12px] border border-[#E8743C]/25 bg-[#E8743C]/12 text-left transition-colors duration-fluid-subtle ease-in-out hover:bg-[#E8743C]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
          collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2.5'
        }`}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E8743C] text-white"
          aria-hidden
        >
          {open ? <X size={18} strokeWidth={2.2} /> : <Plus size={20} strokeWidth={2.2} />}
        </span>
        <span className="sidebar-voice-copy min-w-0 flex-1 overflow-hidden">
          <span className="block whitespace-nowrap font-semibold text-white" style={{ fontSize: 13.5 }}>
            Nouvelle note
          </span>
          <span className="mt-0.5 block whitespace-nowrap text-[11px] leading-snug text-[#B8CDE3]">
            Écrire ou dicter
          </span>
        </span>
      </button>
    </div>
  );
}

function ChoiceButton({
  variant,
  collapsed,
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  variant: Variant;
  collapsed: boolean;
  icon: typeof Mic;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  if (variant === 'fab') {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        aria-label={label}
        className="flex min-h-11 items-center gap-2.5 rounded-full bg-surface px-3.5 py-2 text-[13.5px] font-semibold text-text shadow-md"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-accent text-white" aria-hidden>
          <Icon size={16} strokeWidth={2.2} />
        </span>
        {label}
      </button>
    );
  }

  if (variant === 'toolbar') {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] font-medium text-text transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04]"
      >
        <Icon size={16} strokeWidth={2} className="text-accent" aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex w-full items-center rounded-[12px] text-left text-[#E8EEF6] transition-colors duration-fluid-subtle ease-in-out hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
      }`}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
        aria-hidden
      >
        <Icon size={17} strokeWidth={2.1} />
      </span>
      {collapsed ? null : (
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold text-white">{label}</span>
          <span className="block text-[11px] text-[#B8CDE3]">{hint}</span>
        </span>
      )}
    </button>
  );
}
