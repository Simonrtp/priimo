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

export type AgencyRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  plan: PlanCode;
  zone_type: string | null;
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
  preferences: Record<string, unknown>;
  leads_last_seen_at?: string | null;
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
  display_signals?: unknown;
  internal_signals?: unknown;
  latitude: number | null;
  longitude: number | null;
  acquired_year: number | null;
  acquired_price: number | null;
  acquired_price_reliable?: boolean | null;
  estimated_value: number | null;
  estimation_low?: number | null;
  estimation_high?: number | null;
  estimation_confidence?: string | null;
  estimation_basis?: string | null;
  plus_value_pct?: number | null;
  rooms?: number | null;
  floor?: number | null;
  dpe_class: string | null;
  dpe_date: string | null;
  status: LeadStatusDb;
  notes: string | null;
  assigned_to: string | null;
  ml_feedback: LeadMlFeedbackDb | null;
  ml_feedback_reason?: string | null;
  ml_feedback_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type InvitationInsert = {
  token: string;
  email: string;
  role: InvitationRole;
  expires_at: string;
  agency_id?: string | null;
  agency_name?: string | null;
  created_by?: string | null;
};

export type Database = {
  public: {
    Tables: {
      agencies: {
        Row: AgencyRow;
        Insert: Partial<AgencyRow>;
        Update: Partial<AgencyRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow>;
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
        Insert: Partial<LeadRow>;
        Update: Partial<LeadRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
