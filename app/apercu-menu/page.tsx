import { notFound } from 'next/navigation';
import ApercuCharge from './ApercuCharge';

// TEMPORAIRE — aperçu du menu « Nouveau ». À supprimer.
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ApercuCharge />;
}
