import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { LeadStage } from '@/types/lead';
import type {
  ContactPhysiqueRow,
  JournalActivite,
  LecturesJournal,
  NoteRow,
  TransitionRow,
} from '@/lib/activite/derive';
import { journalVide } from '@/lib/activite/derive';
import type { ObjectifRow, ReferenceRow } from '@/lib/activite/objectifs';
import { referenceMetier } from '@/lib/activite/objectifs';
import type { ReferenceMetier } from '@/lib/activite/ratios';
import type { Intervalle } from '@/lib/activite/semaines';

type Client = SupabaseClient<Database>;

/**
 * Lecture des journaux d'activité.
 *
 * Aucun filtre `agency_id` en SQL : les quatre tables lues sont sous RLS et
 * `current_user_agency_id()` fait le travail. Un filtre applicatif en plus ne
 * protégerait rien et masquerait une RLS défaillante le jour où elle casse.
 */

const TAILLE_LOT = 200;

function lots<T>(valeurs: readonly T[], taille = TAILLE_LOT): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < valeurs.length; i += taille) out.push(valeurs.slice(i, i + taille));
  return out;
}

/**
 * Borne ISO élargie d'un jour de chaque côté.
 *
 * `created_at` est un timestamptz, l'intervalle est en jours civils parisiens.
 * Plutôt que de reconstruire le décalage horaire — qui change deux fois par an —
 * on sur-lit d'une journée et la fonction pure recoupe au jour parisien exact.
 */
function borneIso(jour: string, deltaJours: number): string {
  const [y, m, d] = jour.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + deltaJours, 0, 0, 0)).toISOString();
}

/** `ban_id` des leads cités par les transitions, par lot pour éviter un IN géant. */
async function banIdsDesLeads(
  supabase: Client,
  leadIds: readonly string[],
): Promise<Map<string, string | null>> {
  const parLead = new Map<string, string | null>();
  for (const lot of lots(leadIds)) {
    const { data, error } = await supabase.from('leads').select('id, ban_id').in('id', lot);
    if (error) {
      console.error('[activite] ban_id des leads', error.message);
      continue;
    }
    for (const row of (data ?? []) as { id: string; ban_id: string | null }[]) {
      parLead.set(row.id, row.ban_id);
    }
  }
  return parLead;
}

/** Notes rattachées à un immeuble ou à une parcelle, via `note_liens`. */
async function notesRattacheesTerrain(
  supabase: Client,
  noteIds: readonly string[],
): Promise<Set<string>> {
  const rattachees = new Set<string>();
  for (const lot of lots(noteIds)) {
    const { data, error } = await supabase
      .from('note_liens')
      .select('note_id, entite_type')
      .in('note_id', lot)
      .in('entite_type', ['immeuble', 'parcelle']);
    if (error) {
      console.error('[activite] note_liens', error.message);
      continue;
    }
    for (const row of (data ?? []) as { note_id: string }[]) rattachees.add(row.note_id);
  }
  return rattachees;
}

/**
 * Charge la fenêtre entière une seule fois. Le découpage par semaine se fait
 * ensuite en mémoire : douze semaines de journal tiennent largement, et une
 * requête par semaine multiplierait par douze le coût d'un écran d'accueil.
 */
