'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Menu, Newspaper, Users, X } from 'lucide-react';
import { FEATURE_MENU_GROUPS } from '@/components/features-menu-data';
import { MenuIconBox } from '@/components/MenuIconBox';
import { CALENDLY_URL } from '@/lib/calendly';

type ExpandedSection = 'features' | 'resources' | null;

const RESOURCE_LINKS = [
  { href: '/blog', title: 'Blog', icon: Newspaper },
  { href: '/a-propos', title: 'À propos', icon: Users },
] as const;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedSection>(null);
  const [mounted, setMounted] = useState(false);
  const [renderPanel, setRenderPanel] = useState(false);
  const [panelShown, setPanelShown] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setExpanded(null);
  }, []);

  const openMenu = useCallback(() => {
    setOpen(true);
  }, []);

  const toggleMenu = useCallback(() => {
    if (open) close();
    else openMenu();
  }, [close, open, openMenu]);

  const toggleSection = useCallback((section: 'features' | 'resources') => {
    setExpanded((prev) => (prev === section ? null : section));
  }, []);

  const handleNavigate = useCallback(() => {
    close();
  }, [close]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) {
      setPanelShown(false);
      const timeout = window.setTimeout(() => setRenderPanel(false), 200);
      return () => window.clearTimeout(timeout);
    }

    setRenderPanel(true);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setPanelShown(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || !panelShown) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, panelShown]);

  useEffect(() => {
    if (!open || !panelShown) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, panelShown, close]);

  useEffect(() => {
    if (open && panelShown) {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
      return;
    }

    if (!open && !renderPanel) {
      triggerRef.current?.focus();
    }
  }, [open, panelShown, renderPanel]);

  const panel =
    renderPanel && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
            <div
              className={`absolute inset-0 bg-black/25 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                panelShown ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden
              onClick={close}
            />

            <div
              ref={panelRef}
              id="mobile-nav-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navigation"
              aria-hidden={!panelShown}
              className={`absolute inset-y-0 right-0 flex w-full max-w-[min(100%,20.5rem)] flex-col bg-white shadow-[-10px_0_40px_-12px_rgba(17,24,39,0.18)] transition-transform duration-200 ease-out motion-reduce:transition-none ${
                panelShown ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <nav
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-24"
                aria-label="Navigation mobile"
              >
                <div className="border-b border-black/[0.06]">
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 py-4 text-left text-[16px] font-semibold transition-colors ${
                      expanded === 'features' ? 'text-accent-dark' : 'text-gray-800'
                    }`}
                    aria-expanded={expanded === 'features'}
                    onClick={() => toggleSection('features')}
                  >
                    Fonctionnalités
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-gray-400 transition-transform duration-200 ${
                        expanded === 'features' ? 'rotate-180 text-accent-dark' : ''
                      }`}
                      aria-hidden
                    />
                  </button>

                  {expanded === 'features' && (
                    <div className="space-y-5 pb-5">
                      {FEATURE_MENU_GROUPS.map((group) => (
                        <div key={group.title}>
                          <p className="mb-2 text-[10px] font-semibold uppercase text-[#E8743C] [letter-spacing:0.08em]">
                            {group.title}
                          </p>
                          <ul className="space-y-1">
                            {group.items.map((item) => (
                              <li key={item.title}>
                                <Link
                                  href={item.href}
                                  className="group flex items-center gap-3 rounded-xl px-1 py-2.5 text-[15px] font-medium text-gray-800 transition-colors hover:text-accent-dark"
                                  onClick={handleNavigate}
                                >
                                  <MenuIconBox
                                    icon={item.icon}
                                    compact
                                    className={
                                      expanded === 'features'
                                        ? 'border-accent/20 text-accent-dark'
                                        : undefined
                                    }
                                  />
                                  {item.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-b border-black/[0.06]">
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 py-4 text-left text-[16px] font-semibold transition-colors ${
                      expanded === 'resources' ? 'text-accent-dark' : 'text-gray-800'
                    }`}
                    aria-expanded={expanded === 'resources'}
                    onClick={() => toggleSection('resources')}
                  >
                    Ressources
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-gray-400 transition-transform duration-200 ${
                        expanded === 'resources' ? 'rotate-180 text-accent-dark' : ''
                      }`}
                      aria-hidden
                    />
                  </button>

                  {expanded === 'resources' && (
                    <ul className="space-y-1 pb-5">
                      {RESOURCE_LINKS.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className="group flex items-center gap-3 rounded-xl px-1 py-2.5 text-[15px] font-medium text-gray-800 transition-colors hover:text-accent-dark"
                            onClick={handleNavigate}
                          >
                            <MenuIconBox
                              icon={item.icon}
                              compact
                              className={
                                expanded === 'resources'
                                  ? 'border-accent/20 text-accent-dark'
                                  : undefined
                              }
                            />
                            {item.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Link
                  href="/login"
                  className="group relative inline-flex min-h-11 w-full items-center py-4 text-[15px] font-medium text-gray-800 transition-colors hover:text-accent-dark"
                  onClick={handleNavigate}
                >
                  Se connecter
                  <span
                    className="absolute bottom-3 left-0 h-px w-0 bg-accent transition-all duration-200 ease-out group-hover:w-full"
                    aria-hidden
                  />
                </Link>
              </nav>

              <div className="shrink-0 border-t border-black/[0.06] px-5 pb-8 pt-6">
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary inline-flex w-full min-h-12 items-center justify-center gap-1.5 px-6 py-3 text-[15px]"
                  onClick={close}
                >
                  Réserver une démo
                  <span data-arrow aria-hidden>
                    →
                  </span>
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-700 transition-colors duration-200 hover:text-accent-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366F1] lg:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        onClick={toggleMenu}
      >
        {open ? (
          <X size={22} strokeWidth={2} aria-hidden />
        ) : (
          <Menu size={22} strokeWidth={2} aria-hidden />
        )}
      </button>
      {panel}
    </>
  );
}
