'use client';

import type { Lead } from '@/types/lead';
import { ICONS, ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';
import CopyableField from './CopyableField';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="uppercase text-mute tracking-widest mb-3"
      style={{ fontSize: 9, letterSpacing: '0.18em' }}
    >
      {children}
    </p>
  );
}

interface LeadDrawerEnterpriseProps {
  lead: Lead;
  isPlanPremium: boolean;
  onCopied: () => void;
}

export default function LeadDrawerEnterprise({ lead, isPlanPremium, onCopied }: LeadDrawerEnterpriseProps) {
  return (
    <div className="relative rounded-xl overflow-hidden">
      <div
        className={`space-y-4 ${!isPlanPremium ? 'blur-[7px] pointer-events-none select-none' : ''}`}
      >
        <SectionLabel>Société propriétaire</SectionLabel>
        <p className="font-semibold text-ink flex items-center gap-2" style={{ fontSize: 14 }}>
          <ICONS.building className="flex-shrink-0" size={ICON_SIZE.sm} color={ICON_COLORS.muted500} strokeWidth={2} aria-hidden />
          {lead.companyName ?? '—'}
        </p>
        {lead.rcs && (
          <p className="text-mute" style={{ fontSize: 11.5 }}>
            {lead.rcs}
          </p>
        )}
        <div className="rounded-xl border border-black/[0.06] bg-[#F1F1EE]/90 px-4 py-3 space-y-4">
          <p className="text-mute uppercase tracking-widest" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
            Dirigeant
          </p>
          <p className="font-medium text-ink" style={{ fontSize: 14 }}>
            {lead.directorName ?? '—'}
          </p>
          <CopyableField
            label="Téléphone pro"
            value={lead.directorPhonePro ?? ''}
            disabled={!isPlanPremium}
            onCopied={onCopied}
            fieldIcon="phone"
          />
          <CopyableField
            label="Email pro"
            value={lead.directorEmailPro ?? ''}
            disabled={!isPlanPremium}
            onCopied={onCopied}
            fieldIcon="mail"
          />
        </div>
      </div>
      {!isPlanPremium && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 px-4 text-center">
          <p className="text-ink font-semibold mb-2" style={{ fontSize: 14 }}>
            Contenu Premium
          </p>
          <p className="text-mute mb-4" style={{ fontSize: 12 }}>
            Passez en Premium pour afficher RCS, dirigeant et coordonnées pro.
          </p>
          <button type="button" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13, borderRadius: 10 }}>
            Passer en Premium
          </button>
        </div>
      )}
    </div>
  );
}