export async function fetchJournalActivite(params: {
  supabase: Client;
  intervalle: Intervalle;
  stages: readonly LeadStage[];
  /**
   * Réservé aux scripts qui tournent en `service_role`, lequel contourne la
   * RLS et verrait donc toutes les agences. En session utilisateur, laisser
   * indéfini : `current_user_agency_id()` fait déjà le tri.
   */
  agencyId?: string;
  /**
   * Inclure les lignes marquées `is_demo`. Faux par défaut : sur l'agence de
   * démonstration, les données fictives et les vraies cohabitent, et un chiffre
   * de démo dans un bilan réel se voit tout de suite quand on le cherche — mais
   * jamais quand on ne le cherche pas.
   */
  inclureDemo?: boolean;
}): Promise<JournalActivite> {
  const { supabase, intervalle, stages, agencyId, inclureDemo = false } = params;
  const depuis = borneIso(intervalle.debut, -1);
  const jusqua = borneIso(intervalle.fin, 2);
  const cleParStage = new Map(stages.map((s) => [s.id, s.cle]));
  const memeAgence = <T extends { eq: (colonne: string, valeur: string) => T }>(q: T): T =>
    agencyId ? q.eq('agency_id', agencyId) : q;

  /**
   * Applique le filtre démo, mais ne meurt pas si la colonne n'existe pas
   * encore. Le code se déploie avant la migration : sans ce repli, quatre
   * compteurs afficheraient « indisponible » sur toutes les agences pendant
   * l'intervalle. Même pratique que `fetchFieldWeek` pour les colonnes BAN.
   */
  async function lire<L extends { error: unknown }>(
    nom: string,
    construire: (avecFiltreDemo: boolean) => PromiseLike<L>,
  ): Promise<L> {
    const premier = await construire(!inclureDemo);
    if (!premier.error || inclureDemo) return premier;
    const message = String((premier.error as { message?: string }).message ?? '');
    if (!/is_demo/.test(message)) return premier;
    console.warn(
      `[activite] ${nom} : colonne is_demo absente, filtre démo inactif — appliquer 20260910_activite_demo_flag.sql.`,
    );
    return construire(false);
  }

  // Rang de progression par étape. `perdu` vaut 0 : perdre n'est pas avancer.
  const rangParCle: Record<string, number> = {};
  for (const st of stages) rangParCle[st.cle] = st.type === 'perdu' ? 0 : st.ordre;

  const [transitionsRes, notesRes, rencontresRes] = await Promise.all([
    lire('lead_stage_events', (filtrer) => {
      const q = memeAgence(
        supabase
          .from('lead_stage_events')
          .select('lead_id, profile_id, from_stage_id, to_stage_id, created_at')
          .gte('created_at', depuis)
          .lt('created_at', jusqua),
      );
      return filtrer ? q.eq('is_demo', false) : q;
    }),
    lire('voice_notes', (filtrer) => {
      const q = memeAgence(
        supabase
          .from('voice_notes')
          .select('id, created_by, created_at, ban_id')
          .gte('created_at', depuis)
          .lt('created_at', jusqua),
      );
      return filtrer ? q.eq('is_demo', false) : q;
    }),
    lire('sortie_events', (filtrer) => {
      const q = memeAgence(
        supabase
          .from('sortie_events')
          .select('profile_id, day, lead_id, ban_id')
          .eq('kind', 'rencontre')
          .gte('day', intervalle.debut)
          .lte('day', intervalle.fin),
      );
      return filtrer ? q.eq('is_demo', false) : q;
    }),
  ]);

  if (transitionsRes.error) {
    console.error('[activite] lead_stage_events', transitionsRes.error.message);
  }
  if (notesRes.error) {
    console.error('[activite] voice_notes', notesRes.error.message);
  }
  if (rencontresRes.error) {
    // Table ou colonne ban_id absente si la migration n'est pas encore passée.
    console.error('[activite] sortie_events', rencontresRes.error.message);
  }

  // Remonté jusqu'à l'écran : un compteur dont la source n'a pas répondu
  // n'affiche pas « 0 », il affiche qu'il ne sait pas.
  const lectures: LecturesJournal = {
    transitions: transitionsRes.error ? 'erreur' : 'ok',
    notes: notesRes.error ? 'erreur' : 'ok',
    contactsPhysiques: rencontresRes.error ? 'erreur' : 'ok',
  };

  const transitionsBrutes = (transitionsRes.data ?? []) as {
    lead_id: string;
    profile_id: string | null;
    from_stage_id: string | null;
    to_stage_id: string | null;
    created_at: string;
  }[];
  const notesBrutes = (notesRes.data ?? []) as {
    id: string;
    created_by: string | null;
    created_at: string;
    ban_id: string | null;
  }[];
  const rencontresBrutes = (rencontresRes.data ?? []) as {
    profile_id: string;
    day: string;
    lead_id: string | null;
    ban_id: string | null;
  }[];

  if (
    transitionsBrutes.length === 0 &&
    notesBrutes.length === 0 &&
    rencontresBrutes.length === 0
  ) {
    return { ...journalVide(), lectures, rangParCle };
  }

  const leadIds = [
    ...new Set(
      [
        ...transitionsBrutes.map((t) => t.lead_id),
        ...rencontresBrutes.map((r) => r.lead_id).filter((id): id is string => id !== null),
      ].filter(Boolean),
    ),
  ];
  const [banParLead, rattachees] = await Promise.all([
    banIdsDesLeads(supabase, leadIds),
    notesRattacheesTerrain(
      supabase,
      notesBrutes.map((n) => n.id),
    ),
  ]);

  const transitions: TransitionRow[] = transitionsBrutes.map((t) => ({
    leadId: t.lead_id,
    profileId: t.profile_id,
    depuisCle: t.from_stage_id ? (cleParStage.get(t.from_stage_id) ?? null) : null,
    versCle: t.to_stage_id ? (cleParStage.get(t.to_stage_id) ?? null) : null,
    createdAt: t.created_at,
    banId: banParLead.get(t.lead_id) ?? null,
  }));

  const notes: NoteRow[] = notesBrutes.map((n) => ({
    auteurId: n.created_by,
    createdAt: n.created_at,
    banId: n.ban_id,
    rattacheeTerrain: rattachees.has(n.id) || n.ban_id !== null,
  }));

  const contactsPhysiques: ContactPhysiqueRow[] = rencontresBrutes.map((r) => ({
    profileId: r.profile_id,
    jour: r.day,
    banId: r.ban_id ?? (r.lead_id ? (banParLead.get(r.lead_id) ?? null) : null),
  }));

  return { transitions, notes, contactsPhysiques, lectures, rangParCle };
}

/** Objectifs posés par le directeur pour un collaborateur. */
export async function fetchObjectifs(params: {
  supabase: Client;
  profileId: string;
}): Promise<ObjectifRow[]> {
  const { data, error } = await params.supabase
    .from('activity_goals')
    .select('activite, periode, cible')
    .eq('profile_id', params.profileId);

  if (error) {
    console.error('[activite] activity_goals', error.message);
    return [];
  }
  return (data ?? []) as ObjectifRow[];
}

/**
 * Référence métier de l'agence. `fournie` reste faux tant que le réseau n'a
 * pas transmis ses chiffres, et l'écran doit alors l'annoncer plutôt que
 * d'afficher un nombre nu.
 */
export async function fetchReferenceMetier(params: {
  supabase: Client;
  agencyId: string;
}): Promise<{ reference: ReferenceMetier; fournie: boolean }> {
  const { data, error } = await params.supabase
    .from('agency_activity_settings')
    .select('physiques_par_qualifie, qualifies_par_estimation, estimations_par_mandat')
    .eq('agency_id', params.agencyId)
    .maybeSingle();

  if (error) {
    console.error('[activite] agency_activity_settings', error.message);
    return referenceMetier(null);
  }
  return referenceMetier((data as ReferenceRow | null) ?? null);
}
