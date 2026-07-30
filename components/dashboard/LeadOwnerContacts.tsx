'use client';

import { useMemo } from 'react';
import type { Lead } from '@/types/lead';
import { isSciDirectorPending } from '@/types/lead';
import {
  hasAnyLeadPhone,
  hasOwnerBlock,
  immeubleCategorieLabel,
  type ImmeubleContact,
} from '@/lib/lead-contacts';
import {
  namesShareSameTokenSet,
  shortenOwnerRole,
  toDisplayPersonName,
} from '@/lib/lead-person-display';
import InfoTooltip from '@/components/ui/InfoTooltip';
import SciDirectorPendingNotice from './SciDirectorPendingNotice';
import { DetailSection, DetailSectionLabel } from './LeadDetailSection';

const CONTACTS_LEGAL_HINT =
  "Contacts professionnels. L'échange doit porter sur la société et le bien qu'elle détient. Le démarchage téléphonique d'un particulier sans consentement préalable est interdit à compter du 11 août 2026.";

function ImmeubleContactRow({ contact }: { contact: ImmeubleContact }) {
  return (
    <li className="min-w-0 border-t border-black/[0.05] py-3 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="min-w-0 break-words font-medium text-ink" style={{ fontSize: 13.5 }}>
          {toDisplayPersonName(contact.companyName)}
        </p>
        <span className="shrink-0 text-mute" style={{ fontSize: 12 }}>
          {immeubleCategorieLabel(contact.categorie)}
        </span>
      </div>
      {contact.nafLibelle && (
        <p className="mt-0.5 text-pretty text-mute" style={{ fontSize: 12, lineHeight: 1.4 }}>
          {contact.nafLibelle}
        </p>
      )}
      <a
        href={`tel:${contact.phone}`}
        className="mt-1 inline-flex min-h-10 items-center font-medium tabular-nums text-[#3D5A80] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        style={{ fontSize: 13 }}
        onClick={(e) => e.stopPropagation()}
      >
        {contact.phone}
      </a>
    </li>
  );
}

