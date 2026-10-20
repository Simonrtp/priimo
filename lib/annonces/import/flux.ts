import type { EtapeImport, ReponseImport } from './serveur';

/** Une ligne JSON par événement : les étapes en direct, puis le résultat. */
export type LigneFlux = { etape: EtapeImport } | { resultat: ReponseImport };

export function reponseEnFlux(travail: (onEtape: (e: EtapeImport) => void) => Promise<ReponseImport>): Response {
  const encodeur = new TextEncoder();
  const flux = new ReadableStream<Uint8Array>({
    async start(controleur) {
      const envoyer = (ligne: LigneFlux) => {
        // Le padding force le premier événement hors des buffers (nginx, compress).
        controleur.enqueue(encodeur.encode(`${JSON.stringify(ligne)}\n${' '.repeat(4096)}\n`));
      };
      try {
        envoyer({ resultat: await travail((etape) => envoyer({ etape })) });
      } catch (err) {
        console.error('[import] flux', err instanceof Error ? err.message : err);
        envoyer({ resultat: { etat: 'erreur', message: 'Recherche impossible' } });
      } finally {
        controleur.close();
      }
    },
  });
  return new Response(flux, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}
