import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleBiensFor, visibleContactsFor, visibleLeadsFor } from '@/lib/agency/scope-records';
import { fetchContactsSafe } from '@/lib/queries/contacts';
import { fetchBiensSafe } from '@/lib/queries/biens';
import { fetchLeads } from '@/lib/queries/leads';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ligneRattachementContact, type RattacherItem } from '@/lib/notes/rattacher-catalogue';

export const runtime = 'nodejs';

const MAX = 400;

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);
  const [contacts, biens, leads] = await Promise.all([
    fetchContactsSafe(supabase),
    fetchBiensSafe(supabase),
    fetchLeads(supabase).catch(() => []),
  ]);

  const contactsVisibles = visibleContactsFor(viewer, contacts).slice(0, MAX);
  const biensVisibles = visibleBiensFor(viewer, biens).slice(0, MAX);
  const contactsPourLigne = contactsVisibles.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    phone: c.phone,
    address: c.address,
    banId: c.banId,
  }));
  const biensPourLigne = biensVisibles.map((b) => ({
    proprietaireContactId: b.proprietaireContactId,
    address: b.address,
    banId: b.banId,
  }));

  const contactItems: RattacherItem[] = contactsVisibles.map((c) => ({
    id: c.id,
    kind: 'contact',
    label: c.fullName,
    subtitle: ligneRattachementContact(c, biensPourLigne, contactsPourLigne),
    address: c.address,
    banId: c.banId,
    latitude: c.latitude,
    longitude: c.longitude,
  }));

  const bienItems: RattacherItem[] = biensVisibles.map((b) => ({
    id: b.id,
    kind: 'bien',
    label: b.address,
    subtitle: [b.city, b.proprietaireName].filter(Boolean).join(' · ') || null,
    address: b.address,
    city: b.city,
    postalCode: b.postalCode,
    banId: b.banId,
    latitude: b.latitude,
    longitude: b.longitude,
    proprietaireContactId: b.proprietaireContactId,
    propertyType: b.propertyType,
    surfaceM2: b.surfaceM2,
    rooms: b.rooms,
  }));

  const leadItems: RattacherItem[] = visibleLeadsFor(viewer, leads)
    .slice(0, MAX)
    .map((l) => ({
      id: l.id,
      kind: 'lead',
      label: l.ownerName?.trim() || l.address,
      subtitle: l.ownerName?.trim() ? l.address : [l.city, l.postalCode].filter(Boolean).join(' ') || null,
    }));

  return NextResponse.json({
    contact: contactItems,
    bien: bienItems,
    lead: leadItems,
  });
}
