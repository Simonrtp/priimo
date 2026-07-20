'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { FEATURE_MENU_GROUPS } from '@/components/features-menu-data';

type SectionKey = 'features' | 'resources';

const RESOURCE_LINKS = [
  { href: '/blog', title: 'Blog' },
  { href: '/a-propos', title: 'À propos' },
] as const;

const TRANSITION_MS = 200;
const PANEL_GAP = 8;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Verre du header : réutilisé pour que le panneau soit visuellement identique.
const PANEL_SURFACE =
  'rounded-[28px] border border-white/70 bg-white/70 shadow-[0_10px_30px_-12px_rgba(60,40,20,0.35)] backdrop-blur-xl';
const SECTION_BUTTON =
  'group flex w-full items-center justify-between gap-3 py-4 text-left text-[17px] font-medium text-gray-900 transition-colors hover:text-accent-dark';
const SUBLINK =
  'block py-2 text-[15px] font-medium text-gray-700 transition-colors hover:text-accent-dark';

/** Monte le panneau puis déclenche la transition d'entrée / sortie. */
function usePanelTransition(open: boolean) {
  const [render, setRender] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) {
      setShown(false);
      const timeout = window.setTimeout(() => setRender(false), TRANSITION_MS);
      return () => window.clearTimeout(timeout);
    }

    setRender(true);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setShown(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return { render, shown };
}

/** Bloque le scroll du body tant que le menu est ouvert. */
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

/** Piège le focus dans le conteneur et ferme sur Échap. */
function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onEscape: () => void,
) {
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape();
        return;
      }

      if (event.key !== 'Tab' || !containerRef.current) return;

      const focusables = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
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
  }, [active, containerRef, onEscape]);
}

/** Suit le bas du header flottant pour ancrer le panneau juste en dessous. */
function useHeaderBottom(active: boolean, anchorRef: RefObject<HTMLElement | null>) {
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    if (!active) return;

    const measure = () => {
      const header = anchorRef.current?.closest('header');
      if (header) setBottom(header.getBoundingClientRect().bottom);
    };

    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [active, anchorRef]);

  return bottom;
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function SectionChevron({ open }: { open: boolean }) {
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <Icon
      size={18}
      className="shrink-0 text-gray-400 transition-colors group-hover:text-accent"
      aria-hidden
    />
  );
}

function CollapsibleSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-black/[0.06]">
      <button type="button" className={SECTION_BUTTON} aria-expanded={open} onClick={onToggle}>
        {label}
        <SectionChevron open={open} />
      </button>
      {open ? children : null}
    </div>
  );
}

function PanelLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={SUBLINK} onClick={onNavigate}>
      {children}
    </Link>
  );
}

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<SectionKey | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const mounted = useMounted();
  const { render, shown } = usePanelTransition(open);
  const headerBottom = useHeaderBottom(render, triggerRef);
  const active = open && shown;

  const close = useCallback(() => {
    setOpen(false);
    setExpanded(null);
  }, []);

  const toggleSection = useCallback((section: SectionKey) => {
    setExpanded((prev) => (prev === section ? null : section));
  }, []);

  useScrollLock(active);
  useFocusTrap(active, panelRef, close);

  // Fermer à chaque changement de route.
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Focus dans le panneau à l'ouverture, retour au déclencheur à la fermeture.
  useEffect(() => {
    if (active) {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    } else if (!render) {
      triggerRef.current?.focus();
    }
  }, [active, render]);

  const panel =
    mounted && render
      ? createPortal(
          <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
            <div
              className={`absolute inset-0 bg-black/20 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                shown ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden
              onClick={close}
            />

            <div
              className="absolute inset-x-0 flex justify-center px-3 sm:px-5"
              style={{ top: headerBottom + PANEL_GAP }}
            >
              <div
                ref={panelRef}
                id="mobile-nav-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Menu de navigation"
                aria-hidden={!shown}
                className={`flex w-full max-w-6xl flex-col transition-all duration-200 ease-out motion-reduce:transition-none ${
                  shown ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
                }`}
              >
                <nav
                  className={`overflow-y-auto overscroll-contain px-5 pb-4 pt-2 sm:px-6 ${PANEL_SURFACE}`}
                  style={{ maxHeight: `calc(100dvh - ${headerBottom + 3 * PANEL_GAP}px)` }}
                  aria-label="Navigation mobile"
                >
                  <CollapsibleSection
                    label="Fonctionnalités"
                    open={expanded === 'features'}
                    onToggle={() => toggleSection('features')}
                  >
                    <div className="space-y-4 pb-4 pl-1">
                      {FEATURE_MENU_GROUPS.map((group) => (
                        <div key={group.title}>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase text-accent [letter-spacing:0.08em]">
                            {group.title}
                          </p>
                          <ul>
                            {group.items.map((item) => (
                              <li key={item.title}>
                                <PanelLink href={item.href} onNavigate={close}>
                                  {item.title}
                                </PanelLink>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection
                    label="Ressources"
                    open={expanded === 'resources'}
                    onToggle={() => toggleSection('resources')}
                  >
                    <ul className="pb-4 pl-1">
                      {RESOURCE_LINKS.map((item) => (
                        <li key={item.href}>
                          <PanelLink href={item.href} onNavigate={close}>
                            {item.title}
                          </PanelLink>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleSection>

                  <Link href="/login" className="group flex w-full py-4" onClick={close}>
                    <span className="relative inline-flex text-[17px] font-medium text-gray-900 transition-colors duration-200 group-hover:text-accent-dark">
                      Se connecter
                      <span
                        className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-200 ease-out group-hover:w-full"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </nav>
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
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-700 outline-none transition-colors duration-200 [-webkit-tap-highlight-color:transparent] hover:text-accent-dark focus:outline-none focus-visible:outline-none lg:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        onClick={() => setOpen((prev) => !prev)}
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
