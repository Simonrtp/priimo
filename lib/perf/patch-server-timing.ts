import { ServerResponse } from 'node:http';
import { consumePendingServerTiming } from './timing';

let patched = false;

/** Pose Server-Timing sur la réponse HTTP du dashboard (RSC n'y a pas accès). */
export function patchServerTiming(): void {
  if (patched) return;
  patched = true;
  const origEnd = ServerResponse.prototype.end;
  ServerResponse.prototype.end = function endPatched(this: ServerResponse, ...args: unknown[]) {
    if (!this.headersSent) {
      const timing = consumePendingServerTiming();
      if (timing && !this.getHeader('Server-Timing')) {
        this.setHeader('Server-Timing', timing);
      }
    }
    return origEnd.apply(this, args as Parameters<typeof origEnd>);
  } as typeof origEnd;
}
