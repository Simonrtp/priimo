import { notifyError, notifySuccess } from '@/lib/notify';

/**
 * Valider sans faire attendre.
 *
 * Le vert s'affiche au clic et la fenêtre peut se fermer dans la foulée :
 * l'écriture part derrière. C'est tenable parce que ces formulaires vérifient
 * leur saisie localement — au moment du clic, l'issue ne dépend plus que du
 * réseau. Et le réseau, ici, c'est surtout l'aller-retour d'identification que
 * chaque route rejoue avant d'écrire, pour un verdict connu d'avance.
 *
 * À réserver aux écritures dont l'échec se rattrape. L'agent aura déjà vu le
 * vert quand le rouge arrive, et sa saisie ne sera plus à l'écran : un
 * changement de mot de passe, une création de compte ou une recherche de
 * doublon doivent rester bloquants.
 *
 * `ecrire` doit lever une `Error` porteuse du message à montrer ; à défaut,
 * `echec` prend le relais.
 */
export function validerEnFond<T>(params: {
  /** Annoncé immédiatement. `null` quand l'appelant s'en charge lui-même. */
  succes: string | null;
  /** Stabilise la pastille pour qu'un appelant puisse y ajouter une action ensuite. */
  succesId?: string;
  /** L'écriture, jouée en fond. */
  ecrire: () => Promise<T>;
  /** Ce qu'on fait de la réponse une fois arrivée : liste à recaler, page à relire… */
  puis?: (resultat: T) => void;
  /** Repli quand l'écriture échoue sans message propre. */
  echec: string;
}): void {
  if (params.succes) notifySuccess(params.succes, { id: params.succesId });

  void (async () => {
    try {
      const resultat = await params.ecrire();
      params.puis?.(resultat);
    } catch (err) {
      notifyError(err instanceof Error && err.message ? err.message : params.echec);
    }
  })();
}
