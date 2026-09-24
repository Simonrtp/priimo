'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Filters, Lead, LeadStage } from '@/types/lead';
import { matchesLeadFilters } from '@/lib/lead-filters';
import { sortProspects } from '@/lib/lead-dpe';
import { sousGroupesAgence, type GroupesSecteur, type StatistiqueZone } from '@/lib/zones/leads';
import LeadCard from '../LeadCard';
import EmptyState from '../EmptyState';

/**
 * La liste de prospection découpée par secteur.
 *
 * L'ordre de lecture est le message : ce dont l'agent est responsable, puis ce
 * qu'il a pris ailleurs, puis la file agence — repliée, parce qu'on ne veut pas
 * qu'il commence sa journée dedans. Chaque lead de cette file porte la raison
 * de sa présence, sinon elle redevient un dépotoir.
 *
 * Le portillon ne change pas : le bouton de prise reste le seul moyen de
 * s'attribuer un lead, y compris dans son propre secteur.
 */

type Actions = {
  filters: Filters;
  nouveauxIds: ReadonlySet<string>;
  onLeadClick: (id: string) => void;
  onStatusChange: (id: string, status: Lead['status']) => void;
  stages?: readonly LeadStage[];
  onTake?: (id: string, origine?: HTMLElement) => void;
  onStageChange?: (id: string, stageId: string) => void;
};

const LISTE_CLASS =
  'flex w-full min-w-0 flex-col gap-2 md:grid md:grid-cols-2 md:gap-3 lg:flex lg:flex-col lg:gap-0 lg:overflow-hidden lg:rounded-clay-lg lg:bg-white lg:shadow-clay';

const SOUS_TITRE_CLASS =
  'text-[9px] uppercase text-mute md:col-span-2 max-lg:px-1 max-lg:pt-1 lg:border-t lg:border-black/[0.05] lg:bg-bg-subtle lg:px-6 lg:py-2';

function ordonner(leads: readonly Lead[], filters: Filters): Lead[] {
  return sortProspects(
    leads.filter((lead) => matchesLeadFilters(lead, filters)),
    filters.sortBy,
  );
}

/** Index continu d'une section à l'autre : la cascade d'entrée reste régulière. */
function creerCompteur() {
  let index = 0;
  return () => index++;
}

function Cartes({
  leads,
  actions,
  suivant,
  dernier,
}: {
  leads: readonly Lead[];
  actions: Actions;
  suivant: () => number;
  dernier: boolean;
}) {
  const { nouveauxIds, onLeadClick, onStatusChange, stages, onTake, onStageChange } =
    actions;
  return (
    <>
      {leads.map((lead, i) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          index={suivant()}
          isLast={dernier && i === leads.length - 1}
          showNewBadge={nouveauxIds.has(lead.id)}
          onClick={() => onLeadClick(lead.id)}
          onStatusChange={(s) => onStatusChange(lead.id, s)}
          stages={stages}
          onTake={onTake ? (origine) => onTake(lead.id, origine) : undefined}
          onStageChange={onStageChange ? (stageId) => onStageChange(lead.id, stageId) : undefined}
        />
      ))}
    </>
  );
}

/**
 * En-tête de section repliable. Reprend le bouton des « leads précédents » :
 * même hauteur de frappe, même chevron, pour que rien ne paraisse greffé.
 */
