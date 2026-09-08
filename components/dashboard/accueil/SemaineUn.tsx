import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import type { BilanSemaine } from '@/lib/activite/bilan';
import { FAMILLES_ACTIVITE, LIBELLE_ACTIVITE } from '@/lib/activite/types';

function formate(v: number | null): string {
  return v === null ? '—' : v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

/**
 * L'écran des collaborateurs sans historique.
 *
 * Un nouvel agent qui voit douze blocs à zéro se fait une opinion définitive de
 * l'outil en trois secondes. On lui montre donc ce qui l'attend — ses objectifs
 * et les repères du métier, annoncés comme des repères — et un seul geste à
 * faire. Pas d'entonnoir : il n'aurait rien à dessiner.
 */
export default function SemaineUn({
  bilan,
  prenom,
}: {
  bilan: BilanSemaine;
  prenom: string;
}) {
  const { ratios, mandatsDuMois } = bilan;
  const objectifs = bilan.familles;

  return (
    <section className="rounded-clay-lg bg-surface p-5 shadow-clay sm:p-7">
      <h2 className="font-display text-[20px] font-bold leading-snug text-text-strong sm:text-[24px]">
        {prenom ? `Bienvenue ${prenom}. ` : 'Bienvenue. '}
        Votre première semaine commence.
      </h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-text-muted">
        Cet écran se remplit tout seul à partir de ce que vous faites sur le terrain. Rien à
        saisir le soir : vos notes, vos leads et vos rencontres alimentent les compteurs.
      </p>

      <div className="mt-6">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-text-subtle">
          Vos objectifs de la semaine
        </p>
        <ul className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {objectifs.map((c) => {
            const { teinte, pastille } = COULEUR_FAMILLE[c.activite as (typeof FAMILLES_ACTIVITE)[number]];
            return (
              <li
                key={c.activite}
                className="rounded-clay px-3 py-2.5"
                style={{ backgroundColor: pastille }}
              >
                <p className="font-display text-[19px] font-bold leading-none" style={{ color: teinte }}>
                  {c.objectif}
                </p>
                <p className="mt-1 text-[11px] font-semibold leading-tight text-text-strong">
                  {LIBELLE_ACTIVITE[c.activite]}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] text-text-subtle">
          {bilan.objectifsParDefaut
            ? 'Objectifs proposés par défaut — votre directeur peut les ajuster à tout moment.'
            : 'Objectifs posés par votre directeur.'}
        </p>
      </div>

      <div className="mt-6 rounded-clay bg-surface-2 px-4 py-3.5">
        <p className="text-[12px] font-semibold text-text-strong">
          {ratios.provisoire
            ? 'Repères provisoires, en attendant les chiffres de votre réseau'
            : 'Repères métier de votre réseau'}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
          Il faut en moyenne{' '}
          <strong className="font-semibold text-text-strong">
            {formate(ratios.physiquesParQualifie)} contacts
          </strong>{' '}
          pour un contact qualifié,{' '}
          <strong className="font-semibold text-text-strong">
            {formate(ratios.qualifiesParEstimation)}
          </strong>{' '}
          qualifiés pour une estimation, et{' '}
          <strong className="font-semibold text-text-strong">
            {formate(ratios.estimationsParMandat)}
          </strong>{' '}
          estimations pour un mandat. Objectif du mois :{' '}
          <strong className="font-semibold text-text-strong">
            {mandatsDuMois.objectif} mandat{mandatsDuMois.objectif > 1 ? 's' : ''}
          </strong>
          .
        </p>
        <p className="mt-2 text-[11px] text-text-subtle">
          Ce ne sont pas vos chiffres : les vôtres remplaceront ceux-ci dès votre troisième
          mandat signé.
        </p>
      </div>

      <Link
        href="/dashboard/tournee"
        className="mt-6 inline-flex items-center gap-2 rounded-clay bg-accent px-5 py-3 text-[14px] font-semibold text-white shadow-cta transition hover:bg-accent-dark hover:shadow-ctaHover"
      >
        Préparer ma première sortie
        <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
      </Link>
    </section>
  );
}
