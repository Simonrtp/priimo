/**
 * Transcription au fil de la parole, du navigateur à Voxtral Realtime.
 *
 * Tout se prépare dès que l'agent touche le micro (`preparerTempsReel`) :
 * moteur audio créé dans le geste — Safari le laisserait sinon en veille —,
 * jeton court, WebSocket ouvert et session configurée. Quand le micro répond,
 * il n'y a plus qu'à brancher le flux : le premier mot s'affiche en moins
 * d'une seconde.
 *
 * Le micro est lu une seconde fois, en parallèle de l'enregistreur : un
 * AudioWorklet le ramène en PCM 16 kHz mono. Tout échec rend `null` : la
 * dictée bascule sur la pré-transcription par morceaux, et l'enregistrement,
 * lui, n'est jamais touché.
 */

import { FREQUENCE_PCM, RETARD_CIBLE_MS, URL_TEMPS_REEL } from '@/lib/voice/temps-reel-config';

type Jeton = { token: string; model: string; expiresAt: number };

let jetonEnCache: Jeton | null = null;
let jetonEnCours: Promise<Jeton | null> | null = null;

/** Marge avant expiration : un jeton qui expire en pleine dictée coupe le direct. */
const MARGE_JETON_MS = 120_000;

async function demanderJeton(): Promise<Jeton | null> {
  try {
    const res = await fetch('/api/dashboard/voice-notes/temps-reel', { method: 'POST' });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string; model?: string; expiresAt?: string | null };
    if (!data.token || !data.model) return null;
    const expire = data.expiresAt ? Date.parse(data.expiresAt) : NaN;
    return {
      token: data.token,
      model: data.model,
      expiresAt: Number.isFinite(expire) ? expire : Date.now() + 14 * 60_000,
    };
  } catch {
    return null;
  }
}

function jetonValide(): Jeton | null {
  return jetonEnCache && jetonEnCache.expiresAt - Date.now() > MARGE_JETON_MS ? jetonEnCache : null;
}

/** Obtient (ou réutilise) un jeton. Sans effet si un jeton valide est déjà là. */
export function prechaufferTempsReel(): Promise<Jeton | null> {
  const valide = jetonValide();
  if (valide) return Promise.resolve(valide);
  if (!jetonEnCours) {
    jetonEnCours = demanderJeton().then((j) => {
      jetonEnCache = j;
      jetonEnCours = null;
      return j;
    });
  }
  return jetonEnCours;
}

/* -------------------------------------------------------------------------- */
/* AudioWorklet : micro → PCM 16 bits, 16 kHz                                  */
/* -------------------------------------------------------------------------- */

/**
 * Moyenne des échantillons de chaque tranche de sortie : un filtre passe-bas
 * sommaire, suffisant pour la voix. Paquets de 60 ms : assez petits pour que
 * le mot parte aussitôt dit.
 */
const ECHANTILLONS_PAQUET = (FREQUENCE_PCM * 60) / 1000;
const WORKLET_SOURCE = `
class PriimoPcm16 extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / ${FREQUENCE_PCM};
    this.acc = 0;
    this.n = 0;
    this.pos = 0;
    this.out = new Int16Array(${ECHANTILLONS_PAQUET});
    this.len = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i];
      this.n += 1;
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        let s = this.acc / this.n;
        this.acc = 0;
        this.n = 0;
        s = s < -1 ? -1 : s > 1 ? 1 : s;
        this.out[this.len++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.len === this.out.length) {
          this.port.postMessage(this.out.buffer, [this.out.buffer]);
          this.out = new Int16Array(${ECHANTILLONS_PAQUET});
          this.len = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('priimo-pcm16', PriimoPcm16);
`;

let urlWorklet: string | null = null;

function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binaire = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binaire += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}

/* -------------------------------------------------------------------------- */
/* Préparation (dans le geste)                                                 */
/* -------------------------------------------------------------------------- */

const DELAI_OUVERTURE_MS = 6_000;

