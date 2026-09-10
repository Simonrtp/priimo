import { NextResponse } from 'next/server';
import { lireAgendaPlage } from '@/lib/agenda/lire';
import { cleAgenda, type VueAgenda } from '@/lib/agenda/vues';
import { dateKeyParis } from '@/lib/today/calendar';

export const runtime = 'nodejs';

/** ?vue=semaine|mois&ancre=YYYY-MM-DD — le jour se lit dans la semaine. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const vue: VueAgenda = params.get('vue') === 'mois' ? 'mois' : 'semaine';
  const demande = params.get('ancre') ?? '';
  const ancre = /^\d{4}-\d{2}-\d{2}$/.test(demande) ? demande : dateKeyParis(new Date());

  const data = await lireAgendaPlage(cleAgenda(vue, ancre));
  return NextResponse.json(data);
}
