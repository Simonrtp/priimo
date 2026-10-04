-- Deux vues SECURITY DEFINER lisibles avec la seule clé publique : elles
-- contournaient la RLS des tables open data (fermées, elles, à anon) et
-- livraient tout le jeu agrégé de Priimo (≈ 97 000 parcelles, 88 000
-- immeubles) à qui voulait l'aspirer. Rien de personnel, mais c'est notre
-- travail. Aucun usage dans le code (le serveur lit les tables avec la clé
-- secrète) : on retire les droits du site et les vues respectent la RLS.

REVOKE ALL ON public.parcelle_synthese FROM anon, authenticated;
REVOKE ALL ON public.building_map_points FROM anon, authenticated;
ALTER VIEW public.parcelle_synthese SET (security_invoker = true);
ALTER VIEW public.building_map_points SET (security_invoker = true);
