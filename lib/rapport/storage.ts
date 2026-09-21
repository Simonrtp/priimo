import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { RAPPORT_BUCKET } from '@/lib/rapport/pages';

const SIGNED_SECONDS = 60 * 60;

export function cheminLogo(agencyId: string, ext: string): string {
  return `${agencyId}/logo/logo.${ext}`;
}

export function cheminBiblio(agencyId: string, id: string, ext: string): string {
  return `${agencyId}/biblio/${id}.${ext}`;
}

export function cheminImport(agencyId: string, estimationId: string, id: string, ext: string): string {
  return `${agencyId}/import/${estimationId}/${id}.${ext}`;
}

export function cheminEnvoi(agencyId: string, envoiId: string): string {
  return `${agencyId}/envois/${envoiId}.pdf`;
}

export async function signerCheminRapport(path: string | null | undefined): Promise<string | null> {
  if (!path?.trim()) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(RAPPORT_BUCKET)
    .createSignedUrl(path, SIGNED_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function telechargerRapport(path: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(RAPPORT_BUCKET).download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  return { bytes, contentType: data.type || 'application/octet-stream' };
}

export async function deposerRapport(
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ error: string | null }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(RAPPORT_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  return { error: error?.message ?? null };
}

export async function copierRapport(from: string, to: string): Promise<{ error: string | null }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(RAPPORT_BUCKET).copy(from, to);
  return { error: error?.message ?? null };
}

export async function supprimerRapport(path: string | null | undefined): Promise<void> {
  if (!path?.trim()) return;
  const admin = createSupabaseAdminClient();
  await admin.storage.from(RAPPORT_BUCKET).remove([path]);
}