type SocketPrete = { ws: WebSocket; enAttente: string[] };

/**
 * Tout ce qui peut se faire avant d'avoir le micro. À appeler de façon
 * synchrone dans le gestionnaire du toucher : c'est ce qui autorise le moteur
 * audio à démarrer sur iPhone.
 */
export class PreparationTempsReel {
  readonly ctx: AudioContext;
  readonly module: Promise<boolean>;
  readonly socket: Promise<SocketPrete | null>;
  private abandonnee = false;
  /** Messages reçus avant que la dictée ne s'abonne (texte déjà parti). */
  ecouteur: ((data: Record<string, unknown>) => void) | null = null;

  private constructor(ctx: AudioContext) {
    this.ctx = ctx;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    this.module = (async () => {
      try {
        if (!urlWorklet) {
          urlWorklet = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
        }
        await ctx.audioWorklet.addModule(urlWorklet);
        return true;
      } catch {
        return false;
      }
    })();
    this.socket = this.ouvrir();
  }

  static lancer(): PreparationTempsReel | null {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return null;
    const AudioCtor =
      window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor || typeof AudioWorkletNode === 'undefined') return null;
    try {
      const ctx = new AudioCtor();
      if (!ctx.audioWorklet) {
        void ctx.close().catch(() => undefined);
        return null;
      }
      return new PreparationTempsReel(ctx);
    } catch {
      return null;
    }
  }

  private async ouvrir(): Promise<SocketPrete | null> {
    const jeton = await prechaufferTempsReel();
    if (!jeton || this.abandonnee) return null;
    return new Promise((resolve) => {
      let tranche = false;
      const trancher = (v: SocketPrete | null) => {
        if (tranche) return;
        tranche = true;
        window.clearTimeout(minuteur);
        if (!v) {
          try {
            ws.close();
          } catch {
            /* déjà fermé */
          }
        }
        resolve(v);
      };
      const ws = new WebSocket(`${URL_TEMPS_REEL}?model=${encodeURIComponent(jeton.model)}`, [
        'realtime',
        jeton.token,
      ]);
      const minuteur = window.setTimeout(() => trancher(null), DELAI_OUVERTURE_MS);
      ws.onmessage = (event) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(String(event.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        if (data.type === 'session.created') {
          ws.send(
            JSON.stringify({
              type: 'session.update',
              session: {
                audio_format: { encoding: 'pcm_s16le', sample_rate: FREQUENCE_PCM },
                target_streaming_delay_ms: RETARD_CIBLE_MS,
              },
            }),
          );
          trancher({ ws, enAttente: [] });
        } else if (data.type === 'error' && !tranche) {
          trancher(null);
        }
        this.ecouteur?.(data);
      };
      ws.onerror = () => trancher(null);
      ws.onclose = () => trancher(null);
    });
  }

  /** L'agent a annulé avant de parler : on libère tout. */
  abandonner(): void {
    this.abandonnee = true;
    void this.socket.then((s) => {
      if (s && (s.ws.readyState === WebSocket.OPEN || s.ws.readyState === WebSocket.CONNECTING)) s.ws.close();
    });
    void this.ctx.close().catch(() => undefined);
  }

  get estAbandonnee(): boolean {
    return this.abandonnee;
  }
}

/** Raccourci pour un gestionnaire de toucher. */
export function preparerTempsReel(): PreparationTempsReel | null {
  return PreparationTempsReel.lancer();
}

/* -------------------------------------------------------------------------- */
/* Session                                                                      */
/* -------------------------------------------------------------------------- */

export type HandlersTempsReel = {
  /** Texte complet depuis le début de la prise, à chaque nouveau mot. */
  onTexte: (texte: string) => void;
  /** Le direct s'est interrompu en cours de route : on bascule sur le repli. */
  onCoupure?: () => void;
};

const DELAI_FIN_MS = 1_500;

