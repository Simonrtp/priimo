import { CreateInvitationForm } from '@/components/CreateInvitationForm';
import { InvitationsTable } from '@/components/InvitationsTable';
import { PageHeader } from '@/components/Panel';
import { fetchAgencyOptions, fetchAllInvitations } from '@/lib/queries/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InvitationsPage() {
  const [invitations, agencies] = await Promise.all([fetchAllInvitations(), fetchAgencyOptions()]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Invitations"
        subtitle={`Seule section avec écriture — ${invitations.length} invitation(s)`}
      />

      <CreateInvitationForm agencies={agencies} />
      <InvitationsTable rows={invitations} />
    </div>
  );
}
