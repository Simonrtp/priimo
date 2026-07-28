'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MapPin, Phone as PhoneIcon } from 'lucide-react';
import type { Lead, TeamMember } from '@/types/lead';
import { ICON_COLORS } from '@/lib/iconMapping';
import { googleMapsSearchUrl, formatLeadAddressQuery } from '@/lib/utils';
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

  const isEnterprise = lead.ownerType === 'entreprise';
  const phone = isEnterprise ? lead.companyPhone : null;
  const mapsHref = googleMapsSearchUrl(formatLeadAddressQuery(lead));

  return (
    <div
      className="animate-app-push fixed inset-0 z-[70] flex flex-col bg-white md:hidden"
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
        className="app-navbar flex flex-shrink-0 items-center gap-1 border-b border-black/[0.06] bg-white px-2 py-2.5"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="app-press flex h-11 w-11 items-center justify-center rounded-full text-[#3D5A80]"
          aria-label="Retour"
        >
          <ArrowLeft size={22} strokeWidth={2.2} />
        </button>
        <p className="truncate font-bold text-ink" style={{ fontSize: 16, letterSpacing: '-0.02em' }}>
          Détail du lead
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-5 pb-6 pt-5">
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

      <div
        className="app-actionbar flex flex-shrink-0 items-center gap-2.5 border-t border-black/[0.05] bg-white px-4 pt-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="app-press flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#E8743C] font-semibold text-white"
          style={{ fontSize: 15 }}
        >
          <MapPin size={18} strokeWidth={2.2} aria-hidden />
          Ouvrir dans Maps
        </a>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="app-press flex min-h-[50px] items-center justify-center gap-2 rounded-xl border border-black/[0.08] bg-white px-5 font-semibold text-[#3D5A80]"
            style={{ fontSize: 15 }}
            aria-label={`Appeler ${lead.companyDirector ?? lead.companyName ?? ''}`}
          >
            <PhoneIcon size={18} color={ICON_COLORS.green600} strokeWidth={2.2} aria-hidden />
            Appeler
          </a>
        )}
      </div>
    </div>
  );
}
