import { NextResponse } from 'next/server';
import {
  parsePostalCodesFromBody,
  validateAgencyPostalCodes,
} from '@/lib/agency-postal-codes';
import { sendAgencyRequestNotificationToAdmin } from '@/lib/email/sendAgencyRequestEmail';
import { requireDirector } from '@/lib/auth/requireDirector';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('agency_requests')
    .select('*')
    .eq('requested_by', guard.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(request: Request) {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const agencyName = typeof body.agencyName === 'string' ? body.agencyName.trim() : '';
  if (!agencyName || agencyName.length < 2) {
    return NextResponse.json({ error: "Le nom de l'agence est requis." }, { status: 400 });
  }

  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!address || address.length < 5) {
    return NextResponse.json(
      { error: "Sélectionnez l'adresse dans la liste de suggestions." },
      { status: 400 },
    );
  }

  const codesPostaux = parsePostalCodesFromBody(body.codesPostaux);
  if (!codesPostaux) {
    return NextResponse.json({ error: 'Codes postaux invalides.' }, { status: 400 });
  }
  const postalError = validateAgencyPostalCodes(codesPostaux);
  if (postalError) {
    return NextResponse.json({ error: postalError }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : null;

  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from('agency_requests')
    .insert({
      requested_by: guard.user.id,
      agency_name: agencyName,
      address,
      codes_postaux: codesPostaux,
      message: message || null,
      status: 'en_attente',
    })
    .select('id')
    .single();

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? 'Erreur enregistrement' }, { status: 500 });
  }

  try {
    await sendAgencyRequestNotificationToAdmin({
      requesterName: `${guard.profile.first_name} ${guard.profile.last_name}`.trim(),
      requesterEmail: guard.user.email,
      currentAgencyName: guard.agency.name,
      agencyName,
      address,
      codesPostaux,
      message,
    });
  } catch (e) {
    await supabase.from('agency_requests').delete().eq('id', row.id);
    const msg = e instanceof Error ? e.message : "Erreur d'envoi email";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: row.id });
}
