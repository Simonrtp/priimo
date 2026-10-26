-- Secteurs en parcelles (26/10/2026).
--
-- Un secteur devient un ensemble de parcelles cadastrales : une parcelle
-- n'appartient qu'à un seul secteur de l'agence, chaque collaborateur a sa
-- couleur, et les contours des parcelles (cadastre Etalab) sont en base pour
-- l'affichage dézoomé et le rattachement des annonces sans parcelle.

-- 1. Contours des parcelles (données publiques, importées par script).
create table if not exists public.parcelles_geo (
  parcelle_id text primary key,
  commune text not null,
  -- Anneaux GeoJSON d'un Polygon, sommets [lng, lat].
  geometrie jsonb not null,
  centre_lat double precision not null,
  centre_lon double precision not null,
  ouest double precision not null,
  sud double precision not null,
  est double precision not null,
  nord double precision not null,
  importe_le timestamptz not null default now()
);

create index if not exists parcelles_geo_commune on public.parcelles_geo (commune);
create index if not exists parcelles_geo_emprise on public.parcelles_geo (ouest, sud);

alter table public.parcelles_geo enable row level security;

drop policy if exists parcelles_geo_lecture on public.parcelles_geo;
create policy parcelles_geo_lecture on public.parcelles_geo
  for select to authenticated using (true);

-- 2. Les parcelles de chaque secteur. Une parcelle, un seul secteur par agence.
create table if not exists public.zone_parcelles (
  zone_id uuid not null references public.zones (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  parcelle_id text not null,
  created_at timestamptz not null default now(),
  primary key (zone_id, parcelle_id),
  constraint zone_parcelles_une_par_agence unique (agency_id, parcelle_id)
);

create index if not exists zone_parcelles_agence on public.zone_parcelles (agency_id);

alter table public.zone_parcelles enable row level security;

drop policy if exists zone_parcelles_select on public.zone_parcelles;
create policy zone_parcelles_select on public.zone_parcelles
  for select using (agency_id = (select current_user_agency_id()));

-- Écrire : mêmes droits que sur les règles du secteur (directeur partout,
-- titulaire sur le sien tant qu'il n'est pas verrouillé).
drop policy if exists zone_parcelles_insert on public.zone_parcelles;
create policy zone_parcelles_insert on public.zone_parcelles
  for insert with check (
    agency_id = (select current_user_agency_id())
    and exists (
      select 1 from public.zones z
      where z.id = zone_parcelles.zone_id
        and z.agency_id = zone_parcelles.agency_id
        and ((select current_user_role()) = 'directeur'
          or (z.assigned_to = (select auth.uid()) and z.verrouillee = false))
    )
  );

drop policy if exists zone_parcelles_delete on public.zone_parcelles;
create policy zone_parcelles_delete on public.zone_parcelles
  for delete using (
    agency_id = (select current_user_agency_id())
    and exists (
      select 1 from public.zones z
      where z.id = zone_parcelles.zone_id
        and ((select current_user_role()) = 'directeur'
          or (z.assigned_to = (select auth.uid()) and z.verrouillee = false))
    )
  );

-- Une ligne par secteur : la lecture des secteurs (faite sur presque chaque
-- écran) reste une seule requête, sans la limite de lignes de l'API.
create or replace view public.zone_parcelles_listes
  with (security_invoker = true) as
  select zone_id, array_agg(parcelle_id order by parcelle_id) as parcelle_ids
  from public.zone_parcelles
  group by zone_id;

grant select on public.zone_parcelles_listes to authenticated;

-- 3. Enveloppe d'un secteur : le contour exact de ses parcelles (sans marge),
-- calculé par le serveur. Il juge ce qui n'a pas de parcelle connue.
alter table public.zones add column if not exists enveloppe jsonb;

-- 4. Une couleur par collaborateur, unique dans l'agence.
alter table public.profile_agencies add column if not exists couleur text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profile_agencies_couleur_hex'
  ) then
    alter table public.profile_agencies
      add constraint profile_agencies_couleur_hex
      check (couleur is null or couleur ~* '^#[0-9a-f]{6}$');
  end if;
end $$;

create unique index if not exists profile_agencies_couleur_unique
  on public.profile_agencies (agency_id, lower(couleur))
  where couleur is not null;
