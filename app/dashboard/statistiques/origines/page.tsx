import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { fetchOriginesStats } from '@/lib/inbound/stats';

export const dynamic = 'force-dynamic';

const SOURCE_LABELS: Record<string, string> = {
  manuel: 'Saisie manuelle',
  vocal: 'Note vocale',
  prospection: 'Prospection Priimo',
  portail: 'Portail (générique)',
  site_agence: 'Site agence',
  seloger: 'SeLoger',
  bienici: "Bien'ici",
  logicimmo: 'Logic-Immo',
  leboncoin: 'Leboncoin',
  autre_portail: 'Autre portail',
};

/**
 * Statistiques par origine — vendeur vs acquéreur.
 * Permet de comparer abonnements portails vs apport Priimo.
 */
export default async function OriginesStatsPage() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');
  if (profile.role !== 'directeur') redirect('/dashboard');

  const admin = createSupabaseAdminClient();
  let buckets: Awaited<ReturnType<typeof fetchOriginesStats>> = [];
  try {
    buckets = await fetchOriginesStats(admin, agency.id);
  } catch {
    buckets = [];
  }

  return (
    <div className="mx-auto w-full max-w-3xl py-8 md:px-6">
      <header className="mb-6">
        <h1 className="font-semibold tracking-tight text-ink" style={{ fontSize: 22 }}>
          Origine des contacts
        </h1>
        <p className="mt-1 text-pretty text-mute" style={{ fontSize: 14 }}>
          Sépare demandes vendeur et acquéreur. Utile pour savoir quels abonnements portails
          rentabilisent — et ce que Priimo apporte en face.
        </p>
      </header>

      {buckets.length === 0 ? (
        <p className="text-[14px] text-text-muted">Aucune donnée pour le moment.</p>
      ) : (
        <div className="overflow-x-auto rounded-clay border border-black/[0.06] bg-surface shadow-clay-sm">
          <table className="w-full text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-black/[0.06] text-text-subtle">
                <th className="px-4 py-3 font-medium">Origine</th>
                <th className="px-4 py-3 font-medium">Vendeurs</th>
                <th className="px-4 py-3 font-medium">Acquéreurs</th>
                <th className="px-4 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.source} className="border-b border-black/[0.04] text-text">
                  <td className="px-4 py-2.5">{SOURCE_LABELS[b.source] ?? b.source}</td>
                  <td className="px-4 py-2.5 tabular-nums">{b.vendeur}</td>
                  <td className="px-4 py-2.5 tabular-nums">{b.acquereur}</td>
                  <td className="px-4 py-2.5 tabular-nums font-medium">{b.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
