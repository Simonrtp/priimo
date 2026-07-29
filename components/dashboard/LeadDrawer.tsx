'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lead, TeamMember } from '@/types/lead';
import { ICONS, ICON_COLORS } from '@/lib/iconMapping';
import LeadDetailBody from './LeadDetailBody';

interface LeadDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
  onScriptApprocheChange?: (id: string, script: NonNullable<Lead['scriptApproche']>) => void;
  canAssignLead?: boolean;
  canDeleteLead?: boolean;
  currentUserId?: string | null;
  teamMembers: TeamMember[];
}

export default function LeadDrawer({
  lead,
  onClose,
  onUpdateLead,
  onDeleteLead,
  onScriptApprocheChange,
  canAssignLead = true,
  canDeleteLead = false,
  currentUserId,
  teamMembers,
}: LeadDrawerProps) {
  const [drawerEntered, setDrawerEntered] = useState(false);
  const [drawerSettled, setDrawerSettled] = useState(false);

  useEffect(() => {
    if (!lead) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lead, onClose]);

  const leadId = lead?.id ?? null;
  useEffect(() => {
    if (leadId === null) {
      setDrawerEntered(false);
      setDrawerSettled(false);
      return;
    }
    setDrawerEntered(false);
    setDrawerSettled(false);
    const enter = window.setTimeout(() => setDrawerEntered(true), 16);
    const settle = window.setTimeout(() => setDrawerSettled(true), 260);
    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(settle);
    };
  }, [leadId]);

  useEffect(() => {
    if (!lead) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lead]);

  if (!lead) return null;

  const panel = (
    <>
      <div
        role="presentation"
        className={`fixed inset-0 z-40 hidden transition-opacity duration-200 ease-out md:block ${
          drawerEntered ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 hidden h-[100dvh] max-h-[100dvh] w-full max-w-[480px] flex-col bg-white ease-out md:flex ${
          drawerSettled
            ? ''
            : `transition-transform duration-[225ms] ${drawerEntered ? 'translate-x-0' : 'translate-x-full'}`
        }`}
        style={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.08)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-address"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-shrink-0 justify-end border-b border-black/[0.05] px-7 pb-3 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-mute transition-colors hover:bg-black/[0.05] hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              aria-label="Fermer"
            >
              <ICONS.x size={20} color={ICON_COLORS.neutral} strokeWidth={2} />
            </button>
          </div>

          <LeadDetailBody
            lead={lead}
            onUpdateLead={onUpdateLead}
            onDeleteLead={onDeleteLead}
            onScriptApprocheChange={
              onScriptApprocheChange
                ? (script) => onScriptApprocheChange(lead.id, script)
                : undefined
            }
            canAssignLead={canAssignLead}
            canDeleteLead={canDeleteLead}
            currentUserId={currentUserId}
            teamMembers={teamMembers}
            variant="desktop"
            headerTitleId="drawer-address"
          />
        </div>
      </aside>
    </>
  );

  return createPortal(panel, document.body);
}
