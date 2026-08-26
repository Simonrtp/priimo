import { consumePendingServerTiming } from './timing';

let patched = false;

type NodeHttp = typeof import('http');

function loadNodeHttp(): NodeHttp | null {
  try {
    if (typeof process === 'undefined' || !process.versions?.node) return null;
    // Webpack ne doit pas résoudre `node:http` dans le graphe client.
    const req = Function('return typeof require === "function" ? require : null')() as NodeRequire | null;
    if (!req) return null;
    return req('node:http') as NodeHttp;
  } catch {
    return null;
  }
}

/** Pose Server-Timing sur la réponse HTTP du dashboard (RSC n'y a pas accès). */
export function patchServerTiming(): void {
  if (patched) return;
  const http = loadNodeHttp();
  if (!http?.ServerResponse) return;
  patched = true;
  const origEnd = http.ServerResponse.prototype.end;
  http.ServerResponse.prototype.end = function endPatched(
    this: InstanceType<NodeHttp['ServerResponse']>,
    ...args: unknown[]
  ) {
    if (!this.headersSent) {
      const timing = consumePendingServerTiming();
      if (timing && !this.getHeader('Server-Timing')) {
        this.setHeader('Server-Timing', timing);
      }
    }
    return origEnd.apply(this, args as Parameters<typeof origEnd>);
  } as typeof origEnd;
}
