/**
 * Résolution de la configuration d'un widget à partir de son identifiant public.
 *
 * Tout ce qui sort d'ici est destiné à une page publique : nom affiché, logo,
 * couleur. Jamais les données internes de l'agence — ni leads, ni contacts, ni
 * indice d'activité.
 */

import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { normalizeDomainList } from '@/lib/widget/domains';

type Db = SupabaseClient<Database>;

export const WIDGET_PUBLIC_ID_PATTERN = /^[a-z0-9]{10,32}$/;

/** Identifiant opaque : ne laisse pas deviner l'uuid de l'agence. */
export function newWidgetPublicId(): string {
  return randomBytes(9).toString('hex') + randomBytes(3).toString('hex').slice(0, 2);
}

export function isWidgetPublicId(value: unknown): value is string {
  return typeof value === 'string' && WIDGET_PUBLIC_ID_PATTERN.test(value);
}

/** Ce que le serveur connaît du widget. Reste côté serveur. */
export type WidgetConfig = {
  agencyId: string;
  publicId: string;
  enabled: boolean;
  displayName: string;
  accentColor: string;
  logoUrl: string | null;
  allowedDomains: string[];
  dailyCap: number;
  agencyName: string;
  agencyPhone: string | null;
};

/** Ce que la page publique reçoit. Sous-ensemble volontairement pauvre. */
export type WidgetPublicConfig = {
  publicId: string;
  displayName: string;
  accentColor: string;
  logoUrl: string | null;
  agencyName: string;
};

export function toPublicConfig(config: WidgetConfig): WidgetPublicConfig {
  return {
    publicId: config.publicId,
    displayName: config.displayName,
    accentColor: config.accentColor,
    logoUrl: config.logoUrl,
    agencyName: config.agencyName,
  };
}

const DEFAULT_ACCENT = '#1F2937';

/** Lecture service_role : la page publique n'a pas de session. */
export async function fetchWidgetConfig(
  admin: Db,
  publicId: string,
): Promise<WidgetConfig | null> {
  if (!isWidgetPublicId(publicId)) return null;

  const { data, error } = await admin
    .from('agency_widgets')
    .select(
      'agency_id, public_id, enabled, display_name, accent_color, logo_url, allowed_domains, daily_cap',
    )
    .eq('public_id', publicId)
    .maybeSingle();

  if (error || !data) return null;

  const { data: agency } = await admin
    .from('agencies')
    .select('name, phone')
    .eq('id', data.agency_id)
    .maybeSingle();

  const agencyName = agency?.name?.trim() || 'Agence';

  return {
    agencyId: data.agency_id,
    publicId: data.public_id,
    enabled: data.enabled,
    displayName: data.display_name?.trim() || agencyName,
    accentColor: data.accent_color || DEFAULT_ACCENT,
    logoUrl: data.logo_url?.trim() || null,
    allowedDomains: normalizeDomainList(data.allowed_domains ?? []),
    dailyCap: data.daily_cap,
    agencyName,
    agencyPhone: agency?.phone ?? null,
  };
}

/**
 * Configuration de l'agence connectée, créée à la volée à la première ouverture
 * de l'onglet. Le widget naît désactivé et sans domaine : rien n'est exposé
 * tant que le directeur n'a pas choisi.
 */
export async function ensureWidgetForAgency(
  db: Db,
  agencyId: string,
): Promise<WidgetConfig | null> {
  const { data: existing } = await db
    .from('agency_widgets')
    .select(
      'agency_id, public_id, enabled, display_name, accent_color, logo_url, allowed_domains, daily_cap',
    )
    .eq('agency_id', agencyId)
    .maybeSingle();

  const { data: agency } = await db
    .from('agencies')
    .select('name, phone')
    .eq('id', agencyId)
    .maybeSingle();
  const agencyName = agency?.name?.trim() || 'Agence';

  if (existing) {
    return {
      agencyId: existing.agency_id,
      publicId: existing.public_id,
      enabled: existing.enabled,
      displayName: existing.display_name?.trim() || agencyName,
      accentColor: existing.accent_color || DEFAULT_ACCENT,
      logoUrl: existing.logo_url?.trim() || null,
      allowedDomains: normalizeDomainList(existing.allowed_domains ?? []),
      dailyCap: existing.daily_cap,
      agencyName,
      agencyPhone: agency?.phone ?? null,
    };
  }

  const { data: created, error } = await db
    .from('agency_widgets')
    .insert({
      agency_id: agencyId,
      public_id: newWidgetPublicId(),
      enabled: false,
      display_name: agencyName,
      accent_color: DEFAULT_ACCENT,
      allowed_domains: [],
    })
    .select(
      'agency_id, public_id, enabled, display_name, accent_color, logo_url, allowed_domains, daily_cap',
    )
    .single();

  if (error || !created) return null;

  return {
    agencyId: created.agency_id,
    publicId: created.public_id,
    enabled: created.enabled,
    displayName: created.display_name?.trim() || agencyName,
    accentColor: created.accent_color || DEFAULT_ACCENT,
    logoUrl: created.logo_url?.trim() || null,
    allowedDomains: normalizeDomainList(created.allowed_domains ?? []),
    dailyCap: created.daily_cap,
    agencyName,
    agencyPhone: agency?.phone ?? null,
  };
}
