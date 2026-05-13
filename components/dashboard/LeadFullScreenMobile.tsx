'use client';

import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, MapPin, MoreVertical, Phone } from 'lucide-react';
import type { Lead, LeadStatus, ProspectOutcome, SignalType } from '@/types/lead';
import { mockAgents } from '@/lib/mock-data';
import {
  ICONS,
  ICON_COLORS,
  ICON_SIZE,
  lifeEventDrawerLabel,
  signalIconForType,
} from '@/lib/iconMapping';
import {
  formatDate,
  formatPrice,
  splitStreetAndCity,
  getStatusLabel,
  scoreTierLabel,
  scoreTierAccentColor,
} from '@/lib/utils';
import { phoneToTelHref } from '@/lib/phone';
import ScoreRing from './ScoreRing';
import LeadDrawerIndividual from './LeadDrawerIndividual';

const signalMeta: Record<SignalType, { label: string; pts: number }> = {
  dissolution_sci: { label: 'Dissolution SCI en cours', pts: 35 },
  liquidation: { label: 'Liquidation (amiable ou judiciaire)', pts: 35 },
  cession_parts: { label: 'Cession de parts sociales', pts: 30 },
  changement_gerant: { label: 'Changement de gérant', pts: 25 },
  deces_associe: { label: "Décès d'associé", pts: 28 },
  dpe_recent: { label: 'DPE refait récemment', pts: 20 },
  dpe_passoire: { label: 'DPE passoire (classes F ou G)', pts: 22 },
  detention_longue: { label: 'Détention longue durée', pts: 15 },
  plus_value: { label: 'Plus-value estimée élevée', pts: 20 },
  travaux_recents: { label: 'Travaux récents (permis SITADEL)', pts: 18 },
  zone_rotation: { label: 'Zone à forte rotation', pts: 12 },
};

const outcomeOptions: {
  value: ProspectOutcome;
  label: string;
  Icon: LucideIcon;
  iconColor: string;
}[] = [
  { value: 'mandat_signe', label: 'Mandat signé', Icon: ICONS.check, iconColor: ICON_COLORS.green600 },
  { value: 'vendu_ailleurs', label: 'Vendu ailleurs', Icon: ICONS.arrowRight, iconColor: ICON_COLORS.info },
  { value: 'pas_vendeur', label: 'Pas vendeur', Icon: ICONS.x, iconColor: ICON_COLORS.error },
  { value: 'pas_contacte', label: 'Pas contacté', Icon: ICONS.pause, iconColor: ICON_COLORS.neutral },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 uppercase tracking-widest text-mute" style={{ fontSize: 9, letterSpacing: '0.18em' }}>
      {children}
    </p>
  );
}

function Divider() {
  return <div className="my-5 h-px bg-black/[0.05]" />;
}

const mapsUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

interface LeadFullScreenMobileProps {
  lead: Lead;
  isPlanPremium: boolean;
  onClose: () => void;
  onUpdateLead: (lead: Lead) => void;
}

