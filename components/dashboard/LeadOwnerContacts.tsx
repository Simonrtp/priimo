'use client';

import { Building2, Phone } from 'lucide-react';
import type { Lead } from '@/types/lead';
import { hasOwnerBlock } from '@/lib/lead-contacts';
import InfoTooltip from '@/components/ui/InfoTooltip';

const OWNER_PHONE_HINT =
  "Contact professionnel. L'échange doit porter sur la société et le bien qu'elle détient. Le démarchage téléphonique d'un particulier sans consentement préalable est interdit depuis le 11 août 2026.";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3 uppercase tracking-widest text-mute"
      style={{ fontSize: 9, letterSpacing: '0.18em' }}
    >
      {children}
    </p>
  );
}

/** Bloc propriétaire + autres contacts immeuble (affichage défensif si colonnes absentes). */
export default function LeadOwnerContacts({ lead }: { lead: Lead }) {
  const showOwner = hasOwnerBlock(lead);
  const immeubleContacts = lead.contactsImmeuble;
  const showImmeuble = immeubleContacts.length > 0;

  if (!showOwner && !showImmeuble) return null;

  return (
    <div className="space-y-5">
      {showOwner && (
        <div>
          <SectionLabel>Propriétaire</SectionLabel>
          <div className="space-y-2.5">
            {(lead.ownerName || lead.ownerAge != null) && (
              <p className="font-semibold text-ink" style={{ fontSize: 14 }}>
                {lead.ownerName?.trim() || 'Propriétaire'}
                {lead.ownerAge != null && lead.ownerAge > 0 && (
                  <span className="ml-2 font-normal text-mute" style={{ fontSize: 13 }}>
                    {lead.ownerAge} ans
                  </span>
                )}
              </p>
            )}

            {lead.ownerCompany?.trim() && (
              <div className="rounded-xl border border-[#3D5A80]/15 bg-[#FFF7F0] px-3 py-2.5">
                <p className="text-mute" style={{ fontSize: 11 }}>
                  Bien détenu par une société
                </p>
                <p className="mt-0.5 flex items-center gap-2 font-medium text-ink" style={{ fontSize: 13 }}>
                  <Building2 size={14} strokeWidth={2} className="shrink-0 text-[#3D5A80]" aria-hidden />
                  {lead.ownerCompany.trim()}
                </p>
              </div>
            )}

            {lead.ownerPhone?.trim() && (
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${lead.ownerPhone.trim()}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#E8743C]/10 px-3.5 py-2 font-semibold text-[#C25E2C] transition-colors hover:bg-[#E8743C]/15"
                  style={{ fontSize: 14 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone size={16} strokeWidth={2.2} aria-hidden />
                  {lead.ownerPhone.trim()}
                </a>
                <InfoTooltip content={OWNER_PHONE_HINT} placement="top-end" iconSize={14} />
              </div>
            )}
          </div>
        </div>
      )}

      {showImmeuble && (
        <div>
          <SectionLabel>Autres contacts à cette adresse</SectionLabel>
          <p className="mb-2.5 text-mute" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
            Sociétés présentes dans l&apos;immeuble.
          </p>
          <ul className="space-y-2">
            {immeubleContacts.map((contact) => (
              <li
                key={`${contact.companyName}-${contact.phone}`}
                className="rounded-xl border border-black/[0.06] bg-white px-3 py-2.5"
              >
                <p className="font-medium text-ink" style={{ fontSize: 13 }}>
                  {contact.companyName}
                </p>
                {contact.nafLibelle && (
                  <p className="mt-0.5 text-mute" style={{ fontSize: 11.5 }}>
                    {contact.nafLibelle}
                  </p>
                )}
                <a
                  href={`tel:${contact.phone}`}
                  className="mt-1.5 inline-flex items-center gap-1.5 font-medium text-[#3D5A80] hover:underline"
                  style={{ fontSize: 13 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone size={13} strokeWidth={2.2} aria-hidden />
                  {contact.phone}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
