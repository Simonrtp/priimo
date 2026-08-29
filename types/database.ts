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
  /** Mois d'anniversaire 1–12 (sans année). */
  birthday_month?: number | null;
  /** Jour d'anniversaire 1–31. */
  birthday_day?: number | null;
  /** Consentement d'affichage à l'équipe le jour J. */
  birthday_visible_team?: boolean;
  /** Avatar (illustration /avatars/… ou photo). */
  avatar_url?: string | null;
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

export type EstimationCoverageDemandRow = {
  id: string;
  agency_id: string;
  created_by: string | null;
  postal_code: string;
  city: string | null;
  address: string | null;
  created_at: string;
};

export type EstimationCoverageDemandInsert = {
  id?: string;
  agency_id: string;
  created_by?: string | null;
  postal_code: string;
  city?: string | null;
  address?: string | null;
  created_at?: string;
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
  agency_id: string | null;
  source: string;
  origin_url: string | null;
  widget_public_id: string | null;
  contact_id: string | null;
  assigned_to: string | null;
  estimation_price_per_m2: number | null;
  estimation_context: unknown;
  estimation_sources: unknown;
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
  agency_id?: string | null;
  source?: string;
  origin_url?: string | null;
  widget_public_id?: string | null;
  contact_id?: string | null;
  assigned_to?: string | null;
  estimation_price_per_m2?: number | null;
  estimation_context?: unknown;
  estimation_sources?: unknown;
};

