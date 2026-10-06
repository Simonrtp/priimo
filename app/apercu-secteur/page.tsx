import { notFound } from 'next/navigation';
import ApercuCharge from './ApercuCharge';

// TEMPORAIRE — aperçu visuel des secteurs. À supprimer.
export default async function Page({ searchParams }: { searchParams: Promise<{ etat?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { etat } = await searchParams;
  return <ApercuCharge etat={etat ?? 'atelier'} />;
}
