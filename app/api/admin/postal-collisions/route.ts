import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { findPostalCollisions } from '@/lib/admin/postal-collisions';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const raw = url.searchParams.get('codes') ?? '';
  const codes = raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  if (codes.length === 0) {
    return NextResponse.json({ collisions: [] });
  }

  const admin = createSupabaseAdminClient();
  const { data: agencies, error } = await admin.from('agencies').select('id, name, codes_postaux');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const collisions = findPostalCollisions(codes, agencies ?? []);
  return NextResponse.json({ collisions });
}
