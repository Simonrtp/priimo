import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { canSeeOwnedRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { countComparables, fetchAddressContext } from '@/lib/estimation/dvf-engine';
import { ESTIMATION_SELECT, parseBien, parseGrille } from '@/lib/estimation/objet';
import type { AgencyEstimationRow } from '@/types/database';
import { CRITERE_NOTE_LABELS, preremplirDepuisPublic } from '@/lib/estimation/grille';
import { baselineRadarSecteur, medianeParkingSecteur, statsSecteurObserves } from '@/lib/estimation/secteur-stats';
import { fetchZonagePlu } from '@/lib/geo/gpu';
import { fetchRisquesParcelle } from '@/lib/geo/georisques';
import { fetchDpeRecents } from '@/lib/geo/ademe';
import { fetchProximiteAdresse } from '@/lib/geo/proximite';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 });

  const session = await createSupabaseServerClient();
  const { data: row } = await session
    .from('agency_estimations')
    .select(ESTIMATION_SELECT)
    .eq('id', id)
    .eq('agency_id', agency.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Estimation introuvable' }, { status: 404 });

  const viewer = viewerFromProfile(profile);
  if (!canSeeOwnedRecord(viewer, { assignedTo: row.referent_id, createdBy: row.created_by })) {
    return NextResponse.json({ error: 'Estimation introuvable' }, { status: 404 });
  }

  const url = new URL(req.url);
  const lat = numQuery(url.searchParams.get('lat')) ?? row.latitude;
  const lng = numQuery(url.searchParams.get('lng')) ?? row.longitude;
  const postalCode = (url.searchParams.get('postal') ?? row.postal_code ?? '').trim();
  const banId = (url.searchParams.get('banId') ?? row.ban_id ?? '').trim() || null;
  if (lat == null || lng == null || !/^\d{5}$/.test(postalCode)) {
    return NextResponse.json({ resolved: false });
  }

  const admin = createSupabaseAdminClient();
  const [immeuble, appart, maison, secteur, parking, gpu, risques, dpes, proximite] = await Promise.all([
    fetchAddressContext(admin, { banId, latitude: lat, longitude: lng, postalCode }),
    countComparables(admin, { latitude: lat, longitude: lng, postalCode, propertyType: 'appartement' }),
    countComparables(admin, { latitude: lat, longitude: lng, postalCode, propertyType: 'maison' }),
    statsSecteurObserves(admin, postalCode),
    medianeParkingSecteur(admin, postalCode),
    fetchZonagePlu({ latitude: lat, longitude: lng }),
    fetchRisquesParcelle({ latitude: lat, longitude: lng }),
    fetchDpeRecents({
      codePostal: postalCode,
      depuis: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 8).toISOString().slice(0, 10),
      taille: 40,
    }),
    fetchProximiteAdresse({ latitude: lat, longitude: lng }),
  ]);

  const adresseNorm = (row.address ?? '').toLocaleLowerCase('fr');
  const dpeAdresse = dpes.find((d) =>
    d.adresse.toLocaleLowerCase('fr').includes(adresseNorm.slice(0, 18)),
  );
  const dpeClass = row.dpe_class ?? dpeAdresse?.lettre ?? immeuble.dpeKnown;
  const grille = preremplirDepuisPublic(parseGrille(row.grille), {
    dpeClass,
    commerces: proximite.commerces,
    transports: proximite.transports,
  });
  const bien = parseBien(row.bien);
  if (!bien.qualiteEmplacement && grille.quartier?.valeur) {
    bien.qualiteEmplacement = CRITERE_NOTE_LABELS[grille.quartier.valeur];
  }
  if (dpeAdresse) {
    if (!bien.dpeVersion) bien.dpeVersion = '3.0';
    if (!bien.ges && dpeAdresse.lettre) bien.ges = dpeAdresse.lettre;
  }

  const surfaceM2 = row.surface_m2 ?? dpeAdresse?.surfaceM2 ?? null;
  const propertyType =
    row.property_type === 'maison' || row.property_type === 'appartement'
      ? row.property_type
      : typeDepuisDpe(dpeAdresse?.typeBatiment);

  const patch: Partial<AgencyEstimationRow> = {};
  if (JSON.stringify(grille) !== JSON.stringify(parseGrille(row.grille))) patch.grille = grille;
  if (JSON.stringify(bien) !== JSON.stringify(parseBien(row.bien))) patch.bien = bien;
  if (dpeClass && dpeClass !== row.dpe_class) patch.dpe_class = dpeClass;
  if (surfaceM2 != null && row.surface_m2 == null) patch.surface_m2 = Math.round(surfaceM2);
  if (propertyType && !row.property_type) patch.property_type = propertyType;
  if (lat !== row.latitude) patch.latitude = lat;
  if (lng !== row.longitude) patch.longitude = lng;
  if (postalCode !== (row.postal_code ?? '').trim()) patch.postal_code = postalCode;
  if (banId && banId !== row.ban_id) patch.ban_id = banId;

  if (Object.keys(patch).length > 0) {
    await session.from('agency_estimations').update(patch).eq('id', id).eq('agency_id', agency.id);
  }

  return NextResponse.json({
    resolved: true,
    immeuble: {
      ...immeuble,
      comparablesAppartement: appart,
      comparablesMaison: maison,
    },
    secteur,
    radarSecteur: baselineRadarSecteur(secteur),
    parkingMedian: parking,
    urbanisme: gpu,
    risques,
    proximite,
    dpe: dpeAdresse
      ? {
          lettre: dpeAdresse.lettre,
          surfaceM2: dpeAdresse.surfaceM2,
          date: dpeAdresse.dateEtablissement,
        }
      : null,
    facade: {
      street: `/api/facade/geo?lat=${lat}&lng=${lng}&format=detail`,
      satellite: `/api/facade/geo?lat=${lat}&lng=${lng}&format=detail&vue=satellite`,
    },
    grille,
    bien,
    dpeClass,
    surfaceM2: surfaceM2 != null ? Math.round(surfaceM2) : null,
    propertyType,
  });
}

function numQuery(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function typeDepuisDpe(raw: string | null | undefined): 'appartement' | 'maison' | null {
  const t = (raw ?? '').toLocaleLowerCase('fr');
  if (t.includes('maison')) return 'maison';
  if (t.includes('appartement')) return 'appartement';
  return null;
}
