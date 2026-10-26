import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { entrerDansLePipeline, type DemandeEntree } from '@/lib/pipeline/entrer-serveur';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function texte(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function nombre(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v;
}

/** Photos du portail ou de l'annonce lue : des liens https, jamais autre chose. */
function photos(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p): p is string => typeof p === 'string' && /^https:\/\/\S+$/.test(p) && p.length <= 1000)
    .slice(0, 12);
}

function lireDemande(raw: unknown): DemandeEntree | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const address = texte(o.address, 180);
  if (!address) return null;
  const dpe = texte(o.dpeClass, 1)?.toUpperCase() ?? null;
  const typeBien = texte(o.propertyType, 40);
  const owner = o.ownerType === 'entreprise' ? 'entreprise' : 'particulier';
  const provenance = o.provenance === 'portail' ? 'portail' : 'terrain';
  return {
    address,
    city: texte(o.city, 80),
    postalCode: texte(o.postalCode, 5),
    latitude: nombre(o.latitude),
    longitude: nombre(o.longitude),
    banId: texte(o.banId, 40),
    surfaceM2: nombre(o.surfaceM2),
    rooms: nombre(o.rooms),
    etage: texte(o.etage, 8),
    dpeClass: dpe && /^[A-G]$/.test(dpe) ? dpe : null,
    propertyType: typeBien === 'appartement' || typeBien === 'maison' ? typeBien : null,
    ownerType: owner,
    companyName: texte(o.companyName, 120),
    notes: texte(o.notes, 240),
    provenance,
    price: nombre(o.price),
    photos: photos(o.photos),
    lien: typeof o.lien === 'string' && /^https:\/\/\S+$/.test(o.lien) ? o.lien.slice(0, 500) : null,
  };
}

/** L'agent entre un bien dans Pris : saisi, lu sur une annonce ou vu sur la carte. */
export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const demande = lireDemande(await req.json().catch(() => null));
  if (!demande) return NextResponse.json({ error: 'Adresse manquante' }, { status: 400 });
  if (demande.postalCode && !/^\d{5}$/.test(demande.postalCode)) demande.postalCode = null;

  const admin = createSupabaseAdminClient();
  const r = await entrerDansLePipeline(admin, { agencyId: agency.id, profileId: profile.id }, demande);
  if ('erreur' in r) return NextResponse.json({ error: r.erreur }, { status: 409 });
  return NextResponse.json({ etat: r.etat, lead: r.lead });
}
