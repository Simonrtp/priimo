import type { Metadata } from 'next';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isPlausibleQrToken } from '@/lib/qr/token';
import { lookupLiveQrSession } from '@/lib/qr/session';
import { QR_CONSENT_VERSION, QR_INFO_VERSION, qrLegalSnapshot } from '@/lib/qr/legal';
import QrConsentForm from './QrConsentForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Merci pour votre confiance',
  description: 'Laissez vos coordonnées à l’agence qui vous les demande.',
  robots: { index: false, follow: false },
};

const PAGE_BG = 'bg-[#E4F1FC]';

function Expire() {
  return (
    <main className={`flex min-h-dvh items-center justify-center ${PAGE_BG} px-6 text-center`}>
      <div>
        <p className="font-display text-[24px] font-bold text-[#111]">Ce lien n’est plus valable.</p>
        <p className="mt-2 text-[15px] text-[#5A6573]">Demandez un nouveau code à la personne qui vous l’a montré.</p>
      </div>
    </main>
  );
}

export default async function QrConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isPlausibleQrToken(token)) return <Expire />;

  const admin = createSupabaseAdminClient();
  const session = await lookupLiveQrSession(admin, token);
  if (!session || 'missing' in session) return <Expire />;

  const [agency, profile, info, consent] = await Promise.all([
    admin.from('agencies').select('name').eq('id', session.agency_id).maybeSingle(),
    admin.from('profiles').select('first_name').eq('id', session.agent_id).maybeSingle(),
    admin.from('informations_legales_versions').select('corps').eq('version', QR_INFO_VERSION).maybeSingle(),
    admin.from('consentements_telephone_versions').select('corps').eq('version', QR_CONSENT_VERSION).maybeSingle(),
  ]);

  const agencyName = agency.data?.name?.trim() || 'l’agence';
  const agentPrenom = profile.data?.first_name?.trim() || 'votre conseiller';
  const legal = qrLegalSnapshot({
    agenceNom: agencyName,
    agentPrenom,
    infoCorps: info.data?.corps,
    consentCorps: consent.data?.corps,
  });

  return (
    <main className={`min-h-dvh ${PAGE_BG}`}>
      <QrConsentForm token={token} agentPrenom={agentPrenom} consentText={legal.consentText} />
    </main>
  );
}
