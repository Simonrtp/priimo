export type PlanCode = 'fondateur' | 'standard' | 'premium' | 'reseau';
export type ProfileRole = 'directeur' | 'collaborateur';
export type InvitationRole = ProfileRole;
export type LeadStatusDb =
  | 'nouveau'
  | 'contacte'
  | 'interesse'
  | 'pas_interesse'
  | 'mandat_signe'
  | 'vendeur_ailleurs';
export type LeadMlFeedbackDb =
  | 'mandat_signe'
  | 'vendeur_perdu'
  | 'pas_vendeur'
  | 'injoignable';
export type LeadOwnerTypeDb = 'particulier' | 'entreprise';
export type LeadStageTypeDb = 'entree' | 'intermediaire' | 'gagne' | 'perdu';

export type NotificationPreferences = {
  newLeads: boolean;
  weeklyDigest: boolean;
  productTips: boolean;
};

export type ProfilePreferences = Record<string, unknown>;

export type AgencyRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  plan: PlanCode;
  /** Secteur(s) de prospection — codes postaux couverts par l'agence. */
  codes_postaux: string[];
  /** Coordonnées WGS84 du géocodage BAN de l'adresse de l'agence. */
  latitude: number | null;
  longitude: number | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  /** Agence affichée dans le dashboard ; NULL = première agence (profile_agencies). */
  active_agency_id?: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  preferences: ProfilePreferences;
  /** Dernière visite du dashboard prospects (bandeau pipeline). */
  leads_last_seen_at?: string | null;
  /** Visite guidée du dashboard terminée (ou passée) — null = à afficher au prochain login. */
  onboarding_completed_at?: string | null;
  /** Donnée fictive de démo — supprimable via purge-demo-agency. */
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
};

/** Profil enrichi avec le rôle dans l'agence active (calculé, non stocké en base). */
export type ContextualProfile = ProfileRow & { role: ProfileRole };

