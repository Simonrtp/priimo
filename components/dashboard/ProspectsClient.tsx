'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Filters, Lead, LeadStage, TeamMember } from '@/types/lead';
import { EMPTY_FILTERS } from '@/types/lead';
import {
  countActiveLeadFilters,
  matchesLeadFilters,
  sanitizeSignalFamilyForLeads,
  sanitizeSortByForLeads,
} from '@/lib/lead-filters';
import { partitionLeadsForDisplay } from '@/lib/lead-delivery';
import { grouperParSecteur, statistiquesParZone } from '@/lib/zones/leads';
import type { Zone } from '@/lib/zones/types';
import type { Annonce } from '@/lib/annonces/types';
import {
  correspondFraicheur,
  LIBELLE_FRAICHEUR,
  type FiltreFraicheur,
} from '@/lib/zones/fraicheur';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { deleteLead as deleteLeadDb } from '@/lib/queries/leads';
import { entreeStage } from '@/lib/queries/lead-stages';
import { nextStagePosition } from '@/lib/pipeline/position';
import { patchLeadPipeline } from '@/lib/pipeline/patch';
import { celebratePipelineVictory, pipelineVictoryKind } from '@/lib/pipeline/victories';
import { leadsDuPipeline } from '@/lib/pipeline/perimetre';
import { leadPipelineCorrespond } from '@/lib/pipeline/filtre';
import { useUser } from '@/lib/hooks/useUser';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import {
  useEmplacementAffiche,
  useNavigationInstantanee,
} from '@/components/dashboard/navigation/NavigationInstantanee';
import { vueProspection } from '@/lib/navigation/cible';
import { invaliderNavigationApresLead } from '@/app/dashboard/_actions/invalider-navigation';
import { pickTourLeadId } from '@/lib/tour-lead';
import { leadListAddressLine } from '@/lib/lead-display';
import { mesurerVolLead, pulseOngletPipeline, type VolLead } from '@/lib/ui/vol-pipeline';
import ProspectsFiltersPanel from './ProspectsFiltersPanel';
import ProspectsListToolbar from './ProspectsListToolbar';
import ProspectsFiltersSheet from './ProspectsFiltersSheet';
import ProspectsViewSwitch, {
  prospectionHref,
  type ProspectionVue,
} from './ProspectsViewSwitch';
import LeadsList from './LeadsList';
import LeadsSecteur, { LeadsParZone } from './prospection/LeadsSecteur';
import AnnoncesListe from './prospection/AnnoncesListe';
import VoletAnnonceFlottant from './annonces/VoletAnnonceFlottant';
import { annonceDuLead } from '@/lib/annonces/annonce-du-lead';
import VolLeadPipeline from './prospection/VolLeadPipeline';
import PipelineUpdateBanner from './PipelineUpdateBanner';
import PipelineBoard from './pipeline/PipelineBoard';
import AjouterBien from './pipeline/AjouterBien';
import LostReasonDialog from './pipeline/LostReasonDialog';
import {
  isPipelineBannerDismissed,
  markPipelineBannerDismissed,
} from '@/lib/ui/pipeline-banner-dismiss';

const LeadDrawer = dynamic(() => import('./LeadDrawer'), { ssr: false });
const LeadFullScreenMobile = dynamic(() => import('./LeadFullScreenMobile'), { ssr: false });

interface ProspectsClientProps {
  initialLeads: Lead[];
  teamMembers: TeamMember[];
  stages: LeadStage[];
  isDirector: boolean;
  initialShowPipelineBanner: boolean;
  initialNewBatchCount: number;
  /** Max createdAt du lot : ferme le bandeau même si le cache RSC le ressert. */
  initialPipelineBannerBatchKey?: string | null;
  initialSelectedLeadId?: string | null;
  listFilter?: 'sans-position' | 'non-assignes-14j' | 'non-pris' | 'estimations' | null;
  memberId?: string | null;
  initialVue?: ProspectionVue;
  /** Découpage interne de l'agence. Vide = l'écran se comporte comme avant. */
  zones?: Zone[];
  fraicheurFilter?: FiltreFraicheur | null;
  /** La Liste : les annonces de particuliers du secteur, à la place des leads. */
  annoncesListe?: { annonces: Annonce[]; profileId: string; annonceId: string | null } | null;
  /** Le Pipeline : une carte venue d'une annonce ouvre le même volet que la Liste. */
  annoncesPipeline?: Annonce[] | null;
}

