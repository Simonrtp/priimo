import { redirect } from 'next/navigation';

export default function EquipeRedirectPage() {
  redirect('/dashboard/settings?tab=team');
}
