'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { FEATURE_MENU_GROUPS } from '@/components/features-menu-data';
import { MenuIconBox } from '@/components/MenuIconBox';

type FeaturesMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panelId: string;
};

function FeatureMenuItemLink({
  href,
  title,
  description,
  icon,
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
      className={`group flex items-start gap-3 rounded-2xl transition-all duration-200 hover:bg-[#FFF7F0] ${
        compact ? 'px-2 py-1.5' : 'px-2.5 py-2.5'
      }`}
      onClick={onNavigate}
    >
      <MenuIconBox icon={icon} compact={compact} />
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
        className={`overflow-hidden rounded-[28px] border border-black/[0.07] bg-white/95 shadow-[0_28px_60px_-24px_rgba(17,24,39,0.22)] backdrop-blur-xl transition-all duration-200 ease-out ${
          open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
        }`}
        role="menu"
      >
        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-6 lg:grid-cols-3 lg:gap-6 lg:px-6 lg:py-6">
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

export function useFeaturesMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return { open, setOpen, panelId };
}
