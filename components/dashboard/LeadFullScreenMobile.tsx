'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Lead, TeamMember } from '@/types/lead';
import LeadDetailBody from './LeadDetailBody';

interface LeadFullScreenMobileProps {
  lead: Lead;
  onClose: () => void;
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
  canAssignLead?: boolean;
  canDeleteLead?: boolean;
  currentUserId?: string | null;
  teamMembers: TeamMember[];
}

export default function LeadFullScreenMobile({
  lead,
  onClose,
  onUpdateLead,
  onDeleteLead,
  canAssignLead = true,
  canDeleteLead = false,
  currentUserId,
  teamMembers,
}: LeadFullScreenMobileProps) {
  const startX = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.clientX > 28) return;
    startX.current = e.clientX;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    setDragX(Math.max(0, e.clientX - startX.current));
  };

  const endDrag = () => {
    if (startX.current == null) return;
    if (dragX > 90) onClose();
    startX.current = null;
    setDragX(0);
    setDragging(false);
  };

  return (
    <div
      className="animate-app-push fixed inset-0 z-[70] flex h-dvh max-h-dvh w-full min-w-0 flex-col overflow-hidden bg-white md:hidden"
      style={{
        transform: dragX ? `translateX(${dragX}px)` : undefined,
        transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
        boxShadow: dragX ? '-16px 0 44px rgba(30,27,75,0.18)' : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <header
        className="app-navbar flex w-full min-w-0 flex-shrink-0 items-center gap-1 border-b border-black/[0.06] bg-white px-2 py-2.5"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="app-press flex size-11 shrink-0 items-center justify-center rounded-full text-[#3D5A80] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          aria-label="Retour"
        >
          <ArrowLeft size={22} strokeWidth={2.2} />
        </button>
        <p className="min-w-0 flex-1 truncate font-bold text-ink" style={{ fontSize: 16, letterSpacing: '-0.02em' }}>
          Détail du lead
        </p>
      </header>

      <LeadDetailBody
        lead={lead}
        onUpdateLead={onUpdateLead}
        onDeleteLead={onDeleteLead}
        canAssignLead={canAssignLead}
        canDeleteLead={canDeleteLead}
        currentUserId={currentUserId}
        teamMembers={teamMembers}
        variant="mobile"
        headerCompact
      />
    </div>
  );
}