function EnteteSection({
  titre,
  detail,
  compteur,
  ouvert,
  onToggle,
  fort,
}: {
  titre: string;
  detail?: string;
  compteur: number;
  ouvert: boolean;
  onToggle: () => void;
  fort?: boolean;
}) {
  return (
    <button
      type="button"
      aria-expanded={ouvert}
      onClick={onToggle}
      className="flex min-h-[48px] w-full items-center gap-2 text-left transition-[box-shadow,border-color] duration-fluid-subtle ease-in-out md:col-span-2 max-lg:rounded-2xl max-lg:border max-lg:border-black/[0.06] max-lg:bg-white max-lg:px-4 max-lg:py-3.5 max-lg:shadow-clay-sm max-lg:hover:border-black/[0.09] max-lg:hover:shadow-clay lg:bg-white lg:px-6 lg:py-4 lg:hover:shadow-[inset_0_0_0_9999px_rgba(10,13,17,0.018)]"
    >
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[13px] leading-snug ${
            fort ? 'font-semibold text-strong' : 'font-semibold text-mute'
          }`}
        >
          {titre} ({compteur})
        </span>
        {detail ? <span className="mt-0.5 block truncate text-[11px] text-mute">{detail}</span> : null}
      </span>
      <ChevronDown
        size={16}
        className={`flex-shrink-0 text-mute transition-transform duration-fluid-subtle ease-in-out ${
          ouvert ? 'rotate-180' : ''
        }`}
        aria-hidden
      />
    </button>
  );
}

export default function LeadsSecteur({
  secteur,
  actions,
  hasAnyLead,
  onResetFilters,
}: {
  secteur: GroupesSecteur<Lead>;
  actions: Actions;
  hasAnyLead: boolean;
  onResetFilters?: () => void;
}) {
  const { filters } = actions;
  const monSecteur = useMemo(() => ordonner(secteur.monSecteur, filters), [secteur.monSecteur, filters]);
  const mesHorsSecteur = useMemo(
    () => ordonner(secteur.mesHorsSecteur, filters),
    [secteur.mesHorsSecteur, filters],
  );
  const groupesAgence = useMemo(() => {
    const filtrée = secteur.agence.filter((x) => matchesLeadFilters(x.lead, filters));
    return sousGroupesAgence(filtrée).map((g) => ({
      ...g,
      leads: sortProspects(g.leads, filters.sortBy),
    }));
  }, [secteur.agence, filters]);

  const [agenceOuverte, setAgenceOuverte] = useState(false);
  const [horsSecteurOuvert, setHorsSecteurOuvert] = useState(true);

  const totalAgence = groupesAgence.reduce((n, g) => n + g.leads.length, 0);
  const total = monSecteur.length + mesHorsSecteur.length + totalAgence;
  const suivant = creerCompteur();

  if (total === 0) {
    return (
      <EmptyState
        variant={hasAnyLead ? 'no-filtered-results' : 'no-leads'}
        onResetFilters={hasAnyLead ? onResetFilters : undefined}
      />
    );
  }

  return (
    <div
      id="prospects-leads-list"
      data-tour="leads-list"
      className={LISTE_CLASS}
    >
      {secteur.zone ? (
        <p className={SOUS_TITRE_CLASS} style={{ letterSpacing: '0.14em' }}>
          Mon secteur · {secteur.zone.nom} ({monSecteur.length})
        </p>
      ) : null}

      {monSecteur.length > 0 ? (
        <Cartes leads={monSecteur} actions={actions} suivant={suivant} dernier={false} />
      ) : secteur.zone ? (
        <p className="text-[13px] text-mute md:col-span-2 max-lg:px-1 lg:px-6 lg:py-4">
          Rien à travailler dans votre secteur pour le moment.
        </p>
      ) : null}

      {mesHorsSecteur.length > 0 ? (
        <>
          <EnteteSection
            titre="Mes leads hors secteur"
            compteur={mesHorsSecteur.length}
            ouvert={horsSecteurOuvert}
            onToggle={() => setHorsSecteurOuvert((v) => !v)}
          />
          {horsSecteurOuvert ? (
            <Cartes leads={mesHorsSecteur} actions={actions} suivant={suivant} dernier={false} />
          ) : null}
        </>
      ) : null}

      {totalAgence > 0 ? (
        <>
          <EnteteSection
            titre="Agence"
            detail="Adresses que personne ne travaille"
            compteur={totalAgence}
            ouvert={agenceOuverte}
            onToggle={() => setAgenceOuverte((v) => !v)}
          />
          {agenceOuverte
            ? groupesAgence.map((groupe, i) => (
                <Fragment key={groupe.cle}>
                  <p className={SOUS_TITRE_CLASS} style={{ letterSpacing: '0.14em' }}>
                    {groupe.titre} ({groupe.leads.length})
                  </p>
                  <Cartes
                    leads={groupe.leads}
                    actions={actions}
                    suivant={suivant}
                    dernier={i === groupesAgence.length - 1}
                  />
                </Fragment>
              ))
            : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Vue directeur : le même écran, mais lu par zone. Un taux de prise bas ne
 * dit pas qu'une zone est pauvre, il dit qu'on ne l'a pas travaillée.
 */
export function LeadsParZone({
  parZone,
  horsZone,
  actions,
  hasAnyLead,
  onResetFilters,
}: {
  parZone: readonly StatistiqueZone<Lead>[];
  horsZone: readonly Lead[];
  actions: Actions;
  hasAnyLead: boolean;
  onResetFilters?: () => void;
}) {
  const { filters } = actions;
  const sections = useMemo(
    () =>
      parZone
        .map((stat) => ({ ...stat, visibles: ordonner(stat.leads, filters) }))
        .filter((stat) => stat.visibles.length > 0),
    [parZone, filters],
  );
  const orphelins = useMemo(() => ordonner(horsZone, filters), [horsZone, filters]);

  const [replies, setReplies] = useState<ReadonlySet<string>>(new Set());
  const basculer = (cle: string) =>
    setReplies((prev) => {
      const next = new Set(prev);
      if (next.has(cle)) next.delete(cle);
      else next.add(cle);
      return next;
    });

  const total = sections.reduce((n, s) => n + s.visibles.length, 0) + orphelins.length;
  const suivant = creerCompteur();

  if (total === 0) {
    return (
      <EmptyState
        variant={hasAnyLead ? 'no-filtered-results' : 'no-leads'}
        onResetFilters={hasAnyLead ? onResetFilters : undefined}
      />
    );
  }

  return (
    <div id="prospects-leads-list" data-tour="leads-list" className={LISTE_CLASS}>
      {sections.map((section) => {
        const ouvert = !replies.has(section.zone.id);
        return (
          <Fragment key={section.zone.id}>
            <EnteteSection
              titre={section.zone.nom}
              compteur={section.visibles.length}
              ouvert={ouvert}
              onToggle={() => basculer(section.zone.id)}
              fort
            />
            {ouvert ? (
              <Cartes leads={section.visibles} actions={actions} suivant={suivant} dernier={false} />
            ) : null}
          </Fragment>
        );
      })}

      {orphelins.length > 0 ? (
        <>
          <EnteteSection
            titre="Hors secteur attribué"
            detail="Adresses qu’aucune zone ne couvre"
            compteur={orphelins.length}
            ouvert={!replies.has('hors-zone')}
            onToggle={() => basculer('hors-zone')}
          />
          {!replies.has('hors-zone') ? (
            <Cartes leads={orphelins} actions={actions} suivant={suivant} dernier />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
