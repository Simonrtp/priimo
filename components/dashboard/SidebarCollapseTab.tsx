'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function SidebarCollapseTab({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
      aria-expanded={!collapsed}
      title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
      className="nav-link mb-1 flex size-9 items-center justify-center rounded-xl text-[#B8CDE3] transition-colors duration-fluid-subtle ease-in-out hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
    >
      <Icon size={20} strokeWidth={1.75} className="nav-ico" aria-hidden />
    </button>
  );
}
