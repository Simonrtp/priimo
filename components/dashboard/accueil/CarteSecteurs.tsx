'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { COULEUR_FAMILLE, GRIS_NEUTRE } from '@/lib/activite/couleurs';
import { detailSecteurs, type RepartitionEquipe } from '@/lib/activite/repartition';
import type { SecteurPeriode } from '@/lib/activite/secteurs-travailles';
import LignesSurvol from './LignesSurvol';

/** Au repos, deux secteurs : le reste se range sous « +N en plus ». */
const LIGNES_VISIBLES = 2;

const COULEUR = COULEUR_FAMILLE.immeubles_prospectes;

function ListeSecteurs({ secteurs }: { secteurs: readonly SecteurPeriode[] }) {
  const [ouvert, setOuvert] = useState(false);
  const visibles = ouvert ? secteurs : secteurs.slice(0, LIGNES_VISIBLES);
  const reste = secteurs.length - LIGNES_VISIBLES;
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {visibles.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.travaille ? s.couleur : GRIS_NEUTRE.pastelFort }}
            />
            <span className="truncate text-[13px] font-semibold text-text-strong">{s.nom}</span>
          </span>
          <span
            className={`shrink-0 text-[11px] font-semibold ${s.travaille ? '' : 'text-text-muted'}`}
            style={s.travaille ? { color: COULEUR.teinte } : undefined}
          >
            {s.travaille ? 'Travaillé' : 'Pas travaillé'}
          </span>
        </li>
      ))}
      {reste > 0 ? (
        <li>
          <button
            type="button"
            aria-expanded={ouvert}
            onClick={() => setOuvert((v) => !v)}
            className="text-[11px] font-medium text-text-muted hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            {ouvert ? 'Réduire' : `+${reste} en plus`}
          </button>
        </li>
      ) : null}
    </ul>
  );
}

/**
 * Un secteur se travaille ou non. Pas de note sur dix : tant qu’aucun geste
 * n’a touché un bien du secteur, la carte reste vide.
 */
export default function CarteSecteurs({
  secteurs,
  montrerActions,
  equipe = null,
}: {
  secteurs: readonly SecteurPeriode[];
  montrerActions: boolean;
  /** Agence : au survol, qui a travaillé ses secteurs, sans les lister tous. */
  equipe?: readonly RepartitionEquipe[] | null;
}) {
  const seul = secteurs.length === 1 ? secteurs[0] : null;
  const ordre = [...secteurs].sort(
    (a, b) => Number(a.travaille) - Number(b.travaille) || a.nom.localeCompare(b.nom, 'fr'),
  );
  const survol = equipe && equipe.length > 1 ? detailSecteurs(equipe) : null;
  const travailles = secteurs.filter((s) => s.travaille).length;
  const travaille = seul?.travaille === true;
  const teinte = secteurs.length === 0 || travailles === 0 ? GRIS_NEUTRE : COULEUR;

  const resumeAgence = Boolean(survol) && !seul && secteurs.length > 0;
  // Le lien et le détail s’ouvrent par-dessus : un spacer invisible garde la hauteur de la rangée.
  const sePose = montrerActions || resumeAgence || Boolean(survol);

  const carte = (avecLien: boolean) => (
    <>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px]"
          style={{ backgroundColor: teinte.pastelFort }}
        >
          <img src="/bureau.png" alt="" width={36} height={36} className="size-9" />
        </span>
        {seul ? (
          <p
            className="min-w-0 font-display text-[22px] font-bold leading-tight"
            style={{ color: teinte.teinte }}
          >
            {travaille ? 'Travaillé' : 'Pas travaillé'}
          </p>
        ) : secteurs.length === 0 ? (
          <p className="min-w-0 font-display text-[18px] font-bold leading-tight text-text-muted">
            Pas encore de secteur
          </p>
        ) : resumeAgence ? (
          <p className="flex min-w-0 items-baseline gap-1 tabular-nums">
            <span className="font-display text-[28px] font-bold leading-none" style={{ color: teinte.teinte }}>
              {travailles.toLocaleString('fr-FR')}
            </span>
            <span className="text-[13px] font-semibold text-[color:color-mix(in_srgb,var(--text-strong)_55%,transparent)]">
              / {secteurs.length.toLocaleString('fr-FR')}
            </span>
          </p>
        ) : (
          <p className="min-w-0 text-[12px] font-semibold leading-tight text-text-strong">Secteurs travaillés</p>
        )}
      </div>

      {seul ? (
        <>
          <p className="mt-2 text-[12px] font-semibold leading-tight text-text-strong">Secteur travaillé</p>
          <div
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: teinte.pastille }}
            role="progressbar"
            aria-valuenow={travaille ? 100 : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${seul.nom} : ${travaille ? 'travaillé' : 'pas travaillé'}`}
          >
            <span
              className="block h-full w-full origin-left rounded-full"
              style={{
                transform: `scaleX(${travaille ? 1 : 0})`,
                backgroundColor: teinte.teinte,
              }}
            />
          </div>
          <p className="mt-2 truncate text-[12px] font-medium text-text-muted">{seul.nom}</p>
        </>
      ) : secteurs.length === 0 ? null : resumeAgence ? (
        <p className="mt-2 text-[12px] font-semibold leading-tight text-text-strong">Secteurs travaillés</p>
      ) : (
        <ListeSecteurs secteurs={ordre} />
      )}

      {resumeAgence ? (
        <div
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: teinte.pastille }}
          role="progressbar"
          aria-valuenow={secteurs.length === 0 ? 0 : Math.round((travailles / secteurs.length) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${travailles} secteurs travaillés sur ${secteurs.length}`}
        >
          <span
            className="block h-full w-full origin-left rounded-full"
            style={{
              transform: `scaleX(${secteurs.length === 0 ? 0 : travailles / secteurs.length})`,
              backgroundColor: teinte.teinte,
            }}
          />
        </div>
      ) : null}

      {avecLien && survol ? <LignesSurvol detail={survol} /> : null}

      {avecLien && montrerActions ? (
        <div className="fluid-collapse grid-rows-[0fr] motion-reduce:transition-none group-hover/compteur:grid-rows-[1fr] group-focus-within/compteur:grid-rows-[1fr] [@media(hover:none)]:grid-rows-[1fr]">
          <div>
            <div className="pt-2.5">
              <Link
                href="/dashboard/prospection?vue=carte"
                className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-text-strong shadow-clay-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: teinte.pastelFort }}
              >
                Ouvrir la carte
                <ArrowRight size={12} strokeWidth={2.6} />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <li className="relative min-w-0">
      {sePose ? (
        <div className="invisible flex flex-col p-4 [@media(hover:none)]:hidden" aria-hidden>
          {carte(false)}
        </div>
      ) : null}
      <div
        className={`group/compteur flex flex-col rounded-clay-lg p-4 shadow-clay-sm ${
          sePose
            ? 'hover:z-30 focus-within:z-30 [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-x-0 [@media(hover:hover)]:top-0 [@media(hover:hover)]:h-auto [@media(hover:hover)]:min-h-full [@media(hover:none)]:h-full'
            : 'h-full'
        }`}
        style={{ backgroundColor: teinte.voile }}
      >
        {carte(true)}
      </div>
    </li>
  );
}