export class TranscriptionTempsReel {
  private texte = '';
  private fini = false;
  private resoudreFin: ((texte: string) => void) | null = null;

  private constructor(
    private readonly ws: WebSocket,
    private readonly ctx: AudioContext,
    private readonly source: MediaStreamAudioSourceNode,
    private readonly noeud: AudioWorkletNode,
    private readonly handlers: HandlersTempsReel,
  ) {}

  /**
   * Branche le micro sur une préparation (ou en crée une sur-le-champ, sans le
   * bénéfice du geste). Rend `null` si le direct n'est pas possible.
   */
  static async demarrer(
    stream: MediaStream,
    handlers: HandlersTempsReel,
    preparation?: PreparationTempsReel | null,
  ): Promise<TranscriptionTempsReel | null> {
    const prep = preparation && !preparation.estAbandonnee ? preparation : PreparationTempsReel.lancer();
    if (!prep) return null;
    try {
      const [moduleOk, socket] = await Promise.all([prep.module, prep.socket]);
      if (!moduleOk || !socket || socket.ws.readyState !== WebSocket.OPEN) throw new Error('indisponible');
      if (prep.ctx.state === 'suspended') await prep.ctx.resume().catch(() => undefined);
      // Safari peut garder le moteur audio en veille : le direct ne recevrait
      // aucun son, sans erreur. On bascule tout de suite sur le repli.
      if (prep.ctx.state !== 'running') throw new Error('audio en veille');

      const source = prep.ctx.createMediaStreamSource(stream);
      const noeud = new AudioWorkletNode(prep.ctx, 'priimo-pcm16', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });
      const session = new TranscriptionTempsReel(socket.ws, prep.ctx, source, noeud, handlers);
      session.brancher(prep);
      return session;
    } catch {
      prep.abandonner();
      return null;
    }
  }

  private brancher(prep: PreparationTempsReel): void {
    this.noeud.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (this.fini || this.ws.readyState !== WebSocket.OPEN) return;
      this.ws.send(JSON.stringify({ type: 'input_audio.append', audio: base64(e.data) }));
    };
    this.source.connect(this.noeud);

    prep.ecouteur = (data) => {
      if (data.type === 'transcription.text.delta' && typeof data.text === 'string' && data.text) {
        this.texte += data.text;
        this.handlers.onTexte(this.texte.trim());
      } else if (data.type === 'transcription.done') {
        const final = typeof data.text === 'string' && data.text.trim() ? data.text.trim() : this.texte.trim();
        this.texte = final;
        this.resoudreFin?.(final);
      } else if (data.type === 'error') {
        console.warn('[voice] temps réel', (data.error as { message?: string } | undefined)?.message ?? 'erreur');
      }
    };
    this.ws.onclose = () => {
      if (!this.fini) this.handlers.onCoupure?.();
      this.resoudreFin?.(this.texte.trim());
    };
  }

  get texteCourant(): string {
    return this.texte.trim();
  }

  /** Termine proprement : vide le tampon et attend le dernier mot (1,5 s au plus). */
  async arreter(): Promise<string> {
    if (this.fini) return this.texte.trim();
    this.fini = true;
    try {
      this.source.disconnect();
    } catch {
      /* déjà débranché */
    }
    const fin = new Promise<string>((resolve) => {
      this.resoudreFin = resolve;
      window.setTimeout(() => resolve(this.texte.trim()), DELAI_FIN_MS);
    });
    try {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'input_audio.flush' }));
        this.ws.send(JSON.stringify({ type: 'input_audio.end' }));
      }
    } catch {
      /* la fin arrive par le minuteur */
    }
    const texte = await fin;
    this.fermer();
    return texte;
  }

  /** Coupe sans attendre (annulation). */
  fermer(): void {
    this.fini = true;
    this.noeud.port.onmessage = null;
    try {
      this.source.disconnect();
    } catch {
      /* déjà débranché */
    }
    this.ws.onclose = null;
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
    void this.ctx.close().catch(() => undefined);
  }
}
