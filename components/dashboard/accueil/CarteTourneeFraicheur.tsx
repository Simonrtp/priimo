'use client';

import Image from 'next/image';

/** Les trois gestes du réglage. Trois, pas huit : c'est tout l'argument. */
const ETAPES = [
  'Un nom, puis le contour à main levée sur la carte.',
  'Les rues à retirer, si le voisin en a déjà pris une.',
  'C’est tout. On ne vous le redemandera plus.',
] as const;

const ETAPES_DIRECTION = [
  'Un nom, puis le contour à main levée sur la carte.',
  'Le négociateur qui le tient. Un secteur, un titulaire.',
  'Vos négociateurs peuvent dessiner le leur, vous arbitrez.',
] as const;

/**
 * Personne n'a envie de paramétrer quoi que ce soit. Autant le dire, annoncer
 * la durée réelle, et montrer qu'il n'y a que trois gestes.
 */
export function DessinerMonSecteur({
  estDirecteur,
  onAtelier,
}: {
  estDirecteur: boolean;
  onAtelier: () => void;
}) {
  return (
    <section className="flex h-full items-center gap-6 rounded-clay-lg bg-white p-5 shadow-clay">
      <div className="min-w-0 flex-1">
        <h2 className="text-balance font-semibold text-ink" style={{ fontSize: 16 }}>
          {estDirecteur ? 'Les secteurs de l’agence' : 'Couverture de mon secteur'}
        </h2>

        <p className="mt-3 text-balance text-[15px] font-semibold text-ink">
          Deux minutes, montre en main.
        </p>
        <p className="mt-1 max-w-md text-pretty text-[13.5px] text-mute">
          {estDirecteur
            ? 'Oui, c’est le passage pénible. Le seul. Après ça, la carte se remplit toute seule pendant que votre équipe fait ses tournées.'
            : 'Oui, c’est le passage pénible. Le seul. Après ça, la carte se remplit toute seule pendant que vous faites vos tournées.'}
        </p>

        <ol className="mt-4 flex flex-col gap-2">
          {(estDirecteur ? ETAPES_DIRECTION : ETAPES).map((etape, i) => (
            <li key={etape} className="flex items-start gap-2.5 text-[13px] text-ink">
              <span
                aria-hidden
                className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[11px] font-semibold tabular-nums text-mute"
              >
                {i + 1}
              </span>
              <span className="text-pretty">{etape}</span>
            </li>
          ))}
        </ol>

        {/* Bleu pastel de l'Accueil, texte noir dessus, teinte plus dense au
            survol : le même couple que les boutons KPI. */}
        <button
          type="button"
          onClick={onAtelier}
          className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-clay bg-[#D4E8F5] px-5 text-[14px] font-semibold text-ink shadow-clay-sm transition-[background-color,transform,box-shadow] duration-fluid-subtle ease-in-out hover:-translate-y-0.5 hover:bg-[#A8CCE6] hover:shadow-clay active:translate-y-0 active:shadow-clay-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A8CCE6]"
        >
          {estDirecteur ? 'Définir un secteur' : 'Définir mon secteur'}
        </button>
      </div>

      <Image
        src="/emplacement.png"
        alt=""
        width={152}
        height={152}
        aria-hidden
        className="mr-3 hidden shrink-0 sm:block"
      />
    </section>
  );
}
