/**
 * « Ranger » ferme la note tout de suite ; le rangement part ensuite en un
 * seul appel, sans que l'agent l'attende. Un message confirme ce qui a été
 * rangé — ou dit où retrouver la note si quelque chose a échoué.
 */

import { notifyError, notifySuccess } from '@/lib/notify';
import { formatMinutes } from '@/lib/notes/temps-gagne';

type Bilan = {
  contacts: number;
  promesses: number;
  rendezVous: number;
  visites: number;
  misesAJour: number;
  recherche: boolean;
  prospect: boolean;
};

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? 's' : ''}`;
}

export function messageRangement(b: Bilan | undefined, minutes: number | undefined): string {
  const bouts: string[] = [];
  if (b?.contacts) bouts.push(pluriel(b.contacts, 'contact'));
  if (b?.promesses) bouts.push(`${pluriel(b.promesses, 'rappel')} sur l’accueil`);
  if (b?.rendezVous) bouts.push(`${b.rendezVous} rendez-vous`);
  if (b?.misesAJour) bouts.push(`${pluriel(b.misesAJour, 'fiche')} à jour`);
  if (b?.prospect) bouts.push('prospect avancé');
  const temps = minutes && minutes >= 1 ? ` · ≈ ${formatMinutes(minutes)} gagnées` : '';
  return bouts.length ? `Rangé · ${bouts.join(' · ')}${temps}` : `Note rangée${temps}`;
}

/** Ce que l'envoi de l'enregistrement a donné. */
export type ResultatEnvoi = { id: string } | { horsLigne: true } | { erreur: string };

export function rangerEnArrierePlan(args: {
  /** L'envoi de l'enregistrement, qui peut être encore en cours. */
  envoi: Promise<ResultatEnvoi>;
  plan: Record<string, unknown>;
  apres?: () => void;
}): void {
  const debut = Date.now();
  // Les chiffres frais n'arrivent qu'après l'envol de la note vers son compteur :
  // le chiffre monte d'abord à l'écran, le serveur confirme ensuite.
  const apres = () => window.setTimeout(() => args.apres?.(), Math.max(0, 1_400 - (Date.now() - debut)));
  void (async () => {
    const envoi = await args.envoi.catch((): ResultatEnvoi => ({ erreur: 'réseau' }));
    if ('horsLigne' in envoi) {
      notifySuccess('Note gardée sur le téléphone — rangée au retour du réseau');
      return;
    }
    if ('erreur' in envoi) {
      notifyError('La note n’a pas pu être enregistrée. Redictez-la quand le réseau revient.');
      return;
    }
    const id = envoi.id;
    try {
      const corps = JSON.stringify(args.plan);
      const res = await fetch(`/api/dashboard/voice-notes/${id}/valider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: corps,
        // Survit à un changement de page juste après « Ranger ».
        keepalive: corps.length < 60_000,
      });
      const data = (await res.json().catch(() => ({}))) as {
        bilan?: Bilan;
        minutesEvitees?: number;
        echecs?: string[];
      };
      if (!res.ok) throw new Error('rangement');
      if (data.echecs?.length) {
        notifyError(`Note rangée, sauf : ${[...new Set(data.echecs)].join(', ')}`);
      } else {
        notifySuccess(messageRangement(data.bilan, data.minutesEvitees), { id: `voice-saved-${id}` });
      }
      apres();
    } catch {
      notifyError('La note n’a pas pu être rangée. Elle vous attend dans « Mes notes ».');
    }
  })();
}
