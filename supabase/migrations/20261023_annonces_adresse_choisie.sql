-- L'adresse choisie par l'agence parmi les adresses possibles d'une annonce
-- ({adresse, latitude, longitude, raison}). Null : toutes les possibles restent
-- liées. Le choix appartient à l'agence (lien annonces_agences), pas à l'annonce
-- publique : une autre agence peut choisir autrement.
alter table public.annonces_agences add column if not exists adresse_choisie jsonb;
