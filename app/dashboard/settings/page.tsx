import ZoneSection from '@/components/dashboard/settings/ZoneSection';
import AgencySection from '@/components/dashboard/settings/AgencySection';
import SubscriptionSection from '@/components/dashboard/settings/SubscriptionSection';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <ZoneSection />
      <AgencySection />
      <SubscriptionSection />
    </div>
  );
}