export type InvitationRow = {
  id: string;
  token: string;
  email: string;
  role: InvitationRole;
  agency_id: string | null;
  agency_name: string | null;
  created_by: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

export type LeadSignalJson = {
  type: string;
  label: string;
  pts?: number;
  points?: number;
  source?: string;
  category?: string;
};

export type LeadSignalsPayloadJson =
  | LeadSignalJson[]
  | {
      details?: LeadSignalJson[];
      main_signal_label?: string;
    };

export type LeadRow = {
  id: string;
  agency_id: string;
  address: string;
  city: string | null;
  postal_code: string | null;
  property_type: string | null;
  surface_m2: number | null;
  owner_type: LeadOwnerTypeDb;
  company_name: string | null;
  company_director: string | null;
  company_phone: string | null;
  company_email: string | null;
  score: number;
  signals: LeadSignalsPayloadJson;
  /** JSON par famille destiné à l'affichage agent (jamais de points). */
  display_signals?: unknown;
  /** JAMAIS lu côté client — détail pondéré utilisé par le scoring. */
  internal_signals?: unknown;
  latitude: number | null;
  longitude: number | null;
  ban_id?: string | null;
  adresse_normalisee?: string | null;
  geocode_score?: number | null;
  geocode_le?: string | null;
  acquired_year: number | null;
  acquired_price: number | null;
  /** Si renseigné par le pipeline : indique la fiabilité du prix d'achat (DVF). */
  acquired_price_reliable?: boolean | null;
  estimated_value: number | null;
  estimation_low?: number | null;
  estimation_high?: number | null;
  estimation_confidence?: string | null;
  estimation_basis?: string | null;
  plus_value_pct?: number | null;
  rooms?: number | null;
  /** @deprecated colonne héritée VIDE — ne jamais utiliser. Voir `etage` (text). */
  floor?: number | null;
  /** Étage sous forme texte : "RDC", "1", "2"… (source de vérité pour l'affichage). */
  etage?: string | null;
  dpe_class: string | null;
  dpe_date: string | null;
  status: LeadStatusDb;
  notes: string | null;
  assigned_to: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  stage_id?: string | null;
  stage_position?: number | null;
  taken_at?: string | null;
  stage_changed_at?: string | null;
  lost_reason?: string | null;
  ml_feedback: LeadMlFeedbackDb | null;
  ml_feedback_reason?: string | null;
  ml_feedback_at?: string | null;
  /** Vérification marché : présence sur les portails au moment de la livraison. NULL = non vérifié (leads antérieurs). */
  marche_statut?: string | null;
  /** Horodatage de la vérification marché par le pipeline. */
  marche_verifie_le?: string | null;
  /** Nom du propriétaire (pipeline contacts). */
  owner_name?: string | null;
  /** Âge du propriétaire (années). */
  owner_age?: number | null;
  /** Société détentrice éventuelle. */
  owner_company?: string | null;
  /** SIREN de la société détentrice. */
  owner_siren?: string | null;
  /** Téléphone professionnel du contact propriétaire. */
  owner_phone?: string | null;
  /**
   * Qualité du téléphone propriétaire côté pipeline :
   * 'cible' = contact direct ; 'probable' = société immo domiciliée (lien non confirmé).
   */
  owner_phone_source?: string | null;
  /**
   * Meilleur niveau de joignabilité du lead :
   * 'direct' | 'nominatif' | 'immeuble' | 'aucun' (ou null si non renseigné).
   */
  contactabilite?: string | null;
  /** Autres sociétés présentes à l'adresse (jsonb). */
  contacts_immeuble?: unknown;
  /**
   * Ancien script d’appel généré (jsonb). Plus affiché — le récap agent
   * est calculé à la volée depuis la fiche.
   */
  script_approche?: unknown;
  /** Date du lot pipeline (YYYY-MM-DD). */
  delivered_at?: string;
  created_at: string;
  updated_at: string;
};

export type LeadStageRow = {
  id: string;
  agency_id: string;
  cle: string;
  libelle: string;
  ordre: number;
  type: LeadStageTypeDb;
  created_at: string;
};

export type AgencyInsert = {
  name: string;
  id?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  plan?: PlanCode;
  codes_postaux?: string[];
  latitude?: number | null;
  longitude?: number | null;
  stripe_customer_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProfileAgencyRow = {
  profile_id: string;
  agency_id: string;
  role: ProfileRole;
  created_at: string;
};

export type ProfileAgencyInsert = {
  profile_id: string;
  agency_id: string;
  role: ProfileRole;
  created_at?: string;
};

export type ProfileInsert = {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  active_agency_id?: string | null;
  preferences?: ProfilePreferences;
  is_demo?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type InvitationInsert = {
  token: string;
  email: string;
  role: InvitationRole;
  expires_at: string;
  id?: string;
  agency_id?: string | null;
  agency_name?: string | null;
  created_by?: string | null;
  used_at?: string | null;
  created_at?: string;
};

export type LeadInsert = {
  agency_id: string;
  address: string;
  owner_type: LeadOwnerTypeDb;
  score: number;
  id?: string;
  city?: string | null;
  postal_code?: string | null;
  property_type?: string | null;
  surface_m2?: number | null;
  company_name?: string | null;
  company_director?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  signals?: LeadSignalJson[];
  latitude?: number | null;
  longitude?: number | null;
  ban_id?: string | null;
  adresse_normalisee?: string | null;
  geocode_score?: number | null;
  geocode_le?: string | null;
  acquired_year?: number | null;
  acquired_price?: number | null;
  acquired_price_reliable?: boolean | null;
  estimated_value?: number | null;
  rooms?: number | null;
  floor?: number | null;
  dpe_class?: string | null;
  dpe_date?: string | null;
  status?: LeadStatusDb;
  notes?: string | null;
  assigned_to?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  ml_feedback?: LeadMlFeedbackDb | null;
  ml_feedback_reason?: string | null;
  ml_feedback_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AgencyRequestStatusDb = 'en_attente' | 'acceptee' | 'refusee';

export type AgencyRequestRow = {
  id: string;
  requested_by: string;
  agency_name: string;
  address: string;
  codes_postaux: string[];
  message: string | null;
  status: AgencyRequestStatusDb;
  created_at: string;
  handled_at: string | null;
};

export type AgencyRequestInsert = {
  requested_by: string;
  agency_name: string;
  address: string;
  codes_postaux: string[];
  message?: string | null;
  status?: AgencyRequestStatusDb;
  id?: string;
  created_at?: string;
  handled_at?: string | null;
};

export type EstimationRequestRow = {
  id: string;
  created_at: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  postal_code: string | null;
  insee_code: string | null;
  property_type: string | null;
  surface_m2: number | null;
  rooms: number | null;
  floor: string | null;
  has_elevator: boolean | null;
  bathrooms: number | null;
  features: unknown;
  view_type: string | null;
  construction_year: number | null;
  dpe_class: string | null;
  condition_rating: number | null;
  is_owner: boolean | null;
  residence_type: string | null;
  sale_timeline: string | null;
  civility: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  consent_given: boolean;
  consent_text: string | null;
  consent_version: string | null;
  consent_at: string | null;
  consent_ip: string | null;
  consent_user_agent: string | null;
  estimation_low: number | null;
  estimation_value: number | null;
  estimation_high: number | null;
  estimation_confidence: number | null;
  status: string;
  assigned_agency_id: string | null;
  /** Secret opaque — jamais exposé hors API estimation + client funnel. */
  edit_token: string;
};

export type EstimationRequestInsert = {
  id?: string;
  created_at?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  postal_code?: string | null;
  insee_code?: string | null;
  property_type?: string | null;
  surface_m2?: number | null;
  rooms?: number | null;
  floor?: string | null;
  has_elevator?: boolean | null;
  bathrooms?: number | null;
  features?: unknown;
  view_type?: string | null;
  construction_year?: number | null;
  dpe_class?: string | null;
  condition_rating?: number | null;
  is_owner?: boolean | null;
  residence_type?: string | null;
  sale_timeline?: string | null;
  civility?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  consent_given?: boolean;
  consent_text?: string | null;
  consent_version?: string | null;
  consent_at?: string | null;
  consent_ip?: string | null;
  consent_user_agent?: string | null;
  estimation_low?: number | null;
  estimation_value?: number | null;
  estimation_high?: number | null;
  estimation_confidence?: number | null;
  status?: string;
  assigned_agency_id?: string | null;
  edit_token?: string;
};

/* -------------------------------------------------------------------------- */
/* Espace de travail agent : contacts, biens, dictées, échanges                */
/* -------------------------------------------------------------------------- */

export type ContactTypeDb = 'vendeur' | 'acquereur' | 'locataire' | 'autre';
export type ContactSourceDb = 'manuel' | 'vocal' | 'prospection';
export type MandatStatutDb =
  | 'estimation'
  | 'mandat_simple'
  | 'mandat_exclusif'
  | 'compromis'
  | 'vendu'
  | 'archive';
export type HonorairesAChargeDb = 'vendeur' | 'acquereur' | 'partage';
export type DpeLettreDb = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type VoiceNoteStatusDb = 'transcrit' | 'valide' | 'erreur';
export type VoiceNoteVisibiliteDb = 'agence' | 'privee';
export type VoiceNoteStatutDb = 'brute' | 'revue';
export type NoteSourceInfoDb = 'proprietaire' | 'gardien' | 'voisin' | 'tiers' | 'agent';
export type NoteLienEntiteDb = 'contact' | 'bien' | 'lead' | 'immeuble';
export type NoteLienConfianceDb = 'certain' | 'probable';
export type NoteLienCreeParDb = 'agent' | 'extraction' | 'reconciliation';
export type ContactInteractionKindDb = 'note' | 'appel' | 'visite' | 'vocal' | 'email';
export type MandatTypeDb = 'simple' | 'exclusif' | 'semi_exclusif';
export type VisiteInteretDb = 'aucun' | 'tiede' | 'chaud' | 'offre';
export type OffreStatutDb = 'en_attente' | 'acceptee' | 'refusee';
export type PromesseStatutDb = 'a_faire' | 'faite' | 'reportee';
export type PromesseCreeParDb = 'dictee' | 'manuel';
export type RendezVousTypeDb = 'visite' | 'estimation' | 'signature' | 'autre';
export type RendezVousCreeParDb = 'dictee' | 'fiche_bien' | 'manuel';

export type ContactRow = {
  id: string;
  agency_id: string;
  created_by: string | null;
  first_name: string | null;
  last_name: string | null;
  contact_type: ContactTypeDb;
  phone: string | null;
  email: string | null;
  secteur: string | null;
  postal_codes: string[];
  budget_min: number | null;
  budget_max: number | null;
  surface_min: number | null;
  surface_max: number | null;
  rooms_min: number | null;
  summary: string | null;
  last_interaction_at: string | null;
  source: ContactSourceDb;
  lead_id: string | null;
  address?: string | null;
  ban_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  adresse_normalisee?: string | null;
  geocode_score?: number | null;
  geocode_le?: string | null;
  assigned_to?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
};

export type ContactInsert = {
  id?: string;
  agency_id: string;
  created_by?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  contact_type?: ContactTypeDb;
  phone?: string | null;
  email?: string | null;
  secteur?: string | null;
  postal_codes?: string[];
  budget_min?: number | null;
  budget_max?: number | null;
  surface_min?: number | null;
  surface_max?: number | null;
  rooms_min?: number | null;
  summary?: string | null;
  last_interaction_at?: string | null;
  source?: ContactSourceDb;
  lead_id?: string | null;
  address?: string | null;
  ban_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  adresse_normalisee?: string | null;
  geocode_score?: number | null;
  geocode_le?: string | null;
  assigned_to?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  is_demo?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type BienRow = {
  id: string;
  agency_id: string;
  created_by: string | null;
  address: string;
  city: string | null;
  postal_code: string | null;
  property_type: string | null;
  surface_m2: number | null;
  rooms: number | null;
  price: number | null;
  mandat_statut: MandatStatutDb;
  proprietaire_contact_id: string | null;
  lead_id: string | null;
  ban_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  adresse_normalisee?: string | null;
  geocode_score?: number | null;
  geocode_le?: string | null;
  notes: string | null;
  listing_title: string | null;
  listing_description: string | null;
  photos: string[];
  dpe_lettre: DpeLettreDb | null;
  dpe_kwh: number | null;
  ges_lettre: DpeLettreDb | null;
  ges_kg_co2: number | null;
  dpe_vierge: boolean;
  dpe_date: string | null;
  honoraires_montant: number | null;
  honoraires_a_charge: HonorairesAChargeDb | null;
  honoraires_pourcent: number | null;
  mandat_numero: string | null;
  mandat_date: string | null;
  mandat_type: MandatTypeDb | null;
  mandat_signe_le: string | null;
  mandat_duree_mois: number;
  mandat_irrevocable_jusqu_au: string | null;
  prix_initial: number | null;
  derniere_baisse_le: string | null;
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
};

export type BienInsert = {
  id?: string;
  agency_id: string;
  created_by?: string | null;
  address: string;
  city?: string | null;
  postal_code?: string | null;
  property_type?: string | null;
  surface_m2?: number | null;
  rooms?: number | null;
  price?: number | null;
  mandat_statut?: MandatStatutDb;
  proprietaire_contact_id?: string | null;
  lead_id?: string | null;
  ban_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  adresse_normalisee?: string | null;
  geocode_score?: number | null;
  geocode_le?: string | null;
  notes?: string | null;
  listing_title?: string | null;
  listing_description?: string | null;
  photos?: string[];
  dpe_lettre?: DpeLettreDb | null;
  dpe_kwh?: number | null;
  ges_lettre?: DpeLettreDb | null;
  ges_kg_co2?: number | null;
  dpe_vierge?: boolean;
  dpe_date?: string | null;
  honoraires_montant?: number | null;
  honoraires_a_charge?: HonorairesAChargeDb | null;
  honoraires_pourcent?: number | null;
  mandat_numero?: string | null;
  mandat_date?: string | null;
  mandat_type?: MandatTypeDb | null;
  mandat_signe_le?: string | null;
  mandat_duree_mois?: number;
  mandat_irrevocable_jusqu_au?: string | null;
  prix_initial?: number | null;
  derniere_baisse_le?: string | null;
  is_demo?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type VoiceNoteRow = {
  id: string;
  agency_id: string;
  created_by: string | null;
  /** Chemin dans le bucket PRIVÉ `voice-notes`. Jamais exposé au navigateur. */
  storage_path: string;
  duration_seconds: number | null;
  mime_type: string | null;
  transcript: string | null;
  structured: unknown;
  status: VoiceNoteStatusDb;
  contact_id: string | null;
  ban_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  adresse_normalisee?: string | null;
  geocode_score?: number | null;
  geocode_le?: string | null;
  assigned_to?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  visibilite?: VoiceNoteVisibiliteDb;
  source_info?: NoteSourceInfoDb | null;
  statut?: VoiceNoteStatutDb;
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
};

export type VoiceNoteInsert = {
  id?: string;
  agency_id: string;
  created_by?: string | null;
  storage_path: string;
  duration_seconds?: number | null;
  mime_type?: string | null;
  transcript?: string | null;
  structured?: unknown;
  status?: VoiceNoteStatusDb;
  contact_id?: string | null;
  ban_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  adresse_normalisee?: string | null;
  geocode_score?: number | null;
  geocode_le?: string | null;
  assigned_to?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  visibilite?: VoiceNoteVisibiliteDb;
  source_info?: NoteSourceInfoDb | null;
  statut?: VoiceNoteStatutDb;
  is_demo?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type NoteLienRow = {
  id: string;
  note_id: string;
  agency_id: string;
  entite_type: NoteLienEntiteDb;
  entite_id: string;
  confiance: NoteLienConfianceDb;
  cree_par: NoteLienCreeParDb;
  cree_le: string;
  is_demo?: boolean;
};

export type NoteLienInsert = {
  id?: string;
  note_id: string;
  agency_id: string;
  entite_type: NoteLienEntiteDb;
  entite_id: string;
  confiance: NoteLienConfianceDb;
  cree_par: NoteLienCreeParDb;
  cree_le?: string;
  is_demo?: boolean;
};

export type ContactInteractionRow = {
  id: string;
  agency_id: string;
  contact_id: string;
  author_id: string | null;
  kind: ContactInteractionKindDb;
  body: string;
  voice_note_id: string | null;
  assigned_to?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  occurred_at: string;
  created_at: string;
  is_demo?: boolean;
};

export type TodayDismissalRow = {
  id: string;
  agency_id: string;
  profile_id: string;
  card_key: string;
  /** NULL = ignorée définitivement. */
  snoozed_until: string | null;
  created_at: string;
};

export type TodayDismissalInsert = {
  id?: string;
  agency_id: string;
  profile_id: string;
  card_key: string;
  snoozed_until?: string | null;
  created_at?: string;
};

export type ContactInteractionInsert = {
  id?: string;
  agency_id: string;
  contact_id: string;
  author_id?: string | null;
  kind?: ContactInteractionKindDb;
  body: string;
  voice_note_id?: string | null;
  assigned_to?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  occurred_at?: string;
  created_at?: string;
  is_demo?: boolean;
};

export type AgencyAlertKindDb = 'baisse_prix' | 'mandat_a_recuperer';

export type AgencyAlertRow = {
  id: string;
  agency_id: string;
  created_by: string;
  kind: AgencyAlertKindDb;
  contact_id: string | null;
  lead_id: string | null;
  body: string | null;
  is_demo?: boolean;
  created_at: string;
};

export type AgencyAlertInsert = {
  id?: string;
  agency_id: string;
  created_by: string;
  kind: AgencyAlertKindDb;
  contact_id?: string | null;
  lead_id?: string | null;
  body?: string | null;
  is_demo?: boolean;
  created_at?: string;
};

export type AssistantQueryRow = {
  id: string;
  agency_id: string;
  profile_id: string;
  question: string;
  detected_type: string;
  lignes_count: number;
  duration_ms: number;
  created_at: string;
};

export type AssistantQueryInsert = {
  id?: string;
  agency_id: string;
  profile_id: string;
  question: string;
  detected_type: string;
  lignes_count?: number;
  duration_ms?: number;
  created_at?: string;
};

export type VisiteRow = {
  id: string;
  agency_id: string;
  bien_id: string;
  contact_id: string | null;
  profile_id: string | null;
  date_visite: string;
  compte_rendu_acquereur_fait_le: string | null;
  compte_rendu_vendeur_fait_le: string | null;
  retour: string | null;
  interet: VisiteInteretDb | null;
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
};

export type VisiteInsert = {
  id?: string;
  agency_id: string;
  bien_id: string;
  contact_id?: string | null;
  profile_id?: string | null;
  date_visite: string;
  compte_rendu_acquereur_fait_le?: string | null;
  compte_rendu_vendeur_fait_le?: string | null;
  retour?: string | null;
  interet?: VisiteInteretDb | null;
  is_demo?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type OffreRow = {
  id: string;
  agency_id: string;
  bien_id: string;
  contact_id: string | null;
  montant: number;
  soumise_le: string;
  validite_jusqu_au: string | null;
  statut: OffreStatutDb;
  compromis_signe_le: string | null;
  financement_echeance: string | null;
  preemption_purgee_le: string | null;
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
};

export type OffreInsert = {
  id?: string;
  agency_id: string;
  bien_id: string;
  contact_id?: string | null;
  montant: number;
  soumise_le?: string;
  validite_jusqu_au?: string | null;
  statut?: OffreStatutDb;
  compromis_signe_le?: string | null;
  financement_echeance?: string | null;
  preemption_purgee_le?: string | null;
  is_demo?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PromesseRow = {
  id: string;
  agency_id: string;
  profile_id: string;
  contact_id: string | null;
  note_id: string | null;
  intitule: string;
  echeance: string;
  statut: PromesseStatutDb;
  cree_par: PromesseCreeParDb;
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
};

export type PromesseInsert = {
  id?: string;
  agency_id: string;
  profile_id: string;
  contact_id?: string | null;
  note_id?: string | null;
  intitule: string;
  echeance: string;
  statut?: PromesseStatutDb;
  cree_par?: PromesseCreeParDb;
  is_demo?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type RendezVousRow = {
  id: string;
  agency_id: string;
  profile_id: string;
  contact_id: string | null;
  bien_id: string | null;
  debut: string;
  fin: string;
  type: RendezVousTypeDb;
  lieu: string | null;
  cree_par: RendezVousCreeParDb;
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
};

export type RendezVousInsert = {
  id?: string;
  agency_id: string;
  profile_id: string;
  contact_id?: string | null;
  bien_id?: string | null;
  debut: string;
  fin: string;
  type?: RendezVousTypeDb;
  lieu?: string | null;
  cree_par?: RendezVousCreeParDb;
  is_demo?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Database = {
  public: {
    Tables: {
      agencies: {
        Row: AgencyRow;
        Insert: AgencyInsert;
        Update: Partial<AgencyRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      invitations: {
        Row: InvitationRow;
        Insert: InvitationInsert;
        Update: Partial<InvitationRow>;
        Relationships: [];
      };
      leads: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: Partial<LeadRow>;
        Relationships: [];
      };
      lead_stages: {
        Row: LeadStageRow;
        Insert: Omit<LeadStageRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<LeadStageRow>;
        Relationships: [];
      };
      profile_agencies: {
        Row: ProfileAgencyRow;
        Insert: ProfileAgencyInsert;
        Update: Partial<ProfileAgencyRow>;
        Relationships: [];
      };
      agency_requests: {
        Row: AgencyRequestRow;
        Insert: AgencyRequestInsert;
        Update: Partial<AgencyRequestRow>;
        Relationships: [];
      };
      estimation_requests: {
        Row: EstimationRequestRow;
        Insert: EstimationRequestInsert;
        Update: Partial<EstimationRequestRow>;
        Relationships: [];
      };
      contacts: {
        Row: ContactRow;
        Insert: ContactInsert;
        Update: Partial<ContactRow>;
        Relationships: [];
      };
      biens: {
        Row: BienRow;
        Insert: BienInsert;
        Update: Partial<BienRow>;
        Relationships: [
          {
            foreignKeyName: 'biens_proprietaire_contact_id_fkey';
            columns: ['proprietaire_contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
        ];
      };
      voice_notes: {
        Row: VoiceNoteRow;
        Insert: VoiceNoteInsert;
        Update: Partial<VoiceNoteRow>;
        Relationships: [];
      };
      note_liens: {
        Row: NoteLienRow;
        Insert: NoteLienInsert;
        Update: Partial<NoteLienRow>;
        Relationships: [];
      };
      contact_interactions: {
        Row: ContactInteractionRow;
        Insert: ContactInteractionInsert;
        Update: Partial<ContactInteractionRow>;
        Relationships: [];
      };
      today_dismissals: {
        Row: TodayDismissalRow;
        Insert: TodayDismissalInsert;
        Update: Partial<TodayDismissalRow>;
        Relationships: [];
      };
      agency_alerts: {
        Row: AgencyAlertRow;
        Insert: AgencyAlertInsert;
        Update: Partial<AgencyAlertRow>;
        Relationships: [];
      };
      assistant_queries: {
        Row: AssistantQueryRow;
        Insert: AssistantQueryInsert;
        Update: Partial<AssistantQueryRow>;
        Relationships: [];
      };
      visites: {
        Row: VisiteRow;
        Insert: VisiteInsert;
        Update: Partial<VisiteRow>;
        Relationships: [
          {
            foreignKeyName: 'visites_bien_id_fkey';
            columns: ['bien_id'];
            isOneToOne: false;
            referencedRelation: 'biens';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visites_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visites_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      offres: {
        Row: OffreRow;
        Insert: OffreInsert;
        Update: Partial<OffreRow>;
        Relationships: [
          {
            foreignKeyName: 'offres_bien_id_fkey';
            columns: ['bien_id'];
            isOneToOne: false;
            referencedRelation: 'biens';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'offres_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
        ];
      };
      promesses: {
        Row: PromesseRow;
        Insert: PromesseInsert;
        Update: Partial<PromesseRow>;
        Relationships: [
          {
            foreignKeyName: 'promesses_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'promesses_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'promesses_note_id_fkey';
            columns: ['note_id'];
            isOneToOne: false;
            referencedRelation: 'voice_notes';
            referencedColumns: ['id'];
          },
        ];
      };
      rendez_vous: {
        Row: RendezVousRow;
        Insert: RendezVousInsert;
        Update: Partial<RendezVousRow>;
        Relationships: [
          {
            foreignKeyName: 'rendez_vous_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rendez_vous_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rendez_vous_bien_id_fkey';
            columns: ['bien_id'];
            isOneToOne: false;
            referencedRelation: 'biens';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      current_user_agency_ids: { Args: Record<string, never>; Returns: string[] };
      current_user_agency_id: { Args: Record<string, never>; Returns: string };
      current_user_role: { Args: Record<string, never>; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
