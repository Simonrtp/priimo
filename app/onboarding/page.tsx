import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/getServerUser';
import { agencyNeedsOnboarding } from '@/lib/auth/agency-onboarding';
import OnboardingForm from '@/components/onboarding/OnboardingForm';

export const metadata = {
  title: 'Configuration',
};

export default async function OnboardingPage() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');
  if (profile.role !== 'directeur') redirect('/dashboard');
  if (!agencyNeedsOnboarding(agency)) redirect('/dashboard');

  return <OnboardingForm agency={agency} userEmail={user.email} />;
}
