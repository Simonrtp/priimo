-- Accueil directeur : index pour les agrégations d'équipe (lectures groupées).
-- À appliquer manuellement.

create index if not exists agency_estimations_agency_share_created_idx
  on public.agency_estimations (agency_id, created_at desc)
  where share_token is not null and share_revoked_at is null;

create index if not exists voice_notes_contact_created_idx
  on public.voice_notes (contact_id, created_at desc)
  where contact_id is not null;

create index if not exists lead_stage_events_profile_created_idx
  on public.lead_stage_events (profile_id, created_at desc)
  where profile_id is not null;

create index if not exists biens_agency_mandat_signe_idx
  on public.biens (agency_id, mandat_signe_le)
  where mandat_statut in ('mandat_simple', 'mandat_exclusif');
