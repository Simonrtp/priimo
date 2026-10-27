'use client';

import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import {
  useEmplacementAffiche,
  useNavigationInstantanee,
} from '@/components/dashboard/navigation/NavigationInstantanee';
import ProspectsViewSwitch, { prospectionHref, type ProspectionVue } from '@/components/dashboard/ProspectsViewSwitch';
import RechercheAdresseCarte from '@/components/dashboard/carte/RechercheAdresseCarte';
import { vueProspection } from '@/lib/navigation/cible';

/**
 * Chargement de la prospection, dans la vue demandée. Sur ordinateur, l'onglet
 * Carte / Pipeline / Liste reste au même coin que dans la vraie vue : la
 * pastille qui vient de glisser ne bouge plus quand la page arrive.
 */
export default function SqueletteProspection() {
  const mobile = useDevice() === 'mobile';
  const affiche = useEmplacementAffiche();
  const { naviguer } = useNavigationInstantanee();
  const vue = vueProspection(affiche) ?? 'carte';

  const changerVue = (next: ProspectionVue) =>
    naviguer(prospectionHref(new URLSearchParams(affiche.search), next), { remplacer: true });

  if (vue === 'carte') {
    return (
      <div
        data-prospection-carte
        aria-busy="true"
        className={
          mobile
            ? 'field-map relative h-full min-h-0 w-full overflow-hidden'
            : 'relative flex min-h-0 w-full min-w-0 flex-1 flex-col'
        }
      >
        <span className="sr-only">Chargement de la prospection</span>
        <div
          className={`flex min-h-0 flex-1 gap-3 ${mobile ? 'p-3' : ''}`}
          style={{ height: mobile ? '100%' : undefined }}
        >
          <div className="squelette min-h-0 flex-1 rounded-[28px]" />
          {mobile ? null : <div className="squelette hidden w-72 shrink-0 rounded-[28px] md:block" />}
        </div>
        {mobile ? null : (
          <div className="pointer-events-auto absolute right-0 top-0 z-30 isolate">
            <ProspectsViewSwitch
              variant="floating"
              value="carte"
              onChange={changerVue}
              debut={<RechercheAdresseCarte />}
            />
          </div>
        )}
      </div>
    );
  }

  const pipeline = vue === 'pipeline';
  return (
    <div
      aria-busy="true"
      className={
        pipeline
          ? 'relative flex min-h-0 w-full min-w-0 flex-1 flex-col'
          : 'relative w-full min-w-0 pb-4 pt-2 md:pt-0'
      }
    >
      <span className="sr-only">Chargement de la prospection</span>
      {mobile ? null : (
        <div className="pointer-events-none absolute -right-6 -top-6 z-30 isolate lg:-right-8 lg:-top-8">
          <div className="pointer-events-auto">
            <ProspectsViewSwitch variant="floating" value={vue} onChange={changerVue} />
          </div>
        </div>
      )}
      {mobile || pipeline ? null : <div className="mb-4 h-14" aria-hidden />}

      {pipeline ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 mt-1 flex shrink-0 items-center">
            <span className="squelette h-10 w-40 rounded-full" />
          </div>
          <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
            {[3, 2, 3, 1].map((cartes, colonne) => (
              <div
                key={colonne}
                className="flex w-72 shrink-0 flex-col gap-2.5 rounded-clay-lg bg-black/[0.025] p-3"
              >
                <span className="squelette h-4 w-24 rounded-full" />
                {Array.from({ length: cartes }).map((_, i) => (
                  <span key={i} className="squelette h-24 rounded-clay" />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-clay-lg bg-white shadow-clay">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-t border-black/[0.05] px-4 py-3.5 first:border-t-0 md:px-6"
            >
              <span className="squelette size-20 shrink-0 rounded-[24px] md:size-28 md:rounded-[28px]" />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="squelette h-3.5 w-1/2 rounded-full md:w-1/3" />
                <span className="squelette h-3 w-1/3 rounded-full md:w-1/4" />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
