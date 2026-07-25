import { ShieldCheck } from 'lucide-react';
import type { Lead } from '@/types/lead';

const SLATE = '#3D5A80';
const CREAM = '#FFF7F0';

/**
 * Bloc "Vérification marché" : affiché uniquement quand le pipeline a confirmé
 * l'absence du bien sur les portails de vente au moment de la livraison.
 * Les leads antérieurs (marche_statut NULL) n'affichent rien — pas de mention
 * "non vérifié" pour ne pas les dévaloriser.
 */
export default function LeadMarketCheck({
  lead,
  tourAnchor,
}: {
  lead: Lead;
  /** Ancre visite guidée — sur le badge lui-même (pas un wrapper pleine largeur). */
  tourAnchor?: string;
}) {
  if (lead.marcheStatut !== 'hors_marche' || !lead.marcheVerifieLe) return null;

  return (
    <div
      data-tour={tourAnchor}
      className="inline-flex w-fit max-w-full items-center gap-2 rounded-xl border px-3 py-2"
      style={{ backgroundColor: CREAM, borderColor: 'rgba(61,90,128,0.28)', color: SLATE }}
    >
      <ShieldCheck size={16} strokeWidth={2.2} aria-hidden />
      <span style={{ fontSize: 13, fontWeight: 600 }}>Absent des portails de vente</span>
    </div>
  );
}
