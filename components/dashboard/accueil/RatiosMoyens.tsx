import { BarChart3, Info } from 'lucide-react';
import { ACCUEIL, FIELD } from '@/lib/today/field';
import {
  FENETRE_SEMAINES,
  MANDATS_MINIMUM,
  formateRatio,
  type Ratios,
} from '@/lib/activite/ratios';

function Ligne({ un, n, plusieurs }: { un: string; n: number | null; plusieurs: string }) {
  return (
    <p className="text-pretty text-[14px] leading-relaxed text-text sm:text-[14.5px]">
      <span className="font-semibold text-text-strong">1 {un}</span>
      {' pour '}
      <span className="font-semibold tabular-nums text-text-strong">{formateRatio(n)}</span>
      {` ${plusieurs}`}
    </p>
  );
}

function noteActivite(ratios: Ratios): { titre: string; texte: string } {
  if (ratios.niveau !== 'personnel') {
    return {
      titre: 'Ça se construit avec mon activité.',
      texte: `Chaque sortie, chaque note, chaque estimation précise ce chiffre. Le mien apparaît à partir de ${MANDATS_MINIMUM} mandats.`,
    };
  }
  if (ratios.positionMoyenne === 'mieux') {
    return {
      titre: 'Moins de portes que la moyenne.',
      texte: 'C’est mon rythme, calculé sur mes dernières semaines.',
    };
  }
  if (ratios.positionMoyenne === 'moins') {
    return {
      titre: 'Un peu plus de portes, pour l’instant.',
      texte: 'La moyenne bougera au fil des prochaines semaines.',
    };
  }
  return {
    titre: 'Voilà ce qu’il me faut.',
    texte: 'C’est ma moyenne : tant de contacts pour un mandat.',
  };
}

/**
 * Le chiffre que l’agent emporte : combien de contacts pour un mandat.
 * Il n’est pas inventé le premier jour — il se durcit avec l’activité.
 */
export default function RatiosMoyens({ ratios }: { ratios: Ratios }) {
  const aSoi = ratios.niveau === 'personnel';
  const note = noteActivite(ratios);

  return (
    <aside className="flex min-w-0 flex-col">
      <p className="mb-2 text-right text-[11px] text-text-subtle">
        {aSoi
          ? `Sur mes ${FENETRE_SEMAINES} dernières semaines`
          : `Se précisera sur ${FENETRE_SEMAINES} semaines d’activité`}
      </p>
      <div
        className="flex flex-1 flex-col rounded-clay-lg px-5 py-5"
        style={{ backgroundColor: '#EAF1FB' }}
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={16} strokeWidth={2.3} className="shrink-0 text-blue-dark" aria-hidden />
          <h3 className="font-display text-[15px] font-bold text-blue-dark">Mes ratios moyens</h3>
        </div>
        <p className="mt-1.5 text-pretty text-[12.5px] leading-snug text-text-muted">
          {aSoi
            ? 'Ce qu’il me faut, en moyenne, pour signer.'
            : 'Pas encore le mien : il se calcule au fur et à mesure de mon activité.'}
        </p>

        <div className="mt-4 flex flex-col gap-1.5">
          <Ligne un="qualifié" n={ratios.physiquesParQualifie} plusieurs="contacts" />
          <Ligne un="estimation" n={ratios.qualifiesParEstimation} plusieurs="qualifiés" />
        </div>

        <p className="mt-4 text-pretty text-[13.5px] leading-snug text-text-strong">
          Pour un mandat, {aSoi ? 'il me faut en moyenne' : 'compter pour l’instant'}
        </p>
        <p className="mt-1 font-display text-[28px] font-bold leading-none tabular-nums text-blue-dark">
          {formateRatio(ratios.physiquesParMandat)}
          <span className="ml-1.5 text-[15px] font-semibold text-text">contacts</span>
        </p>

        <p
          className="mt-5 flex items-start gap-2 rounded-clay px-3 py-2.5 text-[12.5px] leading-snug text-text"
          style={{ backgroundColor: ACCUEIL.creme }}
        >
          <Info
            size={15}
            strokeWidth={2.2}
            className="mt-0.5 shrink-0"
            style={{ color: FIELD.orange }}
            aria-hidden
          />
          <span className="text-pretty">
            <strong className="font-semibold text-text-strong">{note.titre}</strong>{' '}
            {note.texte}
          </span>
        </p>
      </div>
    </aside>
  );
}
