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
  | 'pas_vendeur'
  | 'vendeur_ailleurs'
  | 'pas_contacte';
export type LeadOwnerTypeDb = 'particulier' | 'entreprise';
export type AgencyZoneTypeDb = 'radius' | 'postal_codes';

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
  zone_type: AgencyZoneTypeDb | null;
  zone_center_address: string | null;
  zone_latitude: number | null;
  zone_longitude: number | null;
  zone_radius_km: number | null;
  zone_postal_codes: string[] | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  agency_id: string;
  role: ProfileRole;
  first_name: string;
  last_name: string;
  phone: string | null;
  preferences: ProfilePreferences;
  created_at: string;
  updated_at: string;
};

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
  rooms?: number | null;
  floor?: number | null;
  dpe_class: string | null;
  dpe_date: string | null;
  status: LeadStatusDb;
  notes: string | null;
  assigned_to: string | null;
  ml_feedback: LeadMlFeedbackDb | null;
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
  zone_type?: AgencyZoneTypeDb | null;
  zone_center_address?: string | null;
  zone_latitude?: number | null;
  zone_longitude?: number | null;
  zone_radius_km?: number | null;
  zone_postal_codes?: string[] | null;
  stripe_customer_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProfileInsert = {
  id: string;
  agency_id: string;
  role: ProfileRole;
  first_name: string;
  last_name: string;
  phone?: string | null;
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
    };
    Views: { [_ in never]: never };
    Functions: {
      current_user_agency_id: { Args: Record<string, never>; Returns: string };
      current_user_role: { Args: Record<string, never>; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
