import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Tournée',
};

/** La tournée mobile est retirée : on renvoie vers l’accueil. */
export default function TourneePage() {
  redirect('/dashboard');
}
