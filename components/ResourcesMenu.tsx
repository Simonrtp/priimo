'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Newspaper, Users } from 'lucide-react';
import { formatBlogDate } from '@/lib/blog/format';
import type { BlogPostSummary } from '@/lib/blog/types';
import { MenuIconBox } from '@/components/MenuIconBox';

type ResourcesMenuProps = {
  latestPost: BlogPostSummary | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || '?';
}

function FeaturedArticleVisual() {
  // Sans Priimo : stagnation avec à-coups (pas linéaire)
  const sansPath =
    'M24 98 C42 92, 58 88, 72 94 C86 100, 98 96, 112 90 C126 84, 138 92, 152 98 C166 104, 178 100, 192 96 C204 92, 212 94, 216 96';
  // Avec Priimo : progression nette vers le haut
  const avecPath =
    'M24 96 C40 88, 56 82, 72 86 C88 90, 104 76, 120 64 C136 52, 152 44, 168 38 C184 32, 200 28, 216 22';

  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-black/6 bg-gradient-to-br from-[#FFF3EA] via-white to-[#EEF2F7]">
      <svg
        className="absolute inset-0 h-full w-full px-4 pt-4 pb-10"
        viewBox="0 0 240 140"
        fill="none"
        role="img"
        aria-label="Comparaison des mandats : avec Priimo progresse, sans Priimo stagne"
      >
        <path
          d="M24 112 H216"
          stroke="#CBD5E1"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="4 6"
        />

        <path d={sansPath} stroke="#94A3B8" strokeWidth="9" strokeLinecap="round" opacity="0.12" />
        <path d={sansPath} stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

        <path d={avecPath} stroke="#E8743C" strokeWidth="9" strokeLinecap="round" opacity="0.1" />
        <path d={avecPath} stroke="#E8743C" strokeWidth="2.5" strokeLinecap="round" />

        <circle cx="216" cy="96" r="3.5" fill="#94A3B8" />
        <circle cx="216" cy="22" r="3.5" fill="#E8743C" />
      </svg>

      <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="h-[3px] w-5 shrink-0 rounded-full bg-[#E8743C]" aria-hidden />
            <span className="text-[10px] font-semibold leading-none text-[#E8743C]">Avec Priimo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-[3px] w-5 shrink-0 rounded-full bg-[#94A3B8]" aria-hidden />
            <span className="text-[10px] font-medium leading-none text-[#64748B]">Sans Priimo</span>
          </div>
        </div>
        <span className="text-[9px] font-medium uppercase text-[#94A3B8]">Mandats</span>
      </div>
    </div>
  );
}

export default function ResourcesMenu({
  latestPost,
  open: controlledOpen,
  onOpenChange,
}: ResourcesMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 250);
  };

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  useEffect(() => {
    if (!open) clearCloseTimer();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className={`group inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium transition-colors duration-200 hover:text-accent-dark sm:text-[15px] ${
          open ? 'text-accent-dark' : 'text-gray-700'
        }`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        data-resources-menu-trigger
        onClick={() => setOpen(!open)}
      >
        Ressources
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 w-[min(calc(100vw-2rem),36rem)] pt-3">
          <div
            id={panelId}
            className="rounded-2xl border border-black/8 bg-white p-4 shadow-[0_20px_50px_-20px_rgba(17,24,39,0.25)] sm:p-5"
            role="menu"
          >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1.05fr_auto_1fr] sm:gap-0">
            <div className="min-w-0 sm:pr-5">
              <p className="label mb-3 text-accent">Dernier article</p>
              {latestPost ? (
                <Link
                  href={`/blog/${latestPost.slug}`}
                  className="group block rounded-xl transition-colors hover:bg-soft-warm/40 p-1 -m-1"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  <FeaturedArticleVisual />
                  <h3 className="mt-3 text-[15px] font-semibold leading-snug text-gray-900 text-balance transition-colors group-hover:text-accent-dark">
                    {latestPost.title}
                  </h3>
                  <div className="mt-3 flex items-center gap-2.5">
                    {latestPost.authorImage ? (
                      <Image
                        src={latestPost.authorImage}
                        alt={latestPost.author}
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent-dark"
                        aria-hidden
                      >
                        {authorInitials(latestPost.author)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-gray-800">{latestPost.author}</p>
                      <p className="truncate text-[12px] text-gray-500">
                        {formatBlogDate(latestPost.date)} · {latestPost.readingTime} min
                      </p>
                    </div>
                  </div>
                </Link>
              ) : (
                <p className="text-sm text-gray-500">Aucun article publié pour le moment.</p>
              )}
            </div>

            <div className="hidden sm:block w-px bg-black/8" aria-hidden />

            <div className="min-w-0 sm:min-w-[11.5rem] sm:pl-5">
              <p className="label mb-3 text-accent">Ressources</p>
              <div className="flex flex-col gap-0.5">
                <Link
                  href="/blog"
                  className="group flex items-start gap-3 rounded-2xl px-2.5 py-2.5 transition-all duration-200 hover:bg-[#FFF7F0]"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  <MenuIconBox icon={Newspaper} />
                  <span className="min-w-0 pt-0.5">
                    <span className="block text-[13px] font-semibold leading-snug text-gray-900">
                      Blog
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 text-pretty">
                      Articles, conseil, formations
                    </span>
                  </span>
                </Link>

                <Link
                  href="/a-propos"
                  className="group flex items-start gap-3 rounded-2xl px-2.5 py-2.5 transition-all duration-200 hover:bg-[#FFF7F0]"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  <MenuIconBox icon={Users} />
                  <span className="min-w-0 pt-0.5">
                    <span className="block text-[13px] font-semibold leading-snug text-gray-900">
                      À propos
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 text-pretty">
                      Moi, Simon étudiant
                    </span>
                  </span>
                </Link>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
