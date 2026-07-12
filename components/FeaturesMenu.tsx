'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { FEATURE_MENU_GROUPS } from '@/components/features-menu-data';

type FeaturesMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panelId: string;
};

function FeatureMenuItemLink({
  href,
  title,
  description,
  icon: Icon,
  onNavigate,
  compact = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-start gap-2.5 rounded-lg transition-colors duration-150 hover:bg-[#FFF7F0] ${
        compact ? 'px-2 py-1.5' : 'px-2 py-2'
      }`}
      onClick={onNavigate}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/6 bg-white text-gray-600 transition-colors duration-150 group-hover:border-accent/20 group-hover:text-accent">
        <Icon size={compact ? 15 : 16} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="block text-[13px] font-semibold leading-snug text-gray-900">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">{description}</span>
      </span>
    </Link>
  );
}

export function FeaturesMenuTrigger({ open, onOpenChange, panelId }: FeaturesMenuProps) {
  return (
    <div
      className="hidden lg:block"
      onMouseEnter={() => onOpenChange(true)}
    >
      <button
        type="button"
        className={`group inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium transition-colors duration-200 hover:text-accent-dark sm:text-[15px] ${
          open ? 'text-accent-dark' : 'text-gray-700'
        }`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        data-features-menu-trigger
        onClick={() => onOpenChange(!open)}
      >
        Fonctionnalités
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
    </div>
  );
}

export function FeaturesMegaPanel({ open, onOpenChange, panelId }: FeaturesMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      const trigger = document.querySelector('[data-features-menu-trigger]');
      if (trigger?.contains(target)) return;
      const resourcesTrigger = document.querySelector('[data-resources-menu-trigger]');
      if (resourcesTrigger?.contains(target)) return;
      onOpenChange(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div
      ref={panelRef}
      id={panelId}
      className={`absolute left-0 top-[calc(100%-10px)] z-40 hidden w-[min(calc(100vw-2rem),44rem)] pt-3 lg:block ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
      aria-hidden={!open}
    >
      <div
        className={`overflow-hidden rounded-b-2xl border border-t-0 border-black/8 bg-white/95 shadow-[0_24px_48px_-24px_rgba(17,24,39,0.28)] backdrop-blur-xl transition-all duration-150 ease-out ${
          open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
        }`}
        role="menu"
      >
        <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-5 lg:grid-cols-3 lg:gap-5 lg:px-5 lg:py-5">
          {FEATURE_MENU_GROUPS.map((group) => (
            <div key={group.title} className="min-w-0">
              <p className="mb-2 text-[10px] font-semibold uppercase text-[#E8743C] [letter-spacing:0.08em]">
                {group.title}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.title}>
                    <FeatureMenuItemLink
                      href={item.href}
                      title={item.title}
                      description={item.description}
                      icon={item.icon}
                      onNavigate={() => onOpenChange(false)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FeaturesMenuMobile({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sectionId = useId();

  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="border-t border-black/6 px-4 py-3 lg:hidden">
      <button
        type="button"
        className="flex w-full min-h-11 items-center justify-between text-left text-[15px] font-semibold text-gray-900"
        aria-expanded={expanded}
        aria-controls={sectionId}
        onClick={() => setExpanded((value) => !value)}
      >
        Fonctionnalités
        <ChevronDown
          size={18}
          className={`shrink-0 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {expanded && (
        <div id={sectionId} className="mt-2 space-y-4 pb-1">
          {FEATURE_MENU_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase text-[#E8743C] [letter-spacing:0.08em]">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.title}>
                    <FeatureMenuItemLink
                      href={item.href}
                      title={item.title}
                      description={item.description}
                      icon={item.icon}
                      compact
                      onNavigate={() => onOpenChange(false)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function useFeaturesMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return { open, setOpen, panelId };
}
