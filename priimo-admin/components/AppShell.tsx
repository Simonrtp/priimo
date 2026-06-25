'use client';

import { useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';

export function AppShell({
  children,
  supabaseOk,
}: {
  children: ReactNode;
  supabaseOk: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <Sidebar supabaseOk={supabaseOk} className="hidden md:flex" />

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full animate-fade-in">
            <Sidebar supabaseOk={supabaseOk} onNavigate={() => setOpen(false)} />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
            className="absolute right-4 top-4 rounded-lg bg-white/[0.06] p-2 text-white/70 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Bannière fixe — discrète mais présente */}
        <div className="sticky top-0 z-30 border-b border-yellow-500/10 bg-ink/80 px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-yellow-500/60 backdrop-blur">
          ⚠️ OUTIL INTERNE — LOCALHOST UNIQUEMENT — NE JAMAIS DÉPLOYER
        </div>

        {/* Barre mobile avec hamburger */}
        <header className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="rounded-lg bg-white/[0.04] p-2 text-white/70 hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-white">Priimo Admin</span>
        </header>

        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