/** Configuration du widget embarquable — une ligne par agence. */
/** Prise en main du négociateur — progression et mesure. */
export type AgentOnboardingRow = {
  profile_id: string;
  agency_id: string;
  started_at: string;
  last_seen_at: string;
  current_step: string | null;
  steps_reached: string[];
  steps_skipped: string[];
  duration_seconds: number;
  completed_at: string | null;
  skipped_at: string | null;
  relance_dismissed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentOnboardingInsert = {
  profile_id: string;
  agency_id: string;
  started_at?: string;
  last_seen_at?: string;
  current_step?: string | null;
  steps_reached?: string[];
  steps_skipped?: string[];
  duration_seconds?: number;
  completed_at?: string | null;
  skipped_at?: string | null;
  relance_dismissed_at?: string | null;
};

export type AgencyWidgetRow = {
  agency_id: string;
  public_id: string;
  enabled: boolean;
  display_name: string | null;
  accent_color: string;
  logo_url: string | null;
  allowed_domains: string[];
  daily_cap: number;
  /** Premier chargement constaté depuis un domaine autorisé. */
  first_installed_at: string | null;
  last_seen_at: string | null;
  last_seen_host: string | null;
  install_email_to: string | null;
  install_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgencyWidgetInsert = {
  agency_id: string;
  public_id: string;
  enabled?: boolean;
  display_name?: string | null;
  accent_color?: string;
  logo_url?: string | null;
  allowed_domains?: string[];
  daily_cap?: number;
};

export type EstimationConsentVersionRow = {
  version: string;
  body: string;
  created_at: string;
};

/** Preuve de consentement — insérée une fois, jamais modifiée. */
export type EstimationConsentRow = {
  id: string;
  estimation_request_id: string;
  agency_id: string | null;
  consent_text: string;
  consent_version: string;
  consent_text_sha256: string;
  agency_name_displayed: string | null;
  channel: string;
  consent_at: string;
  ip_address: string | null;
  user_agent: string | null;
  origin_url: string | null;
  widget_public_id: string | null;
  created_at: string;
};

export type EstimationConsentInsert = Omit<EstimationConsentRow, 'id' | 'created_at' | 'consent_at'> & {
  id?: string;
  created_at?: string;
  consent_at?: string;
};

export type AgencyEstimationRow = {
  id: string;
  agency_id: string;
  created_by: string | null;
  address: string;
  postal_code: string | null;
  city: string | null;
  ban_id: string | null;
  parcelle_id: string | null;
  latitude: number | null;
  longitude: number | null;
  property_type: string;
  surface_m2: number;
  rooms: number;
  floor: string | null;
  condition_rating: number | null;
  dpe_class: string | null;
  available: boolean;
  price_value: number | null;
  price_low: number | null;
  price_high: number | null;
  price_per_m2: number | null;
  reliability: number;
  reliability_label: string | null;
  steps: unknown;
  comparables: unknown;
  context: unknown;
  lead_id: string | null;
  contact_id: string | null;
  bien_id: string | null;
  share_token: string | null;
  share_expires_at: string | null;
  share_revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgencyEstimationInsert = {
  id?: string;
  agency_id: string;
  created_by?: string | null;
  address: string;
  postal_code?: string | null;
  city?: string | null;
  ban_id?: string | null;
  parcelle_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  property_type: string;
  surface_m2: number;
  rooms: number;
  floor?: string | null;
  condition_rating?: number | null;
  dpe_class?: string | null;
  available?: boolean;
  price_value?: number | null;
  price_low?: number | null;
  price_high?: number | null;
  price_per_m2?: number | null;
  reliability?: number;
  reliability_label?: string | null;
  steps?: unknown;
  comparables?: unknown;
  context?: unknown;
  lead_id?: string | null;
  contact_id?: string | null;
  bien_id?: string | null;
  share_token?: string | null;
  share_expires_at?: string | null;
  share_revoked_at?: string | null;
  view_count?: number;
  last_viewed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

/* -------------------------------------------------------------------------- */
/* Espace de travail agent : contacts, biens, dictées, échanges                */
/* -------------------------------------------------------------------------- */

export type ContactTypeDb = 'vendeur' | 'acquereur' | 'locataire' | 'gardien' | 'commercant' | 'autre';
export type ContactSourceDb =
  | 'manuel'
  | 'vocal'
  | 'prospection'
  | 'portail'
  | 'site_agence'
  | 'seloger'
  | 'bienici'
  | 'logicimmo'
  | 'leboncoin'
  | 'autre_portail';
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
export type NoteLienEntiteDb = 'contact' | 'bien' | 'lead' | 'immeuble' | 'parcelle';
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
  recontacter_le?: string | null;
  doublon_de?: string | null;
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
  collecte_provenance?: string | null;
  collecte_at?: string | null;
  collecte_base_legale?: string | null;
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
  recontacter_le?: string | null;
  doublon_de?: string | null;
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
  collecte_provenance?: string | null;
  collecte_at?: string | null;
  collecte_base_legale?: string | null;
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
  assigned_to?: string | null;
  est_copropriete?: boolean;
  nombre_lots?: number | null;
  charges_annuelles?: number | null;
  procedure_en_cours?: boolean | null;
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
  assigned_to?: string | null;
  est_copropriete?: boolean;
  nombre_lots?: number | null;
  charges_annuelles?: number | null;
  procedure_en_cours?: boolean | null;
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
  /** Brut conservé à la première édition. */
  transcript_original?: string | null;
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

export type ParcelleAdresseRow = {
  parcelle_id: string;
  ban_id: string;
  source: string | null;
  created_at: string;
  code_postal?: string | null;
};

export type BuildingRow = {
  id: string;
  ban_id: string;
  adresse: string | null;
  adresse_normalisee: string | null;
  code_postal: string | null;
  commune: string | null;
  lat: number | null;
  lng: number | null;
  parcelle_id: string | null;
  updated_at: string;
};

export type BuildingTransactionRow = {
  id: string;
  parcelle_id: string | null;
  ban_id: string | null;
  date_mutation: string;
  valeur_fonciere: number | null;
  surface_reelle_bati: number | null;
  nombre_pieces: number | null;
  type_local: string | null;
  prix_m2: number | null;
  source: string | null;
  id_mutation: string | null;
  created_at: string;
  code_postal?: string | null;
};

export type BuildingDpeRow = {
  id: string;
  ban_id: string;
  date_dpe: string | null;
  etiquette_dpe: string | null;
  etiquette_ges: string | null;
  conso_kwh_m2_an: number | null;
  surface: number | null;
  etage: number | null;
  source: string | null;
  numero_dpe: string | null;
  created_at: string;
  code_postal?: string | null;
};

export type BuildingCoproRow = {
  id: string;
  ban_id: string;
  numero_immatriculation: string | null;
  nombre_lots: number | null;
  periode_construction: string | null;
  procedure_en_cours: boolean | null;
  date_maj: string | null;
  source: string | null;
  created_at: string;
  code_postal?: string | null;
};

export type BuildingActivityRow = {
  ban_id: string;
  nb_transactions_3ans: number | null;
  nb_transactions_total: number | null;
  derniere_transaction_le: string | null;
  prix_m2_median: number | null;
  nb_dpe_total: number | null;
  dernier_dpe_le: string | null;
  nb_passoires: number | null;
  nb_lots: number | null;
  procedure_copro: boolean | null;
  activite_score: number | null;
  calcule_le: string | null;
  code_postal?: string | null;
  etiquette_dpe?: string | null;
  dernier_prix?: number | null;
};

export type SortieEventKindDb =
  | 'start'
  | 'pause'
  | 'resume'
  | 'finish'
  | 'rencontre'
  | 'absent'
  | 'passer'
  | 'remove_stop'
  | 'recalc_origin'
  | 'dictee';

export type SortieEventRow = {
  id: string;
  agency_id: string;
  profile_id: string;
  day: string;
  kind: SortieEventKindDb;
  lead_id: string | null;
  stop_key: string | null;
  payload: Record<string, unknown>;
  client_id: string | null;
  created_at: string;
};

export type SortieEventInsert = {
  id?: string;
  agency_id: string;
  profile_id: string;
  day: string;
  kind: SortieEventKindDb;
  lead_id?: string | null;
  stop_key?: string | null;
  payload?: Record<string, unknown>;
  client_id?: string | null;
  created_at?: string;
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

export type AssistantConversationRow = {
  id: string;
  agency_id: string;
  profile_id: string;
  titre: string;
  resume: string | null;
  created_at: string;
  updated_at: string;
};

export type AssistantConversationInsert = {
  id?: string;
  agency_id: string;
  profile_id: string;
  titre?: string;
  resume?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AssistantMessageRole = 'user' | 'assistant';

export type AssistantMessageRow = {
  id: string;
  conversation_id: string;
  role: AssistantMessageRole;
  contenu: string;
  lignes_sources: unknown;
  tokens: number;
  created_at: string;
};

export type AssistantMessageInsert = {
  id?: string;
  conversation_id: string;
  role: AssistantMessageRole;
  contenu: string;
  lignes_sources?: unknown;
  tokens?: number;
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

/* -------------------------------------------------------------------------- */
/* Diffusion portails + captation Gmail (20260837)                            */
/* -------------------------------------------------------------------------- */

export type DiffusionPortailIdDb =
  | 'seloger'
  | 'bienici'
  | 'logicimmo'
  | 'leboncoin'
  | 'ouestfrance'
  | 'autre';

export type DiffusionPortailEtatDb =
  | 'non_configure'
  | 'en_attente'
  | 'connecte'
  | 'erreur'
  | 'suspendu';

export type DiffusionAnnonceStatutDb =
  | 'brouillon'
  | 'en_attente'
  | 'publiee'
  | 'refusee'
  | 'retiree';

export type DiffusionEvenementSensDb = 'sortie' | 'entree' | 'systeme';

export type PortailEmailDomainePortailDb =
  | 'seloger'
  | 'bienici'
  | 'logicimmo'
  | 'leboncoin'
  | 'ouestfrance'
  | 'site_agence'
  | 'autre';

export type GmailConnexionEtatDb = 'actif' | 'revoke' | 'erreur' | 'en_attente_verif_oauth';

export type LeadPortailStatutDb =
  | 'importe'
  | 'a_traiter_main'
  | 'doublon'
  | 'ignore'
  | 'erreur_parse';

export type DiffusionPortailRow = {
  id: string;
  agency_id: string;
  portail: DiffusionPortailIdDb;
  actif: boolean;
  compte_externe_id: string | null;
  etat: DiffusionPortailEtatDb;
  dernier_erreur: string | null;
  meta: unknown;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DiffusionPortailInsert = {
  id?: string;
  agency_id: string;
  portail: DiffusionPortailIdDb;
  actif?: boolean;
  compte_externe_id?: string | null;
  etat?: DiffusionPortailEtatDb;
  dernier_erreur?: string | null;
  meta?: unknown;
  connected_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DiffusionAnnonceRow = {
  id: string;
  agency_id: string;
  bien_id: string;
  portail: DiffusionPortailIdDb;
  statut: DiffusionAnnonceStatutDb;
  reference_portail: string | null;
  cle_idempotence: string;
  publiee_at: string | null;
  retiree_at: string | null;
  dernier_erreur: string | null;
  created_at: string;
  updated_at: string;
};

export type DiffusionAnnonceInsert = {
  id?: string;
  agency_id: string;
  bien_id: string;
  portail: DiffusionPortailIdDb;
  statut?: DiffusionAnnonceStatutDb;
  reference_portail?: string | null;
  cle_idempotence: string;
  publiee_at?: string | null;
  retiree_at?: string | null;
  dernier_erreur?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DiffusionEvenementRow = {
  id: string;
  agency_id: string;
  annonce_id: string | null;
  bien_id: string | null;
  portail: string | null;
  sens: DiffusionEvenementSensDb;
  kind: string;
  message: string;
  payload: unknown;
  created_at: string;
};

export type DiffusionEvenementInsert = {
  id?: string;
  agency_id: string;
  annonce_id?: string | null;
  bien_id?: string | null;
  portail?: string | null;
  sens?: DiffusionEvenementSensDb;
  kind: string;
  message: string;
  payload?: unknown;
  created_at?: string;
};

export type PortailEmailDomaineRow = {
  id: string;
  domaine: string;
  portail: PortailEmailDomainePortailDb;
  actif: boolean;
  agency_id: string | null;
  created_at: string;
};

export type PortailEmailDomaineInsert = {
  id?: string;
  domaine: string;
  portail: PortailEmailDomainePortailDb;
  actif?: boolean;
  agency_id?: string | null;
  created_at?: string;
};

/** bytea sérialisé côté PostgREST (souvent `\x…` hex ou base64). */
export type GmailConnexionRow = {
  id: string;
  agency_id: string;
  profile_id: string;
  gmail_address: string;
  token_ciphertext: string;
  token_nonce: string;
  scopes: string[];
  watch_history_id: string | null;
  watch_expiration: string | null;
  pubsub_topic: string | null;
  etat: GmailConnexionEtatDb;
  dernier_erreur: string | null;
  connected_at: string;
  updated_at: string;
};

export type GmailConnexionInsert = {
  id?: string;
  agency_id: string;
  profile_id: string;
  gmail_address: string;
  token_ciphertext: string;
  token_nonce: string;
  scopes?: string[];
  watch_history_id?: string | null;
  watch_expiration?: string | null;
  pubsub_topic?: string | null;
  etat?: string;
  dernier_erreur?: string | null;
  connected_at?: string;
  updated_at?: string;
};

export type LeadPortailRow = {
  id: string;
  agency_id: string;
  portail: string;
  gmail_message_id: string;
  contact_id: string | null;
  bien_id: string | null;
  annonce_id: string | null;
  statut: LeadPortailStatutDb;
  nom: string | null;
  telephone: string | null;
  email: string | null;
  reference_annonce: string | null;
  type_demande: string | null;
  message_extrait: string | null;
  demande_at: string | null;
  parse_erreur: string | null;
  created_at: string;
};

export type LeadPortailInsert = {
  id?: string;
  agency_id: string;
  portail: string;
  gmail_message_id: string;
  contact_id?: string | null;
  bien_id?: string | null;
  annonce_id?: string | null;
  statut?: LeadPortailStatutDb;
  nom?: string | null;
  telephone?: string | null;
  email?: string | null;
  reference_annonce?: string | null;
  type_demande?: string | null;
  message_extrait?: string | null;
  demande_at?: string | null;
  parse_erreur?: string | null;
  created_at?: string;
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
      estimation_coverage_demands: {
        Row: EstimationCoverageDemandRow;
        Insert: EstimationCoverageDemandInsert;
        Update: Partial<EstimationCoverageDemandRow>;
        Relationships: [];
      };
      estimation_requests: {
        Row: EstimationRequestRow;
        Insert: EstimationRequestInsert;
        Update: Partial<EstimationRequestRow>;
        Relationships: [];
      };
      agency_estimations: {
        Row: AgencyEstimationRow;
        Insert: AgencyEstimationInsert;
        Update: Partial<AgencyEstimationRow>;
        Relationships: [];
      };
      agent_onboarding: {
        Row: AgentOnboardingRow;
        Insert: AgentOnboardingInsert;
        Update: Partial<AgentOnboardingRow>;
        Relationships: [];
      };
      agency_widgets: {
        Row: AgencyWidgetRow;
        Insert: AgencyWidgetInsert;
        Update: Partial<AgencyWidgetRow>;
        Relationships: [];
      };
      estimation_consents: {
        Row: EstimationConsentRow;
        Insert: EstimationConsentInsert;
        Update: never;
        Relationships: [];
      };
      estimation_consent_versions: {
        Row: EstimationConsentVersionRow;
        Insert: EstimationConsentVersionRow;
        Update: Partial<EstimationConsentVersionRow>;
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
      parcelle_adresses: {
        Row: ParcelleAdresseRow;
        Insert: ParcelleAdresseRow;
        Update: Partial<ParcelleAdresseRow>;
        Relationships: [];
      };
      buildings: {
        Row: BuildingRow;
        Insert: Omit<BuildingRow, 'id'> & { id?: string };
        Update: Partial<BuildingRow>;
        Relationships: [];
      };
      building_transactions: {
        Row: BuildingTransactionRow;
        Insert: Omit<BuildingTransactionRow, 'id'> & { id?: string };
        Update: Partial<BuildingTransactionRow>;
        Relationships: [];
      };
      building_dpe: {
        Row: BuildingDpeRow;
        Insert: Omit<BuildingDpeRow, 'id'> & { id?: string };
        Update: Partial<BuildingDpeRow>;
        Relationships: [];
      };
      building_copro: {
        Row: BuildingCoproRow;
        Insert: Omit<BuildingCoproRow, 'id'> & { id?: string };
        Update: Partial<BuildingCoproRow>;
        Relationships: [];
      };
      building_activity: {
        Row: BuildingActivityRow;
        Insert: BuildingActivityRow;
        Update: Partial<BuildingActivityRow>;
        Relationships: [];
      };
      sortie_events: {
        Row: SortieEventRow;
        Insert: SortieEventInsert;
        Update: Partial<SortieEventInsert>;
        Relationships: [];
      };
      contact_interactions: {
        Row: ContactInteractionRow;
        Insert: ContactInteractionInsert;
        Update: Partial<ContactInteractionRow>;
        Relationships: [
          {
            foreignKeyName: 'contact_interactions_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
        ];
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
      assistant_conversations: {
        Row: AssistantConversationRow;
        Insert: AssistantConversationInsert;
        Update: Partial<AssistantConversationRow>;
        Relationships: [];
      };
      assistant_messages: {
        Row: AssistantMessageRow;
        Insert: AssistantMessageInsert;
        Update: Partial<AssistantMessageRow>;
        Relationships: [
          {
            foreignKeyName: 'assistant_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'assistant_conversations';
            referencedColumns: ['id'];
          },
        ];
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
      diffusion_portails: {
        Row: DiffusionPortailRow;
        Insert: DiffusionPortailInsert;
        Update: Partial<DiffusionPortailRow>;
        Relationships: [];
      };
      diffusion_annonces: {
        Row: DiffusionAnnonceRow;
        Insert: DiffusionAnnonceInsert;
        Update: Partial<DiffusionAnnonceRow>;
        Relationships: [];
      };
      diffusion_evenements: {
        Row: DiffusionEvenementRow;
        Insert: DiffusionEvenementInsert;
        Update: Partial<DiffusionEvenementRow>;
        Relationships: [];
      };
      portail_email_domaines: {
        Row: PortailEmailDomaineRow;
        Insert: PortailEmailDomaineInsert;
        Update: Partial<PortailEmailDomaineRow>;
        Relationships: [];
      };
      gmail_connexions: {
        Row: GmailConnexionRow;
        Insert: GmailConnexionInsert;
        Update: Partial<GmailConnexionRow>;
        Relationships: [];
      };
      leads_portail: {
        Row: LeadPortailRow;
        Insert: LeadPortailInsert;
        Update: Partial<LeadPortailRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      assistant_tokens_du_mois: {
        Args: { p_agency_id: string; p_debut: string };
        Returns: number;
      };
      agency_estimations_today: { Args: { p_agency_id: string }; Returns: number };
      record_widget_seen: { Args: { p_public_id: string; p_host: string | null }; Returns: void };
      current_user_agency_ids: { Args: Record<string, never>; Returns: string[] };
      current_user_agency_id: { Args: Record<string, never>; Returns: string };
      current_user_role: { Args: Record<string, never>; Returns: string };
      refresh_building_activity: {
        Args: { p_codes_postaux: string[]; p_dpe_min_age_months: number };
        Returns: number;
      };
      explain_parcelle_queries: {
        Args: {
          p_codes_postaux: string[];
          p_parcelle_id: string;
          p_south: number;
          p_north: number;
          p_west: number;
          p_east: number;
        };
        Returns: Record<string, unknown>;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