export default function ProspectsClient({
  initialLeads,
  teamMembers,
  stages,
  isDirector,
  initialShowPipelineBanner,
  initialNewBatchCount,
  initialPipelineBannerBatchKey = null,
  initialSelectedLeadId = null,
  listFilter = null,
  memberId = null,
  initialVue = 'liste',
  zones = [],
  fraicheurFilter = null,
  annoncesListe = null,
  annoncesPipeline = null,
}: ProspectsClientProps) {
  const { profile } = useUser();
  const device = useDevice();
  const router = useRouter();
  const [vueState, setVueState] = useState<ProspectionVue>(initialVue);
  const [stageList, setStageList] = useState<LeadStage[]>(stages);
  const { naviguer } = useNavigationInstantanee();
  // Liste ↔ Pipeline se joue ici, sans attendre le serveur, même demandé
  // depuis le bandeau mobile ; vers la Carte, la pastille part seule et la
  // liste reste jusqu'au squelette de la carte.
  const demandee = vueProspection(useEmplacementAffiche());
  const vue = demandee && demandee !== 'carte' ? demandee : vueState;
  const vueOnglet = demandee ?? vue;

  useEffect(() => {
    setVueState(initialVue);
  }, [initialVue]);
  useEffect(() => {
    setStageList(stages);
  }, [stages]);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [showPipelineBanner, setShowPipelineBanner] = useState(
    () =>
      initialShowPipelineBanner &&
      initialNewBatchCount > 0 &&
      !isPipelineBannerDismissed(initialPipelineBannerBatchKey),
  );

  useEffect(() => {
    if (!initialShowPipelineBanner || initialNewBatchCount <= 0) {
      setShowPipelineBanner(false);
      return;
    }
    if (isPipelineBannerDismissed(initialPipelineBannerBatchKey)) {
      setShowPipelineBanner(false);
      return;
    }
    setShowPipelineBanner(true);
  }, [initialShowPipelineBanner, initialNewBatchCount, initialPipelineBannerBatchKey]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialSelectedLeadId);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [pendingLost, setPendingLost] = useState<{ leadId: string; stageId: string } | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [volsPipeline, setVolsPipeline] = useState<VolLead[]>([]);
  const [pipelineRecherche, setPipelineRecherche] = useState('');

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    setFilters((prev) => {
      let next = sanitizeSignalFamilyForLeads(prev, leads);
      next = sanitizeSortByForLeads(next, leads);
      return next === prev ? prev : next;
    });
  }, [leads]);

  const filtered = useMemo(() => {
    const DAY_MS = 86_400_000;
    return leads.filter((l) => {
      if (!matchesLeadFilters(l, filters)) return false;
      if (memberId && l.assignedTo !== memberId) return false;
      if (listFilter === 'sans-position' && l.banId) return false;
      if (listFilter === 'non-assignes-14j') {
        if (l.assignedTo) return false;
        const t = Date.parse(l.deliveredAt ?? l.createdAt);
        if (!Number.isFinite(t) || Date.now() - t <= 14 * DAY_MS) return false;
      }
      if (listFilter === 'non-pris' && l.stageId != null) return false;
      if (listFilter === 'estimations') {
        const estimation = stageList.find((s) => s.cle === 'estimation');
        if (!estimation || l.stageId !== estimation.id) return false;
      }
      if (fraicheurFilter) {
        if (!l.fraicheur || !correspondFraicheur(l.fraicheur, fraicheurFilter)) return false;
      }
      return true;
    });
  }, [leads, filters, listFilter, memberId, stageList, fraicheurFilter]);

  const partitioned = useMemo(
    () =>
      partitionLeadsForDisplay(
        filtered,
        leads,
        listFilter === 'non-pris' ? 'score' : filters.sortBy,
      ),
    [filtered, leads, filters.sortBy, listFilter],
  );

  /**
   * Le découpage par secteur remplace la partition par lot de livraison sur
   * l'écran par défaut. Quand un lien pointe vers un filtre précis — « non
   * pris », « estimations » —, on garde la liste à plat : l'agent est venu
   * chercher une réponse, pas relire son secteur.
   */
  const parSecteur = zones.length > 0 && listFilter === null && memberId === null;

  /** Les liens vers un filtre précis gardent la liste des leads ; sinon, la Liste montre les annonces. */
  const listeDeLeads = listFilter !== null || fraicheurFilter !== null || memberId !== null;

  const prenoms = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const m of teamMembers) map[m.id] = m.firstName || null;
    return map;
  }, [teamMembers]);

  const secteur = useMemo(() => {
    if (!parSecteur || isDirector || !profile?.id) return null;
    return grouperParSecteur({ leads: filtered, zones, profileId: profile.id, prenoms });
  }, [parSecteur, isDirector, profile?.id, filtered, zones, prenoms]);

  const vueParZone = useMemo(() => {
    if (!parSecteur || !isDirector) return null;
    return statistiquesParZone(filtered, zones);
  }, [parSecteur, isDirector, filtered, zones]);

  /** Les leads du dernier lot gardent leur badge, y compris dans un secteur. */
  const nouveauxIds = useMemo(
    () => new Set(partitioned.newBatch.map((l) => l.id)),
    [partitioned.newBatch],
  );

  /**
   * Compteur du bandeau : un lead laissé au collègue pendant sept jours n'est
   * pas affiché, l'annoncer serait un mensonge de plus dans une file que
   * personne ne lit.
   */
  const compteurAffiche = secteur
    ? secteur.monSecteur.length + secteur.mesHorsSecteur.length + secteur.agence.length
    : filtered.length;

  const pipelineLeads = useMemo(() => {
    const base = leadsDuPipeline(leads);
    const cherche = pipelineRecherche.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    return base.filter((lead) => {
      if (cherche && !leadPipelineCorrespond(lead, cherche)) return false;
      return true;
    });
  }, [leads, pipelineRecherche]);

  const selected = selectedLeadId ? (leads.find((l) => l.id === selectedLeadId) ?? null) : null;
  const annonceSelectionnee = useMemo(
    () => (selected && annoncesPipeline ? annonceDuLead(selected, annoncesPipeline) : null),
    [selected, annoncesPipeline],
  );
  const fermerVolet = useCallback(() => setSelectedLeadId(null), []);

  const applyLeadPatch = useCallback((id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const setVue = useCallback(
    (next: ProspectionVue) => {
      if (next !== 'carte') setVueState(next);
      const params = new URLSearchParams(window.location.search);
      naviguer(prospectionHref(params, next), { remplacer: true });
    },
    [naviguer],
  );

  const updateLeadHandler = useCallback(
    async (id: string, patch: Partial<Lead>) => {
      const previous = leads.find((l) => l.id === id);
      if (!previous) return;
      applyLeadPatch(id, patch);
      try {
        const payload: Record<string, unknown> = {};
        if (patch.status !== undefined) payload.status = patch.status;
        if (patch.notes !== undefined) payload.notes = patch.notes;
        if (patch.assignedTo !== undefined) payload.assignedTo = patch.assignedTo;
        if (patch.mlFeedback !== undefined) payload.mlFeedback = patch.mlFeedback;
        if (patch.mlFeedbackReason !== undefined) payload.mlFeedbackReason = patch.mlFeedbackReason;
        if (patch.mlFeedbackAt !== undefined) payload.mlFeedbackAt = patch.mlFeedbackAt;

        const res = await fetch(`/api/dashboard/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? 'Enregistrement impossible');
        }
      } catch (e) {
        applyLeadPatch(id, previous);
        throw e;
      }
    },
    [applyLeadPatch, leads],
  );

  const onStatusInline = useCallback(
    async (id: string, status: Lead['status']) => {
      try {
        await updateLeadHandler(id, { status });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur lors du changement de statut.');
      }
    },
    [updateLeadHandler],
  );

  const onFiniVol = useCallback((volId: string) => {
    pulseOngletPipeline();
    setVolsPipeline((prev) => prev.filter((v) => v.id !== volId));
  }, []);

  const onTake = useCallback(
    async (id: string, origine?: HTMLElement) => {
      const lead = leads.find((l) => l.id === id);
      const gate = entreeStage(stageList);
      const userId = profile?.id;
      if (!lead || !gate || !userId) {
        toast.error('Impossible d’ajouter ce lead au pipeline pour le moment.');
        return;
      }
      const vol = mesurerVolLead({
        id,
        score: lead.score,
        adresse: leadListAddressLine(lead.address, lead.postalCode, lead.city),
        origine,
      });
      if (vol) {
        setVolsPipeline((prev) => [...prev, vol]);
      } else {
        pulseOngletPipeline();
      }
      const now = new Date().toISOString();
      const stagePosition = nextStagePosition(leads, gate.id);
      applyLeadPatch(id, {
        stageId: gate.id,
        stagePosition,
        takenAt: now,
        assignedTo: userId,
        stageChangedAt: now,
      });
      try {
        await patchLeadPipeline(id, {
          stageId: gate.id,
          stagePosition,
          takenAt: now,
          assignedTo: userId,
          stageChangedAt: now,
        });
        void invaliderNavigationApresLead();
      } catch (e) {
        applyLeadPatch(id, {
          stageId: lead.stageId,
          stagePosition: lead.stagePosition,
          takenAt: lead.takenAt,
          assignedTo: lead.assignedTo,
          stageChangedAt: lead.stageChangedAt,
        });
        toast.error(e instanceof Error ? e.message : 'Le lead n’a pas pu être ajouté au pipeline.');
      }
    },
    [applyLeadPatch, leads, profile?.id, stageList],
  );

  const persistStage = useCallback(
    async (id: string, stageId: string, lostReasonValue?: string) => {
      const lead = leads.find((l) => l.id === id);
      const stage = stageList.find((s) => s.id === stageId);
      if (!lead || !stage || lead.stageId === stageId) return;
      const now = new Date().toISOString();
      const stagePosition = nextStagePosition(
        leads.filter((item) => item.id !== id),
        stageId,
      );
      const optimistic: Partial<Lead> = {
        stageId,
        stagePosition,
        stageChangedAt: now,
        lostReason: stage.type === 'perdu' ? lostReasonValue ?? lead.lostReason : null,
      };
      applyLeadPatch(id, optimistic);
      try {
        await patchLeadPipeline(id, {
          stageId,
          stagePosition,
          stageChangedAt: now,
          lostReason: stage.type === 'perdu' ? lostReasonValue ?? null : null,
        });
        void invaliderNavigationApresLead();
        router.refresh();
        const fromStage = lead.stageId ? stageList.find((s) => s.id === lead.stageId) : null;
        const victory = pipelineVictoryKind(fromStage, stage);
        if (victory) celebratePipelineVictory(victory);
      } catch (e) {
        applyLeadPatch(id, {
          stageId: lead.stageId,
          stagePosition: lead.stagePosition,
          stageChangedAt: lead.stageChangedAt,
          lostReason: lead.lostReason,
        });
        toast.error(e instanceof Error ? e.message : 'L’étape n’a pas pu être enregistrée.');
      }
    },
    [applyLeadPatch, leads, stageList],
  );

  const onStageChange = useCallback(
    (id: string, stageId: string) => {
      const lead = leads.find((l) => l.id === id);
      const stage = stageList.find((s) => s.id === stageId);
      if (!lead || !stage || lead.stageId === stageId) return;
      if (stage.type === 'perdu') {
        setPendingLost({ leadId: id, stageId });
        setLostReason('');
        return;
      }
      void persistStage(id, stageId);
    },
    [leads, persistStage, stageList],
  );

  const deleteLeadHandler = useCallback(
    async (id: string) => {
      if (!isDirector) {
        toast.error('Seul le directeur peut supprimer un lead.');
        return;
      }
      const previous = leads;
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setSelectedLeadId((current) => (current === id ? null : current));
      try {
        await deleteLeadDb(supabase, id);
        toast.success('Lead supprimé');
      } catch (e) {
        setLeads(previous);
        toast.error(e instanceof Error ? e.message : 'Impossible de supprimer le lead.');
        throw e;
      }
    },
    [isDirector, leads, supabase],
  );

  const filterCount = countActiveLeadFilters(filters, { countAssigned: isDirector });
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  useEffect(() => {
    const openTourLead = () => {
      try {
        sessionStorage.setItem('priimo-tour-expand-contacts', '1');
      } catch {
        // sessionStorage indisponible
      }
      const id = pickTourLeadId(filtered.length > 0 ? filtered : leads);
      if (id) setSelectedLeadId(id);
    };
    const closeLead = () => setSelectedLeadId(null);
    window.addEventListener('priimo-tour:open-lead', openTourLead);
    window.addEventListener('priimo-tour:close-lead', closeLead);
    return () => {
      window.removeEventListener('priimo-tour:open-lead', openTourLead);
      window.removeEventListener('priimo-tour:close-lead', closeLead);
    };
  }, [filtered, leads]);

  const dismissPipelineBanner = useCallback(async () => {
    setShowPipelineBanner(false);
    markPipelineBannerDismissed(initialPipelineBannerBatchKey);
    try {
      const res = await fetch('/api/dashboard/leads-last-seen', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Erreur réseau');
      }
      const data = (await res.json()) as { leadsLastSeenAt?: string };
      if (!data.leadsLastSeenAt) {
        throw new Error('Réponse serveur invalide');
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossible de marquer les leads comme vus.');
    }
  }, [initialPipelineBannerBatchKey, router]);

  const switcher = (
    <ProspectsViewSwitch variant="floating" value={vueOnglet} onChange={setVue} />
  );

  const pipeline = vue === 'pipeline';

  return (
    <div
      className={
        pipeline
          ? 'relative flex min-h-0 w-full min-w-0 flex-1 flex-col'
          : 'relative w-full min-w-0 pb-4 pt-2 md:pt-0'
      }
    >
      <VolLeadPipeline vols={volsPipeline} onFini={onFiniVol} />
      {showPipelineBanner && initialNewBatchCount > 0 && vue === 'liste' && (
        <PipelineUpdateBanner
          newCount={initialNewBatchCount}
          onDismiss={() => void dismissPipelineBanner()}
        />
      )}

      {/* Même onglet collé coin haut-droit que sur la Carte, y compris Pipeline. */}
      {device !== 'mobile' ? (
        <div className="pointer-events-none absolute -right-6 -top-6 z-30 isolate lg:-right-8 lg:-top-8">
          <div className="pointer-events-auto">{switcher}</div>
        </div>
      ) : null}
      {device !== 'mobile' && !pipeline ? (
        <div className="mb-4 h-14" aria-hidden />
      ) : null}

      {pipeline ? (
        <div key="pipeline" className="carte-entree flex min-h-0 flex-1 flex-col">
          <div className="mb-3 mt-1 flex shrink-0 flex-wrap items-center gap-2.5">
            <AjouterBien
              onAjoute={(lead) => {
                setLeads((prev) => {
                  const deja = prev.some((l) => l.id === lead.id);
                  return deja ? prev.map((l) => (l.id === lead.id ? lead : l)) : [lead, ...prev];
                });
              }}
            />
            <label className="relative min-w-0 flex-1 sm:flex-none">
              <Search
                size={17}
                strokeWidth={2.2}
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="search"
                value={pipelineRecherche}
                onChange={(e) => setPipelineRecherche(e.target.value)}
                placeholder="Rechercher un bien"
                aria-label="Rechercher un bien"
                className="w-full rounded-full border border-black/[0.10] bg-white py-2.5 pl-11 pr-4 text-[14px] font-medium text-text-strong shadow-clay-sm outline-none placeholder:font-medium placeholder:text-text-muted hover:border-black/[0.14] focus:border-accent/50 focus:ring-2 focus:ring-accent/15 sm:w-[22rem]"
              />
            </label>
            {pipelineLeads.some((lead) => lead.stageId) ? null : (
              <p className="basis-full text-[13px] text-text-muted sm:basis-auto">
                Un bien saisi, une annonce collée, ou une estimation faite.
              </p>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <PipelineBoard
              stages={stageList}
              leads={pipelineLeads}
              teamMembers={teamMembers}
              onLeadsChange={setLeads}
              onOpen={setSelectedLeadId}
              canManageStages
              onStagesChange={setStageList}
            />
          </div>
        </div>
      ) : null}

      {vue === 'liste' && !listeDeLeads ? (
        annoncesListe ? (
          <div key="liste-annonces" className="carte-entree">
            <AnnoncesListe
              annonces={annoncesListe.annonces}
              zones={zones}
              profileId={annoncesListe.profileId}
              directeur={isDirector}
              initialAnnonceId={annoncesListe.annonceId}
            />
          </div>
        ) : (
          <div aria-busy className="carte-entree overflow-hidden rounded-clay-lg bg-white shadow-clay">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 border-t border-black/[0.05] px-6 py-3.5 first:border-t-0">
                <span className="size-28 shrink-0 animate-pulse rounded-[28px] bg-black/[0.05]" />
                <span className="h-3 w-1/3 animate-pulse rounded-full bg-black/[0.05]" />
              </div>
            ))}
          </div>
        )
      ) : null}

      {vue === 'liste' && listeDeLeads ? (
        <>
          <div className="flex flex-col">
            <div className="order-3 mb-3 md:mb-3">
              <ProspectsListToolbar
                count={compteurAffiche}
                filterActiveCount={filterCount}
                onOpenFilters={() => setFiltersSheetOpen(true)}
              />
              {fraicheurFilter ? (
                <p className="mt-1 text-[12.5px] text-mute">
                  {fraicheurFilter === 'a-revoir'
                    ? 'Adresses à revoir'
                    : LIBELLE_FRAICHEUR[fraicheurFilter]}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mb-4 hidden md:block">
            <ProspectsFiltersPanel
              filters={filters}
              onFiltersChange={setFilters}
              teamMembers={teamMembers}
              leads={leads}
              showAssignedFilter={isDirector}
            />
          </div>

          <ProspectsFiltersSheet
            open={filtersSheetOpen}
            onClose={() => setFiltersSheetOpen(false)}
            appliedFilters={filters}
            onApply={setFilters}
            teamMembers={teamMembers}
            leads={leads}
            showAssignedFilter={isDirector}
          />

          {secteur ? (
            <LeadsSecteur
              secteur={secteur}
              actions={{
                filters,
                nouveauxIds,
                onLeadClick: setSelectedLeadId,
                onStatusChange: onStatusInline,
                stages: stageList,
                onTake,
                onStageChange,
              }}
              hasAnyLead={leads.length > 0}
              onResetFilters={resetFilters}
            />
          ) : vueParZone ? (
            <LeadsParZone
              parZone={vueParZone.parZone}
              horsZone={vueParZone.horsZone}
              actions={{
                filters,
                nouveauxIds,
                onLeadClick: setSelectedLeadId,
                onStatusChange: onStatusInline,
                stages: stageList,
                onTake,
                onStageChange,
              }}
              hasAnyLead={leads.length > 0}
              onResetFilters={resetFilters}
            />
          ) : (
            <LeadsList
              newBatch={partitioned.newBatch}
              previousGroups={partitioned.previousGroups}
              filters={filters}
              hasAnyLead={leads.length > 0}
              onLeadClick={setSelectedLeadId}
              onStatusChange={onStatusInline}
              stages={stageList}
              onTake={onTake}
              onStageChange={onStageChange}
              onResetFilters={resetFilters}
            />
          )}
        </>
      ) : null}

      <LostReasonDialog
        open={pendingLost !== null}
        reason={lostReason}
        onReason={setLostReason}
        onCancel={() => {
          setPendingLost(null);
          setLostReason('');
        }}
        onConfirm={() => {
          if (!pendingLost || !lostReason) return;
          const { leadId, stageId } = pendingLost;
          setPendingLost(null);
          void persistStage(leadId, stageId, lostReason);
        }}
      />

      {annonceSelectionnee ? (
        <VoletAnnonceFlottant
          annonce={annonceSelectionnee.annonce}
          soeurs={annonceSelectionnee.soeurs}
          onFermer={fermerVolet}
        />
      ) : null}
      <LeadDrawer
        lead={annonceSelectionnee ? null : selected}
        onClose={() => setSelectedLeadId(null)}
        onUpdateLead={updateLeadHandler}
        onDeleteLead={deleteLeadHandler}
        canAssignLead
        canDeleteLead={isDirector}
        currentUserId={profile?.id ?? null}
        teamMembers={teamMembers}
      />
      {selected && !annonceSelectionnee && (
        <LeadFullScreenMobile
          lead={selected}
          onClose={() => setSelectedLeadId(null)}
          onUpdateLead={updateLeadHandler}
          onDeleteLead={deleteLeadHandler}
          canAssignLead
          canDeleteLead={isDirector}
          currentUserId={profile?.id ?? null}
          teamMembers={teamMembers}
        />
      )}
    </div>
  );
}
