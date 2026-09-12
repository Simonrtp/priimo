import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listerActionsOuvertes } from '@/lib/queries/actions';
import ActionsInbox from '@/components/dashboard/actions/ActionsInbox';
import ActivationNotifications from '@/components/dashboard/actions/ActivationNotifications';

export const metadata = { title: 'À valider — Priimo' };

export default async function DashboardActionsPage() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const supabase = await createSupabaseServerClient();
  const actions = await listerActionsOuvertes(supabase, agency.id, {
    profileId: profile.id,
    estDirecteur: profile.role === 'directeur',
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 py-6">
      <header>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-subtle transition-colors hover:text-text"
        >
          <ArrowLeft size={14} strokeWidth={2.2} aria-hidden />
          Accueil
        </Link>
        <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-text">À valider</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-text-subtle">
          Ce que les veilles ont trouvé pendant la nuit. Rien ne part vers un client sans votre
          validation.
        </p>
      </header>

      <ActivationNotifications />

      <ActionsInbox initial={actions} />
    </div>
  );
}
