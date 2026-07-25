'use client';

import { useId, useState } from 'react';
import { ChevronDown, Phone } from 'lucide-react';
import type { Lead } from '@/types/lead';
import {
  hasOwnerBlock,
  immeubleCategorieLabel,
  type ImmeubleContact,
  type ImmeubleContactCategorie,
} from '@/lib/lead-contacts';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { DetailSection, DetailSectionLabel } from './LeadDetailSection';

const OWNER_PHONE_HINT =
  "Contact professionnel. L'échange doit porter sur la société et le bien qu'elle détient. Le démarchage téléphonique d'un particulier sans consentement préalable est interdit depuis le 11 août 2026.";

const COMPANY_NOTICE =
  "Bien détenu par une société — l'échange doit porter sur la société et le bien qu'elle détient.";

const CATEGORIE_BADGE: Record<ImmeubleContactCategorie, string> = {
  commerce: 'bg-[#E8743C]/12 text-[#C25E2C]',
  professionnel: 'bg-[#3D5A80]/12 text-[#3D5A80]',
  domicile_pro: 'bg-black/[0.06] text-mute',
};

function ImmeubleContactCard({ contact }: { contact: ImmeubleContact }) {
  return (
    <li className="rounded-xl border border-black/[0.06] bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-ink" style={{ fontSize: 13 }}>
          {contact.companyName}
        </p>
        <span
          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORIE_BADGE[contact.categorie]}`}
        >
          {immeubleCategorieLabel(contact.categorie)}
        </span>
      </div>
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
  );
}

const TOUR_EXPAND_CONTACTS_KEY = 'priimo-tour-expand-contacts';
const CONTACTS_PREVIEW = 2;

function consumeTourExpandFlag(): boolean {
  try {
    if (sessionStorage.getItem(TOUR_EXPAND_CONTACTS_KEY) === '1') {
      sessionStorage.removeItem(TOUR_EXPAND_CONTACTS_KEY);
      return true;
    }
  } catch {
    // sessionStorage indisponible
  }
  return false;
}

function ImmeubleContactsSection({
  contacts,
  tourAnchor,
}: {
  contacts: ImmeubleContact[];
  tourAnchor?: string;
}) {
  const count = contacts.length;
  // Ouvert par défaut : les 2 premiers contacts sont visibles.
  const [boot] = useState(() => {
    const tour = consumeTourExpandFlag();
    return { open: true, showAll: tour };
  });
  const [open, setOpen] = useState(boot.open);
  const [showAll, setShowAll] = useState(boot.showAll);
  const panelId = useId();

  const visible = showAll ? contacts : contacts.slice(0, CONTACTS_PREVIEW);
  const hiddenCount = Math.max(0, count - CONTACTS_PREVIEW);

  return (
    <DetailSection data-tour={tourAnchor}>
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        <div className="min-w-0 flex-1">
          <DetailSectionLabel className="mb-0">
            Autres contacts à cette adresse · {count}
          </DetailSectionLabel>
        </div>
        <ChevronDown
          size={16}
          strokeWidth={2.2}
          className={`shrink-0 text-mute transition-transform duration-200 ease-out motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={`${panelId}-trigger`}
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className={`space-y-2 ${open ? 'mt-3' : ''}`}>
            {visible.map((contact, index) => (
              <ImmeubleContactCard
                key={`${contact.companyName}-${contact.phone}-${index}`}
                contact={contact}
              />
            ))}
          </ul>
          {open && hiddenCount > 0 && !showAll && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(true);
              }}
              className="mt-2.5 text-[#3D5A80] transition-colors hover:text-ink hover:underline focus:outline-none focus-visible:underline"
              style={{ fontSize: 12.5, fontWeight: 500 }}
            >
              Afficher {hiddenCount} de plus
            </button>
          )}
          {open && showAll && count > CONTACTS_PREVIEW && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(false);
              }}
              className="mt-2.5 text-mute transition-colors hover:text-ink hover:underline focus:outline-none focus-visible:underline"
              style={{ fontSize: 12.5, fontWeight: 500 }}
            >
              Afficher moins
            </button>
          )}
        </div>
      </div>
    </DetailSection>
  );
}

function OwnerSection({ lead }: { lead: Lead }) {
  const name = lead.ownerName?.trim() || null;
  const company = lead.ownerCompany?.trim() || null;
  const phone = lead.ownerPhone?.trim() || null;
  const age = lead.ownerAge != null && lead.ownerAge > 0 ? lead.ownerAge : null;
  // Rôle juridique Pappers : company_director quand distinct du nom (qualité / mandat).
  const roleRaw = lead.companyDirector?.trim() || null;
  const role =
    roleRaw && name && roleRaw.toLocaleLowerCase('fr') !== name.toLocaleLowerCase('fr')
      ? roleRaw
      : roleRaw && !name
        ? roleRaw
        : null;

  return (
    <DetailSection>
      <DetailSectionLabel>Propriétaire</DetailSectionLabel>
      <div className="space-y-3">
        {(name || age != null) && (
          <div>
            <p className="font-semibold text-ink" style={{ fontSize: 16, letterSpacing: '-0.01em' }}>
              {name || 'Propriétaire'}
              {age != null && (
                <span className="ml-2 font-normal text-mute" style={{ fontSize: 13 }}>
                  {age} ans
                </span>
              )}
            </p>
            {role && (
              <p className="mt-1 text-pretty text-mute" style={{ fontSize: 12, lineHeight: 1.45 }}>
                {role}
              </p>
            )}
          </div>
        )}

        {company && (
          <div className="space-y-2">
            <div>
              <p className="text-mute" style={{ fontSize: 11 }}>
                Société propriétaire
              </p>
              <p className="mt-0.5 font-medium text-ink" style={{ fontSize: 13 }}>
                {company}
              </p>
            </div>
            <p
              className="rounded-xl px-3 py-2.5 text-pretty"
              style={{
                fontSize: 12,
                lineHeight: 1.45,
                backgroundColor: '#FFF7F0',
                color: '#3D5A80',
              }}
            >
              {COMPANY_NOTICE}
            </p>
          </div>
        )}

        {phone && (
          <div className="flex items-center gap-2">
            <a
              href={`tel:${phone}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#E8743C]/10 px-3.5 py-2 font-semibold text-[#C25E2C] transition-colors hover:bg-[#E8743C]/15"
              style={{ fontSize: 14 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Phone size={16} strokeWidth={2.2} aria-hidden />
              {phone}
            </a>
            <InfoTooltip content={OWNER_PHONE_HINT} placement="top-end" iconSize={14} />
          </div>
        )}
      </div>
    </DetailSection>
  );
}

/** Bloc propriétaire seul (au-dessus des signaux). */
export function LeadOwnerBlock({ lead }: { lead: Lead }) {
  if (!hasOwnerBlock(lead)) return null;
  return <OwnerSection lead={lead} />;
}

/** Contacts immeuble — à placer sous Signaux détectés. */
export function LeadImmeubleContacts({
  lead,
  tourAnchor,
}: {
  lead: Lead;
  /** Ancre visite guidée (numéros pros à l'adresse). */
  tourAnchor?: string;
}) {
  const contacts = lead.contactsImmeuble ?? [];
  if (contacts.length === 0) return null;
  // Section directe (pas de wrapper) pour garder le filet border-t des DetailSection.
  return <ImmeubleContactsSection contacts={contacts} tourAnchor={tourAnchor} />;
}
