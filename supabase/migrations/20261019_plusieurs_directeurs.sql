-- Plusieurs directeurs par agence. Nommer un collaborateur ne retire
-- plus le rôle à celui qui le nomme.

DROP INDEX IF EXISTS public.uq_profile_agencies_one_director_per_agency;
