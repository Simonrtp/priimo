import { lireAgendaSemaine, type AgendaReponse } from '@/lib/agenda/lire';
import EmploiDuTemps from './EmploiDuTemps';

export default async function EmploiDuTempsServeur({
  agenda,
}: {
  agenda?: Promise<AgendaReponse>;
}) {
  const data = await (agenda ?? lireAgendaSemaine());
  return <EmploiDuTemps initial={data} />;
}
