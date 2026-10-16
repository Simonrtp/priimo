-- Types de cloche pour les annonces du secteur.
-- La liste reprend intégralement 20260952_notifications_suivi_immeuble.sql.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'leads_livres',
      'leads_assignes',
      'contact_transfere',
      'invitation_acceptee',
      'zone_modifiee',
      'estimation_consultee',
      'demande_estimation',
      'lead_portail',
      'note_transcrite',
      'estimation_calculee',
      'import_termine',
      'anniversaire',
      'negociateur_sans_activite',
      'zone_non_travaillee',
      'mandat_60_jours',
      'immeuble_suivi',
      'suivi_immeuble',
      'annonce_baisse_prix',
      'annonce_retiree',
      'annonces_nouvelles'
    )
  );
