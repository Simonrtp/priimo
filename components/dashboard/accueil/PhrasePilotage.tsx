import { CircleCheck, Compass, Info, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PhrasePilotage as Phrase, TonPhrase } from '@/lib/activite/phrase';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import { FAMILLES_ACTIVITE, type FamilleActivite } from '@/lib/activite/types';

const ICONE: Record<TonPhrase, LucideIcon> = {
  retard: TrendingDown,
  avance: CircleCheck,
  demarrage: Compass,
  incalculable: Info,
};

const TEINTE_NEUTRE = '#3D5A80';

function teinteDuLevier(phrase: Phrase): string {
  if (phrase.ton === 'avance') return '#2F7A5A';
  if (phrase.levier && (FAMILLES_ACTIVITE as readonly string[]).includes(phrase.levier)) {
    return COULEUR_FAMILLE[phrase.levier as FamilleActivite].teinte;
  }
  return TEINTE_NEUTRE;
}

/**
 * La plus grosse typo de l'écran, et le seul élément qui demande une action.
 *
 * Elle ne porte pas de bouton : le geste est ailleurs — sortir, appeler,
 * qualifier. Lui coller un CTA ferait croire que le logiciel fait le travail.
 */
export default function PhrasePilotage({ phrase }: { phrase: Phrase }) {
  const Icone = ICONE[phrase.ton];
  const teinte = teinteDuLevier(phrase);

  return (
    <section
      aria-live="polite"
      className="rounded-clay-lg bg-surface p-5 shadow-clay sm:p-6"
      style={{ borderLeft: `4px solid ${teinte}` }}
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${teinte}1A`, color: teinte }}
        >
          <Icone size={19} strokeWidth={2.2} />
        </span>
        <p className="font-display text-[21px] font-bold leading-snug text-text-strong sm:text-[30px]">
          {phrase.texte}
        </p>
      </div>
    </section>
  );
}
