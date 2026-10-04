-- Ferme les trois failles critiques de l'audit du 14/09/2026, toujours
-- ouvertes le 04/10/2026 (vérifié depuis l'extérieur avec la clé publique).
-- Le code n'utilise ni la vue, ni la règle anonyme, ni ces fonctions sans
-- connexion : rien ne doit changer pour les agences.

-- 1) Vue leads_public : SECURITY DEFINER avec tous les droits pour anon.
--    Avec la seule clé publique, n'importe qui lisait (et pouvait modifier)
--    les leads de toutes les agences, notes comprises. Aucun usage dans le
--    code ni dans les journaux : on retire les droits et la vue respecte
--    désormais la RLS de qui l'interroge.
REVOKE ALL ON public.leads_public FROM anon, authenticated;
ALTER VIEW public.leads_public SET (security_invoker = true);

-- 2) Invitations : la règle anonyme laissait lire toutes les invitations en
--    cours, jeton compris (de quoi rejoindre une agence). La validation d'un
--    jeton passe par le serveur (clé secrète) ; la page équipe garde
--    invitations_select_creator.
DROP POLICY IF EXISTS invitations_select_anon ON public.invitations;

-- 3) Colonnes d'abonnement : la fonction de garde existait sans trigger, un
--    directeur pouvait donc changer son plan, ses sièges ou son statut. On ne
--    bloque que les rôles du site (anon, authenticated) : le serveur (clé
--    secrète, webhook Stripe, admin) et les connexions directes à la base
--    (migrations, scripts) gardent la main.
CREATE OR REPLACE FUNCTION public.protect_agency_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      RAISE EXCEPTION 'Modification de plan interdite';
    END IF;
    IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
      RAISE EXCEPTION 'Modification de stripe_customer_id interdite';
    END IF;
    IF NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
      RAISE EXCEPTION 'Modification de stripe_subscription_id interdite';
    END IF;
    IF NEW.statut_abonnement IS DISTINCT FROM OLD.statut_abonnement THEN
      RAISE EXCEPTION 'Modification de statut_abonnement interdite';
    END IF;
    IF NEW.essai_fin_le IS DISTINCT FROM OLD.essai_fin_le THEN
      RAISE EXCEPTION 'Modification de essai_fin_le interdite';
    END IF;
    IF NEW.sieges_inclus IS DISTINCT FROM OLD.sieges_inclus THEN
      RAISE EXCEPTION 'Modification de sieges_inclus interdite';
    END IF;
    IF NEW.prix_base IS DISTINCT FROM OLD.prix_base THEN
      RAISE EXCEPTION 'Modification de prix_base interdite';
    END IF;
    IF NEW.prix_siege_supplementaire IS DISTINCT FROM OLD.prix_siege_supplementaire THEN
      RAISE EXCEPTION 'Modification de prix_siege_supplementaire interdite';
    END IF;
    IF NEW.demande_decision IS DISTINCT FROM OLD.demande_decision THEN
      RAISE EXCEPTION 'Modification de demande_decision interdite';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_agency_privileged_columns ON public.agencies;
CREATE TRIGGER trg_protect_agency_privileged_columns
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_agency_privileged_columns();

-- 4) Fonctions SECURITY DEFINER appelables sans connexion, avec l'identifiant
--    de n'importe quelle agence (compteurs d'estimations, consommation de
--    l'assistant, dates de dernier contact, étapes par défaut). Aucun appel
--    anonyme dans le code : on retire PUBLIC et anon, les utilisateurs
--    connectés et le serveur gardent l'accès.
REVOKE EXECUTE ON FUNCTION public.agency_estimations_today(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assistant_tokens_du_mois(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculer_dernier_contact_contact(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculer_dernier_contact_lead(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_lead_stages_for_agency(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_estimations_today(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_tokens_du_mois(uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculer_dernier_contact_contact(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculer_dernier_contact_lead(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seed_lead_stages_for_agency(uuid) TO authenticated, service_role;