export default function LeadFullScreenMobile({ lead, isPlanPremium, onClose, onUpdateLead }: LeadFullScreenMobileProps) {
  const [note, setNote] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setNote('');
    setEntered(false);
    const t = window.setTimeout(() => setEntered(true), 16);
    return () => window.clearTimeout(t);
  }, [lead.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { streetLine, cityZipLine } = splitStreetAndCity(lead.address);
  const plusValue = (((lead.estimatedValue / lead.purchasePrice) - 1) * 100).toFixed(0);
  const totalPts = lead.signalType.reduce((acc, sig) => acc + (signalMeta[sig]?.pts ?? 0), 0);
  const isEnterprise = !!lead.legalForm && lead.segment === 'entreprise';
  const year = new Date(lead.purchaseDate).getFullYear();
  const tierLabel = scoreTierLabel(lead.score);
  const showHotStar = lead.score >= 80;
  const statusOptions: LeadStatus[] = ['nouveau', 'contacté', 'intéressé', 'rdv_pris', 'pas_intéressé'];

  const telHref = phoneToTelHref(lead.directorPhonePro ?? '');
  const mailHref =
    lead.directorEmailPro?.trim() ? `mailto:${lead.directorEmailPro.trim()}` : null;
  const showPremiumGate = isEnterprise && !isPlanPremium;
  const showTel = isEnterprise && isPlanPremium && !!telHref;
  const showMail = isEnterprise && isPlanPremium && !!mailHref;

  const selectCls =
    'w-full min-h-[44px] rounded-lg border border-black/10 px-[14px] text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

  return (
    <div
      className={`fixed inset-0 z-[70] flex flex-col bg-white transition-transform duration-[250ms] ease-out md:hidden ${
        entered ? 'translate-x-0' : 'translate-x-full'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-lead-title"
    >
      <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-black/8 px-2">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-lg px-2 text-[14px] font-medium text-ink"
        >
          <ArrowLeft size={22} strokeWidth={2} aria-hidden />
          Retour
        </button>
        <div className="relative">
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-mute hover:bg-black/[0.05]"
            aria-label="Menu actions"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical size={22} strokeWidth={2} />
          </button>
          {menuOpen && (
            <>
              <button type="button" className="fixed inset-0 z-0" aria-hidden onClick={() => setMenuOpen(false)} />
              <ul className="absolute right-0 top-full z-10 mt-1 min-w-[180px] rounded-xl border border-black/10 bg-white py-1 shadow-lg">
                <li>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-[14px] hover:bg-black/[0.04]"
                    onClick={() => {
                      console.log('[LeadMobile] Archiver', lead.id);
                      setMenuOpen(false);
                    }}
                  >
                    Archiver
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-[14px] hover:bg-black/[0.04]"
                    onClick={() => {
                      console.log('[LeadMobile] Signaler erreur', lead.id);
                      setMenuOpen(false);
                    }}
                  >
                    Signaler une erreur
                  </button>
                </li>
              </ul>
            </>
          )}
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-4"
        style={{ paddingBottom: 'max(7rem, env(safe-area-inset-bottom))' }}
      >
        <h1 id="mobile-lead-title" className="sr-only">
          Détail prospect
        </h1>

        <div className="flex flex-col items-center py-2">
          <ScoreRing score={lead.score} size={64} />
          <p className="mt-2 flex items-center gap-1 font-semibold" style={{ fontSize: 13, color: scoreTierAccentColor(lead.score) }}>
            {showHotStar && (
              <ICONS.star className="flex-shrink-0" size={14} color={scoreTierAccentColor(lead.score)} strokeWidth={2} aria-hidden />
            )}
            {tierLabel}
          </p>
          <p className="mt-3 text-center font-semibold text-ink" style={{ fontSize: 16, lineHeight: 1.35 }}>
            {streetLine}
            {cityZipLine && (
              <>
                <br />
                <span className="font-normal text-mute" style={{ fontSize: 14 }}>
                  {cityZipLine}
                </span>
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {lead.lifeEvent && (() => {
              const { Icon, color, text } = lifeEventDrawerLabel(lead.lifeEvent);
              return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent-dark">
                  <Icon size={14} color={color} strokeWidth={2} aria-hidden />
                  {text}
                </span>
              );
            })()}
            {lead.legalForm && (
              <span className="rounded border border-blue/20 bg-blue/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-dark">
                {lead.legalForm === 'sci' ? 'SCI' : 'SARL'}
              </span>
            )}
          </div>
        </div>

        <Divider />

        {isEnterprise ? (
          <div className="space-y-3">
            {showPremiumGate ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled
                  className="min-h-[48px] rounded-lg bg-black/[0.06] px-2 text-[12px] font-medium text-mute"
                >
                  Appeler — Premium
                </button>
                <button
                  type="button"
                  disabled
                  className="min-h-[48px] rounded-lg bg-black/[0.06] px-2 text-[12px] font-medium text-mute"
                >
                  Email — Premium
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {showTel ? (
                  <a
                    href={telHref!}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-accent px-2 text-center text-[14px] font-semibold text-white"
                  >
                    <Phone size={18} strokeWidth={2} aria-hidden />
                    Appeler
                  </a>
                ) : (
                  <span className="flex min-h-[48px] items-center justify-center rounded-lg bg-black/[0.06] text-[12px] text-mute">
                    Tél. indisponible
                  </span>
                )}
                {showMail ? (
                  <a
                    href={mailHref!}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-black/[0.06] px-2 text-center text-[14px] font-semibold text-ink"
                  >
                    <Mail size={18} strokeWidth={2} aria-hidden />
                    Email
                  </a>
                ) : (
                  <span className="flex min-h-[48px] items-center justify-center rounded-lg bg-black/[0.06] text-[12px] text-mute">
                    Email indisponible
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <a
            href={mapsUrl(lead.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-[15px] font-semibold text-white"
          >
            <MapPin size={20} strokeWidth={2} aria-hidden />
            Ouvrir dans Google Maps
          </a>
        )}

        <Divider />

        {isEnterprise && (
          <>
            <SectionLabel>Société &amp; dirigeant</SectionLabel>
            <div className="rounded-xl border border-black/[0.06] bg-soft-gray/50 px-4 py-3">
              <p className="flex items-center gap-2 font-semibold text-ink" style={{ fontSize: 14 }}>
                <ICONS.building size={ICON_SIZE.sm} color={ICON_COLORS.muted500} strokeWidth={2} aria-hidden />
                {lead.companyName ?? '—'}
              </p>
              {lead.rcs && <p className="mt-1 text-mute" style={{ fontSize: 12 }}>{lead.rcs}</p>}
              <p className="mt-3 font-medium text-ink" style={{ fontSize: 14 }}>
                {lead.directorName ?? '—'}
              </p>
              {isPlanPremium && (
                <p className="mt-2 text-mute" style={{ fontSize: 12 }}>
                  Coordonnées : utilisez les boutons Appeler / Email ci-dessus.
                </p>
              )}
            </div>
            <Divider />
          </>
        )}

        {!isEnterprise && <LeadDrawerIndividual />}

        {!isEnterprise && <Divider />}

        <SectionLabel>Signaux détectés</SectionLabel>
        <div className="flex flex-col gap-4">
          {lead.signalType.map((sig, i) => {
            const m = signalMeta[sig];
            if (!m) return null;
            const src = lead.signalSources[i] ?? 'Source Priimo';
            const { Icon, color } = signalIconForType(sig);
            return (
              <div key={`${sig}-${i}`} className="flex gap-2.5">
                <span className="flex-shrink-0 pt-0.5" aria-hidden>
                  <Icon size={ICON_SIZE.sm} color={color} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-ink" style={{ fontSize: 13 }}>{m.label}</p>
                    <span className="flex-shrink-0 font-semibold tabular text-mute" style={{ fontSize: 12 }}>
                      +{m.pts}
                    </span>
                  </div>
                  <p className="mt-0.5 text-mute" style={{ fontSize: 11 }}>{src}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 font-medium tabular text-mute" style={{ fontSize: 12 }}>
          Total signaux : +{totalPts} pts
        </p>

        <Divider />

        <SectionLabel>Caractéristiques du bien</SectionLabel>
        <ul className="space-y-2.5 text-ink" style={{ fontSize: 13 }}>
          <li className="flex justify-between gap-4">
            <span className="text-mute">Type</span>
            <span className="text-right font-medium">{lead.propertyType}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-mute">Surface</span>
            <span className="font-medium tabular">{lead.surface} m²</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-mute">Prix d&apos;achat</span>
            <span className="font-medium tabular">{formatPrice(lead.purchasePrice)} € ({year})</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-mute">Valeur estimée</span>
            <span className="font-medium tabular">{formatPrice(lead.estimatedValue)} €</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-mute">Plus-value</span>
            <span className="font-medium tabular">+{plusValue}%</span>
          </li>
        </ul>

        <Divider />

        <SectionLabel>Gestion du lead</SectionLabel>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block font-medium text-gray-700" style={{ fontSize: 14 }}>Statut</label>
            <select
              className={selectCls}
              value={lead.status}
              onChange={(e) => onUpdateLead({ ...lead, status: e.target.value as LeadStatus })}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{getStatusLabel(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block font-medium text-gray-700" style={{ fontSize: 14 }}>Assigné à</label>
            <select
              className={selectCls}
              value={lead.assignedAgentId ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                onUpdateLead({ ...lead, assignedAgentId: v === '' ? null : v });
              }}
            >
              <option value="">Non assigné</option>
              {mockAgents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block font-medium text-gray-700" style={{ fontSize: 14 }}>Notes internes</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notes visibles uniquement par votre agence…"
              className="min-h-[88px] w-full rounded-lg border border-black/10 px-[14px] py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
            {lead.notes?.trim() && (
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-soft-warm px-3 py-2 text-ink" style={{ fontSize: 12.5 }}>
                {lead.notes}
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary mt-2 min-h-[44px] w-full"
              style={{ borderRadius: 10, fontSize: 14 }}
              onClick={() => {
                if (!note.trim()) return;
                const stamp = formatDate(new Date().toISOString());
                const addition = note.trim();
                const next = lead.notes?.trim()
                  ? `${lead.notes.trim()}\n\n[${stamp}] ${addition}`
                  : addition;
                onUpdateLead({ ...lead, notes: next });
                setNote('');
              }}
            >
              Enregistrer les notes
            </button>
          </div>
        </div>

        <Divider />

        <SectionLabel>Issue finale du prospect</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {outcomeOptions.map(({ value, label, Icon, iconColor }) => {
            const active = lead.prospectOutcome === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  const next = lead.prospectOutcome === value ? 'none' : value;
                  onUpdateLead({ ...lead, prospectOutcome: next });
                }}
                className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-2 text-center text-[12px] font-semibold ${
                  active
                    ? 'border-accent bg-accent/10 text-accent-dark ring-1 ring-accent/30'
                    : 'border-black/[0.08] bg-white text-ink'
                }`}
              >
                <Icon size={18} color={iconColor} strokeWidth={2} aria-hidden />
                <span className="leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