function OwnerPersonBlock({ lead }: { lead: Lead }) {
  const nameRaw = lead.ownerName?.trim() || null;
  const companyRaw = lead.ownerCompany?.trim() || null;
  const phone = lead.ownerPhone?.trim() || null;
  const age = lead.ownerAge != null && lead.ownerAge > 0 ? lead.ownerAge : null;

  const roleRaw = lead.companyDirector?.trim() || null;
  const roleDistinct =
    roleRaw &&
    (!nameRaw || roleRaw.toLocaleLowerCase('fr') !== nameRaw.toLocaleLowerCase('fr'))
      ? roleRaw
      : roleRaw && !nameRaw
        ? roleRaw
        : null;
  const role = roleDistinct ? shortenOwnerRole(roleDistinct) : null;

  const companyIsPersonDup =
    Boolean(nameRaw && companyRaw && namesShareSameTokenSet(nameRaw, companyRaw));

  const societyPart = companyRaw
    ? companyIsPersonDup
      ? 'bien détenu en société'
      : toDisplayPersonName(companyRaw)
    : null;

  const secondary = [role, societyPart].filter(Boolean).join(' · ');

  const displayName = nameRaw ? toDisplayPersonName(nameRaw) : null;
  if (!displayName && age == null && !secondary && !companyRaw && !phone) return null;

  return (
    <div>
      {(displayName || age != null) && (
        <p className="break-words font-semibold text-ink" style={{ fontSize: 16, letterSpacing: '-0.01em' }}>
          {displayName || 'Propriétaire'}
          {age != null && (
            <span className="ml-2 whitespace-nowrap font-normal text-mute" style={{ fontSize: 13 }}>
              {age} ans
            </span>
          )}
        </p>
      )}
      {secondary && (
        <p className="mt-1 break-words text-pretty text-mute" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
          {secondary}
        </p>
      )}
      {phone && (
        <div className="mt-2">
          <a
            href={`tel:${phone}`}
            className="inline-flex min-h-10 items-center font-medium tabular-nums text-[#3D5A80] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            style={{ fontSize: 13 }}
            onClick={(e) => e.stopPropagation()}
          >
            {phone}
          </a>
          {lead.ownerPhoneSource === 'probable' && (
            <p className="mt-1 text-pretty text-mute" style={{ fontSize: 12, lineHeight: 1.45 }}>
              Société immobilière domiciliée à cette adresse — lien avec le bien non confirmé.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EnterpriseExtras({ lead }: { lead: Lead }) {
  if (lead.ownerType !== 'entreprise') return null;
  if (isSciDirectorPending(lead)) {
    return (
      <div className="mt-3">
        <SciDirectorPendingNotice />
      </div>
    );
  }

  // Données société déjà couvertes par le bloc propriétaire (ownerCompany / director).
  // N’affiche un complément que si companyName apporte une info distincte sans owner.
  const company = lead.companyName?.trim();
  const director = lead.companyDirector?.trim();
  const ownerName = lead.ownerName?.trim();
  if (!company && !director) return null;
  if (ownerName || lead.ownerCompany?.trim()) return null;

  return (
    <div className="space-y-1">
      {director && (
        <p className="font-semibold text-ink" style={{ fontSize: 16, letterSpacing: '-0.01em' }}>
          {toDisplayPersonName(director)}
        </p>
      )}
      {company && (
        <p className="text-mute" style={{ fontSize: 12.5 }}>
          {toDisplayPersonName(company)}
        </p>
      )}
    </div>
  );
}

/**
 * Section « À qui vous parlez » — propriétaire + contacts immeuble (lignes plates).
 */
export function LeadWhoYouSpeakTo({
  lead,
  tourAnchor,
}: {
  lead: Lead;
  tourAnchor?: string;
}) {
  const contacts = lead.contactsImmeuble ?? [];
  const showOwner = hasOwnerBlock(lead);
  const showEnterprise =
    lead.ownerType === 'entreprise' &&
    (Boolean(lead.companyName?.trim()) ||
      Boolean(lead.companyDirector?.trim()) ||
      isSciDirectorPending(lead));

  const visible = useMemo(() => showOwner || showEnterprise || contacts.length > 0, [
    showOwner,
    showEnterprise,
    contacts.length,
  ]);

  if (!visible) return null;

  const showLegal = hasAnyLeadPhone(lead);

  return (
    <DetailSection data-tour={tourAnchor}>
      <DetailSectionLabel>À qui vous parlez</DetailSectionLabel>

      <div className="space-y-4">
        {showOwner && <OwnerPersonBlock lead={lead} />}
        {showEnterprise && <EnterpriseExtras lead={lead} />}

        {contacts.length > 0 && (
          <div>
            <p className="mb-2 font-medium text-ink" style={{ fontSize: 12.5 }}>
              Dans l&apos;immeuble
            </p>
            <ul>
              {contacts.map((contact, index) => (
                <ImmeubleContactRow
                  key={`${contact.companyName}-${contact.phone}-${index}`}
                  contact={contact}
                />
              ))}
            </ul>
          </div>
        )}

        {showLegal && (
          <div className="flex justify-end pt-0.5">
            <InfoTooltip content={CONTACTS_LEGAL_HINT} placement="top-end" iconSize={14} />
          </div>
        )}
      </div>
    </DetailSection>
  );
}

/** @deprecated Utiliser LeadWhoYouSpeakTo */
export function LeadOwnerBlock({ lead }: { lead: Lead }) {
  return <LeadWhoYouSpeakTo lead={lead} />;
}

/** @deprecated Fusionné dans LeadWhoYouSpeakTo */
export function LeadImmeubleContacts({
  lead,
  tourAnchor,
}: {
  lead: Lead;
  tourAnchor?: string;
}) {
  if ((lead.contactsImmeuble?.length ?? 0) === 0) return null;
  return <LeadWhoYouSpeakTo lead={lead} tourAnchor={tourAnchor} />;
}
