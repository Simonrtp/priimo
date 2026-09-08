import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import { entonnoirVide, type EtapeEntonnoir } from '@/lib/activite/entonnoir';
import { FENETRE_SEMAINES, LIBELLE_NIVEAU, type Ratios } from '@/lib/activite/ratios';
import type { Intervalle } from '@/lib/activite/semaines';

/** « 15 juin » — la fenêtre doit être nommée, pas sous-entendue. */
function jourCourt(cle: string): string {
  const [y, m, d] = cle.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12)).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

const TEINTE_ETAPE: Record<EtapeEntonnoir['cle'], string> = {
  // Les leads gardent l'orange produit : c'est ce qui entre dans l'entonnoir.
  leads_pris: '#E8743C',
  contacts_qualifies: COULEUR_FAMILLE.contacts_qualifies.teinte,
  estimations: COULEUR_FAMILLE.estimations.teinte,
  mandats: '#2F7A5A',
};

function Ligne({ etiquette, valeur }: { etiquette: string; valeur: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="min-w-0 text-[12px] text-text-muted">{etiquette}</span>
      <span className="shrink-0 font-display text-[15px] font-bold text-text-strong">{valeur}</span>
    </li>
  );
}

function formate(v: number | null): string {
  if (v === null) return '—';
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

/**
 * Entonnoir et ratios, côte à côte et sous la ligne de flottaison.
 *
 * Les deux lisent la même fenêtre de 12 semaines que la phrase du haut : c'est
 * la condition pour qu'un agent qui descend vérifier retrouve le calcul au lieu
 * de trouver une contradiction.
 */
export default function EntonnoirEtRatios({
  entonnoir,
  ratios,
  fenetre,
}: {
  entonnoir: readonly EtapeEntonnoir[];
  ratios: Ratios;
  fenetre: Intervalle;
}) {
  const vide = entonnoirVide(entonnoir);

  return (
    <section className="grid gap-3 max-md:hidden lg:grid-cols-2">
      <div className="rounded-clay-lg bg-surface p-5 shadow-clay-sm">
        <h2 className="font-display text-[15px] font-bold text-text-strong">
          Mon entonnoir de conversion
        </h2>
        <p className="mt-0.5 text-[11px] text-text-subtle">
          Leads pris entre le {jourCourt(fenetre.debut)} et le {jourCourt(fenetre.fin)}, suivis
          jusqu’à leur étape la plus avancée
        </p>

        {vide ? (
          <p className="mt-4 text-[13px] text-text-muted">
            Rien à dessiner pour l’instant : l’entonnoir se remplit dès que vous prenez votre
            premier lead.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {entonnoir.map((e) => (
              <li key={e.cle}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[12px] font-semibold text-text-muted">
                    {e.libelle}
                  </span>
                  <span className="shrink-0 text-[12px] text-text-subtle">
                    {e.conversion === null ? '' : `${formate(e.conversion)} %`}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-6 min-w-0 flex-1 overflow-hidden rounded-[8px] bg-bg-subtle">
                    <span
                      className="flex h-full items-center rounded-[8px] px-2 text-[11px] font-bold text-white"
                      style={{
                        // 4 % minimum : une barre à zéro reste visible et lisible.
                        width: `${Math.max(4, Math.min(100, e.part))}%`,
                        backgroundColor: TEINTE_ETAPE[e.cle],
                      }}
                    >
                      {e.valeur.toLocaleString('fr-FR')}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-clay-lg bg-surface p-5 shadow-clay-sm">
        <h2 className="font-display text-[15px] font-bold text-text-strong">Mes ratios moyens</h2>
        <p className="mt-0.5 text-[11px] text-text-subtle">
          {LIBELLE_NIVEAU[ratios.niveau]}
          {ratios.niveau === 'personnel'
            ? ` · ${ratios.mandatsRetenus} mandat${ratios.mandatsRetenus > 1 ? 's' : ''}`
            : ''}
        </p>

        <ul className="mt-3 divide-y divide-black/[0.05]">
          <Ligne
            etiquette="Contacts physiques pour 1 qualifié"
            valeur={formate(ratios.physiquesParQualifie)}
          />
          <Ligne
            etiquette="Contacts qualifiés pour 1 estimation"
            valeur={formate(ratios.qualifiesParEstimation)}
          />
          <Ligne
            etiquette="Estimations pour 1 mandat"
            valeur={formate(ratios.estimationsParMandat)}
          />
        </ul>

        {ratios.niveau !== 'personnel' ? (
          <p className="mt-3 rounded-clay bg-surface-2 px-3 py-2 text-[11px] leading-snug text-text-muted">
            {ratios.niveau === 'agence'
              ? 'Ces chiffres sont la moyenne de votre agence. Les vôtres apparaîtront à partir de votre troisième mandat.'
              : ratios.provisoire
                ? 'Valeurs provisoires, en attendant les chiffres de votre réseau. Elles servent de repère, pas d’engagement.'
                : 'Repère métier de votre réseau, en attendant vos propres chiffres.'}
          </p>
        ) : null}
      </div>
    </section>
  );
}
