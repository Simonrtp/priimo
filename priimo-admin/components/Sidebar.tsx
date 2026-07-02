'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Home, Mail, MapPin, Users } from 'lucide-react';

const nav = [
  { href: '/', label: "Vue d'ensemble", icon: Home },
  { href: '/agences', label: 'Agences', icon: Building2 },
  { href: '/leads', label: 'Leads', icon: MapPin },
  { href: '/utilisateurs', label: 'Utilisateurs', icon: Users },
  { href: '/invitations', label: 'Invitations', icon: Mail },
];

export function Sidebar({
  supabaseOk,
  followupCount = 0,
  onNavigate,
  className = '',
}: {
  supabaseOk: boolean;
  followupCount?: number;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex w-60 shrink-0 flex-col border-r border-white/[0.06] bg-panel ${className}`}
    >
      {/* Logo + indicateur LOCAL ONLY */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-white">Priimo</p>
          <p className="text-[10px] uppercase tracking-widest text-white/30">Local only</p>
        </div>
      </div>

      {/* Alerte relances — visible en permanence tant qu'il y en a en attente */}
      {followupCount > 0 ? (
        <Link
          href="/utilisateurs"
          onClick={onNavigate}
          className="mx-3 mt-3 flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/15"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          {followupCount} relance{followupCount > 1 ? 's' : ''} fondateur à faire
        </Link>
      ) : null}

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          const showBadge = href === '/utilisateurs' && followupCount > 0;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? 'border-r-2 border-indigo-500 bg-indigo-500/10 text-indigo-300'
                  : 'text-white/55 hover:bg-white/[0.03] hover:text-white'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${
                  active ? 'text-indigo-400' : 'text-white/40 group-hover:text-white/70'
                }`}
              />
              <span className="flex-1">{label}</span>
              {showBadge ? (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500/90 px-1.5 text-[10px] font-bold text-black">
                  {followupCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Bloc connexion Supabase */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.02] px-3 py-2.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              supabaseOk ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-red-500'
            }`}
          />
          <div className="leading-tight">
            <p className="text-xs font-medium text-white/70">
              Supabase {supabaseOk ? 'connecté' : 'hors-ligne'}
            </p>
            <p className="text-[10px] text-white/30">service_role · RLS bypass</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
