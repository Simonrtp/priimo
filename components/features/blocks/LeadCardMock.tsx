import { FileText, TrendingUp, Clock, type LucideIcon } from 'lucide-react';
import ScoreRing from '@/components/dashboard/ScoreRing';

// === LEAD CARD MOCK (bloc B) ===
// Reproduction fidèle et STATIQUE d'une carte de lead du tableau de bord Priimo.
// Composant purement visuel : aucune donnée réelle, aucun nom de particulier.
// Réutilise le vrai ScoreRing du dashboard pour un rendu identique.

type MockSignal = {
  Icon: LucideIcon;
  lead: string;
  detail: string;
  tint: string;
  chip: string;
};

const SIGNALS: MockSignal[] = [
  {
    Icon: FileText,
    lead: 'DPE G',
    detail: 'fait il y a 3 semaines',
    tint: '#C2410C',
    chip: '#FFF0E6',
  },
  {
    Icon: TrendingUp,
    lead: 'Cascade de vente',
    detail: '2 ventes dans l’immeuble',
    tint: '#B45309',
    chip: '#FEF3E2',
  },
  {
    Icon: Clock,
    lead: 'Détenu depuis 9 ans',
    detail: 'fenêtre de vente probable',
    tint: '#475569',
    chip: '#EEF2F7',
  },
];

function SignalsBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-gray-400">
        Signaux détectés
      </p>
      <ul className={`mt-2.5 space-y-2 ${compact ? '' : ''}`}>
        {SIGNALS.map(({ Icon, lead, detail, tint, chip }) => (
          <li
            key={lead}
            className="flex items-start gap-2.5 rounded-xl border border-black/[0.04] bg-[#FAFAF9] px-3 py-2.5"
          >
            <span
              className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: chip, color: tint }}
            >
              <Icon size={15} strokeWidth={2.1} aria-hidden />
            </span>
            <p className="min-w-0 text-[13px] leading-snug text-gray-700">
              <span className="font-semibold text-gray-900">{lead}</span>
              <span className="text-gray-400"> — </span>
              {detail}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Gros plan sur le seul bloc « Signaux détectés » — utilisé pour la section
 * « Le pourquoi, toujours affiché ».
 */
export function SignauxCard() {
  return (
    <div className="relative w-full max-w-full min-w-0">
      <div
        className="absolute -inset-3 rounded-[28px] bg-accent/15 blur-2xl opacity-60"
        aria-hidden
      />
      <div className="relative rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_10px_40px_-12px_rgba(17,24,39,0.18)] sm:p-6">
        <SignalsBlock />
        <p className="mt-4 border-t border-black/[0.05] pt-3 text-[12px] leading-relaxed text-gray-500">
          Chaque lead arrive avec ses signaux dépliés. Vous savez pourquoi
          l’adresse est là — donc vous savez quoi dire.
        </p>
      </div>
    </div>
  );
}

export default function LeadCardMock() {
  return (
    <div className="tilt relative w-full max-w-[420px] min-w-0">
      {/* Aura douce, orange discret */}
      <div
        className="absolute -inset-4 rounded-[32px] bg-accent/15 blur-3xl opacity-60"
        aria-hidden
      />
      <div
        className="absolute -inset-6 rounded-[32px] bg-blue/10 blur-3xl opacity-40 -z-10"
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-[20px] border border-black/[0.06] bg-white shadow-[0_24px_60px_-20px_rgba(17,24,39,0.28)]">
        {/* En-tête : score + adresse + statut */}
        <div className="flex items-start gap-3.5 px-5 pt-5">
          <ScoreRing score={91} size={52} />
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue/10 px-2 py-0.5 text-[10.5px] font-medium text-blue-dark">
              <span className="h-1.5 w-1.5 rounded-full bg-[#93B4E0]" aria-hidden />
              Nouveau
            </span>
            <p className="mt-1.5 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-gray-900">
              14 rue de la Folie-Méricourt
            </p>
            <p className="text-[12.5px] text-gray-500">Paris 11e</p>
          </div>
        </div>

        {/* Méta : type · surface · détention */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-5 text-[12.5px] text-gray-500">
          <span>Appartement</span>
          <span className="opacity-40">·</span>
          <span>68 m²</span>
          <span className="opacity-40">·</span>
          <span>Propriétaire depuis 9 ans</span>
        </div>

        {/* Signaux */}
        <div className="mt-4 border-t border-black/[0.05] px-5 py-4">
          <SignalsBlock />
        </div>

        {/* Pied : sources */}
        <div className="flex items-center gap-1.5 border-t border-black/[0.05] px-5 py-3 text-[11px] text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-light" aria-hidden />
          <span>DVF · DPE ADEME · Registre des copropriétés</span>
        </div>
      </div>
    </div>
  );
}
