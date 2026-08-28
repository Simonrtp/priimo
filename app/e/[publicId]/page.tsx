import { headers } from 'next/headers';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { fetchWidgetConfig, toPublicConfig } from '@/lib/widget/config';
import { hostFromOrigin, isDomainAllowed } from '@/lib/widget/domains';
import { renderWidgetConsentText, WIDGET_LEGAL_NOTICE } from '@/lib/widget/consent';
import { turnstileSiteKey } from '@/lib/turnstile';
import { SITE_URL } from '@/lib/site-url';
import WidgetEstimationFunnel from '@/components/embed/WidgetEstimationFunnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Page du widget — deux usages, un seul rendu.
 *
 *  - cadrée par le script /embed/v1.js dans le site de l'agence (?embed=1) ;
 *  - ouverte directement, en page complète, pour les agences qui préfèrent un
 *    lien : priimo.fr/e/IDENTIFIANT, aux couleurs de l'agence.
 *
 * La liste blanche de domaines est vérifiée ici aussi : le `frame-ancestors`
 * posé par le middleware empêche le cadrage, ce contrôle-ci empêche que le
 * formulaire d'une agence soit servi depuis un site tiers.
 */

function Indisponible({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-[320px] max-w-md flex-col justify-center px-6 py-16 text-center">
      <p className="text-[16px] font-medium text-neutral-900">{message}</p>
      <p className="mt-2 text-[13.5px] text-neutral-500">
        Si vous cherchiez à estimer un bien, contactez directement l’agence.
      </p>
    </main>
  );
}

export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { publicId } = await params;
  const sp = await searchParams;

  const admin = createSupabaseAdminClient();
  const config = await fetchWidgetConfig(admin, publicId);

  if (!config || !config.enabled) {
    return <Indisponible message="Ce formulaire d’estimation n’est pas disponible." />;
  }

  const embedded = sp.embed === '1';

  if (embedded) {
    // Navigation d'iframe : le navigateur envoie la page parente en Referer.
    const referer = (await headers()).get('referer');
    const host = hostFromOrigin(referer);
    const selfHost = hostFromOrigin(SITE_URL);
    const autorise = host === selfHost || isDomainAllowed(host, config.allowedDomains);
    if (!autorise) {
      return <Indisponible message="Ce formulaire d’estimation n’est pas disponible." />;
    }
  }

  const first = (value: string | string[] | undefined): string | null =>
    typeof value === 'string' ? value : Array.isArray(value) ? value[0] ?? null : null;

  return (
    <WidgetEstimationFunnel
      config={toPublicConfig(config)}
      consentText={renderWidgetConsentText(config.displayName)}
      legalNotice={WIDGET_LEGAL_NOTICE}
      turnstileSiteKey={turnstileSiteKey()}
      embedded={embedded}
      frameId={first(sp.frame)}
      pageUrl={first(sp.page)}
    />
  );
}
