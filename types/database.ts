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
  ml_feedback: LeadMlFeedbackDb | null;
  ml_feedback_reason?: string | null;
  ml_feedback_at?: string | null;
  /** Vérification marché : présence sur les portails au moment de la livraison. NULL = non vérifié (leads antérieurs). */
  marche_statut?: string | null;
  /** Horodatage de la vérification marché par le pipeline. */
  marche_verifie_le?: string | null;
  /** Date du lot pipeline (YYYY-MM-DD). */
  delivered_at?: string;
  created_at: string;
  updated_at: string;
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
