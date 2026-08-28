-- Installation du widget : savoir s'il est réellement posé sur le site.
--
-- Un réglage activé ne prouve rien. Ce qui prouve, c'est un chargement du
-- widget depuis le domaine de l'agence. On enregistre donc la première fois
-- qu'on l'a vu se charger et la dernière — de quoi dire « installé sur
-- mon-agence.fr » ou « jamais vu », au lieu de laisser le directeur deviner.

ALTER TABLE public.agency_widgets
  ADD COLUMN IF NOT EXISTS first_installed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_host text,
  ADD COLUMN IF NOT EXISTS install_email_to text,
  ADD COLUMN IF NOT EXISTS install_email_sent_at timestamptz;

COMMENT ON COLUMN public.agency_widgets.first_installed_at IS
  'Premier chargement constaté du widget depuis un domaine autorisé.';
COMMENT ON COLUMN public.agency_widgets.last_seen_at IS
  'Dernier chargement constaté. Écrit au plus une fois par tranche de 10 minutes.';
COMMENT ON COLUMN public.agency_widgets.last_seen_host IS
  'Domaine sur lequel le widget a été vu la dernière fois.';
COMMENT ON COLUMN public.agency_widgets.install_email_to IS
  'Dernier destinataire du code d''intégration (prestataire, webmaster).';

-- ---------------------------------------------------------------------------
-- Enregistrement d'un chargement, à débit borné
--
-- Appelée à chaque affichage de la page widget. Le garde-fou des dix minutes
-- évite une écriture par visiteur : on veut un signal d'installation, pas un
-- compteur d'audience.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_widget_seen(p_public_id text, p_host text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  UPDATE public.agency_widgets
  SET
    first_installed_at = COALESCE(first_installed_at, now()),
    last_seen_at = now(),
    last_seen_host = LEFT(COALESCE(p_host, last_seen_host), 255)
  WHERE public_id = p_public_id
    AND (last_seen_at IS NULL OR last_seen_at < now() - interval '10 minutes');
$fn$;

REVOKE ALL ON FUNCTION public.record_widget_seen(text, text) FROM PUBLIC;
-- Seule la page publique du widget, servie par le service_role, l'appelle.
GRANT EXECUTE ON FUNCTION public.record_widget_seen(text, text) TO service_role;
