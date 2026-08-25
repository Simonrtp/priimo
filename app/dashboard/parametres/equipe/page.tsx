import { redirect } from 'next/navigation';

export default function EquipeSettingsPage() {
  redirect('/dashboard/settings?tab=team');
}
