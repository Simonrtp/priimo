'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Building2, Mail as MailIcon, MapPin, Phone as PhoneIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Lead, TeamMember } from '@/types/lead';
import { ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';
import { formatDate } from '@/lib/utils';
import LeadDetailHeader from './LeadDetailHeader';
import LeadDisplaySignals from './LeadDisplaySignals';
import LeadDeleteSection from './LeadDeleteSection';
import LeadAssigneeControl from './LeadAssigneeControl';
import LeadMarketCheck from './LeadMarketCheck';
import { LeadImmeubleContacts, LeadOwnerBlock } from './LeadOwnerContacts';
import LeadStatusControl from './LeadStatusControl';
import SciDirectorPendingNotice from './SciDirectorPendingNotice';
import ParticulierContactPendingHint from './ParticulierContactPendingHint';
import { DetailSection, DetailSectionLabel } from './LeadDetailSection';
import { hasOwnerBlock } from '@/lib/lead-contacts';
import { isSciDirectorPending } from '@/types/lead';

const mobileSelectTriggerClass =
  'flex w-full items-center justify-between gap-2 rounded-xl border border-black/8 bg-white px-4 py-3 text-left text-[14px] text-ink transition-colors hover:border-black/12 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100';

interface LeadFullScreenMobileProps {
  lead: Lead;
  onClose: () => void;
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
  canAssignLead?: boolean;
  currentUserId?: string | null;
  teamMembers: TeamMember[];
}

function mapsHref(lead: Lead): string {
  const q = [lead.address, lead.postalCode, lead.city].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default function LeadFullScreenMobile({
  lead,
  onClose,
  onUpdateLead,
  onDeleteLead,
  canAssignLead = true,
  currentUserId,
  teamMembers,
}: LeadFullScreenMobileProps) {
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Back-swipe (glisser depuis le bord gauche pour fermer, façon iOS)
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    if (e.clientX > 28) return; // uniquement depuis le bord gauche
    startXRef.current = e.clientX;
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (startXRef.current == null) return;
    setDragX(Math.max(0, e.clientX - startXRef.current));
  }, []);

  const endDrag = useCallback(() => {
    if (startXRef.current == null) return;
    startXRef.current = null;
    setDragging(false);
    setDragX((dx) => {
      if (dx > 90) onClose();
      return 0;
    });
  }, [onClose]);

  useEffect(() => {
    setNote('');
  }, [lead.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const saveNote = useCallback(async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSavingNote(true);
    const stamp = formatDate(new Date().toISOString());
    const nextNotes = lead.notes?.trim() ? `${lead.notes.trim()}\n\n[${stamp}] ${trimmed}` : trimmed;
    try {
      await onUpdateLead(lead.id, { notes: nextNotes });
      setNote('');
      toast.success('Note enregistrée');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'enregistrer la note.");
    } finally {
      setSavingNote(false);
    }
  }, [lead.id, lead.notes, note, onUpdateLead]);

  const isEnterprise = lead.ownerType === 'entreprise';
  const phone = isEnterprise ? lead.companyPhone : null;
  const noteDirty = Boolean(note.trim());
  const canSave = noteDirty && !savingNote;

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
        <LeadDetailHeader lead={lead} compact />

        {!isEnterprise && !hasOwnerBlock(lead) && (
          <div className="mt-4">
            <ParticulierContactPendingHint />
          </div>
        )}

        {isEnterprise && (
          <DetailSection>
            <DetailSectionLabel>Société propriétaire</DetailSectionLabel>
            <div className="space-y-3">
              <p className="flex items-center gap-2 font-semibold text-ink" style={{ fontSize: 14 }}>
                <Building2 size={ICON_SIZE.sm} color={ICON_COLORS.muted500} strokeWidth={2} aria-hidden />
                {lead.companyName ?? '—'}
              </p>
              {isSciDirectorPending(lead) ? (
                <SciDirectorPendingNotice />
              ) : (
                <div className="space-y-2">
                  <p className="text-mute" style={{ fontSize: 11 }}>
                    Dirigeant
                  </p>
                  <p className="font-medium text-ink" style={{ fontSize: 14 }}>
                    {lead.companyDirector ?? '—'}
                  </p>
                  {lead.companyPhone && (
                    <a
                      href={`tel:${lead.companyPhone}`}
                      className="flex min-h-[44px] items-center gap-2 font-medium text-[#3D5A80]"
                      style={{ fontSize: 14 }}
                    >
                      <PhoneIcon size={18} color={ICON_COLORS.green600} strokeWidth={2} aria-hidden />
                      {lead.companyPhone}
                    </a>
                  )}
                  {lead.companyEmail && (
                    <a
                      href={`mailto:${lead.companyEmail}`}
                      className="flex min-h-[44px] items-center gap-2 font-medium text-[#3D5A80]"
                      style={{ fontSize: 14 }}
                    >
                      <MailIcon size={18} color={ICON_COLORS.neutral} strokeWidth={2} aria-hidden />
                      {lead.companyEmail}
                    </a>
                  )}
                  {!lead.companyPhone && !lead.companyEmail && (
                    <p className="text-mute" style={{ fontSize: 12 }}>
                      Coordonnées non disponibles.
                    </p>
                  )}
                </div>
              )}
            </div>
          </DetailSection>
        )}

        <LeadOwnerBlock lead={lead} />

        {lead.marcheStatut === 'hors_marche' && lead.marcheVerifieLe && (
          <DetailSection>
            <LeadMarketCheck lead={lead} tourAnchor="drawer-market-mobile" />
          </DetailSection>
        )}

        <DetailSection>
          <div data-tour="drawer-signals-mobile">
            <DetailSectionLabel>Signaux détectés</DetailSectionLabel>
            <LeadDisplaySignals key={lead.id} displaySignals={lead.displaySignals} dpeDate={lead.dpeDate} />
          </div>
        </DetailSection>

        <LeadImmeubleContacts lead={lead} tourAnchor="drawer-contacts-mobile" />

        <DetailSection>
          <DetailSectionLabel>Gestion du lead</DetailSectionLabel>
          <div className="space-y-4">
            <LeadStatusControl
              lead={lead}
              onUpdateLead={onUpdateLead}
              selectTriggerClassName={mobileSelectTriggerClass}
              reasonFontSize={14}
              tourAnchor="drawer-status-mobile"
            />
            <LeadAssigneeControl
              lead={lead}
              teamMembers={teamMembers}
              onUpdateLead={onUpdateLead}
              canAssignAnyone={canAssignLead}
              currentUserId={currentUserId}
              selectTriggerClassName={mobileSelectTriggerClass}
            />
            <div>
              <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>
                Notes internes
              </p>
              <textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Notes visibles uniquement par votre agence…"
                className="placeholder-mute/60 min-h-[100px] w-full resize-y rounded-xl border border-black/8 bg-white px-4 py-3 text-ink focus:border-[#E8743C]/40 focus:outline-none focus:ring-2 focus:ring-[#E8743C]/15"
                style={{ fontSize: 14, lineHeight: 1.6 }}
              />
              {lead.notes?.trim() && (
                <p
                  className="mt-2 whitespace-pre-wrap rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-ink"
                  style={{ fontSize: 13, lineHeight: 1.55 }}
                >
                  {lead.notes}
                </p>
              )}
              <button
                type="button"
                onClick={() => void saveNote()}
                disabled={!canSave}
                className={`mt-3 inline-flex min-h-[44px] items-center justify-center rounded-[10px] px-5 font-semibold transition-colors ${
                  canSave
                    ? 'bg-[#E8743C] text-white hover:bg-[#C25E2C]'
                    : 'cursor-not-allowed bg-[#E8743C]/35 text-white'
                }`}
                style={{ fontSize: 14 }}
              >
                {savingNote ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>

          <LeadDeleteSection leadId={lead.id} onDelete={onDeleteLead} className="mt-2" />
        </DetailSection>
      </div>

      {/* Barre d'action collante — actions terrain rapides */}
      <div
        className="app-actionbar flex flex-shrink-0 items-center gap-2.5 border-t border-black/[0.05] bg-white px-4 pt-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <a
          href={mapsHref(lead)}
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
