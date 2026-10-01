/**
 * Transcription au fil de la parole, du navigateur à Voxtral Realtime.
 *
 * Le micro est lu une seconde fois, en parallèle de l'enregistreur : un
 * AudioWorklet le ramène en PCM 16 kHz mono et l'envoie par WebSocket, avec un
 * jeton court délivré par notre serveur. Le texte revient mot à mot.
 *
 * Tout échec (navigateur sans AudioWorklet, réseau, jeton) rend `null` : la
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

/**
 * À appeler dès que l'agent touche le micro : le jeton arrive pendant que le
 * navigateur demande l'autorisation, la première syllabe n'attend pas.
 */
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
 * sommaire, suffisant pour la voix, qui évite le repliement d'un simple
 * sous-échantillonnage. Paquets de 100 ms.
 */
const WORKLET_SOURCE = `
class PriimoPcm16 extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / ${FREQUENCE_PCM};
    this.acc = 0;
    this.n = 0;
    this.pos = 0;
    this.out = new Int16Array(${FREQUENCE_PCM / 10});
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
          this.out = new Int16Array(${FREQUENCE_PCM / 10});
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
/* Session                                                                      */
/* -------------------------------------------------------------------------- */

export type HandlersTempsReel = {
  /** Texte complet depuis le début de la prise, à chaque nouveau mot. */
  onTexte: (texte: string) => void;
  /** Le direct s'est interrompu en cours de route : on bascule sur le repli. */
  onCoupure?: () => void;
};

const DELAI_OUVERTURE_MS = 5_000;
const DELAI_FIN_MS = 2_500;
const MAX_EN_ATTENTE = 80; // 8 s d'audio tamponné avant l'ouverture de session

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

  /** Ouvre le direct, ou rend `null` si ce n'est pas possible ici et maintenant. */
  static async demarrer(
    stream: MediaStream,
    handlers: HandlersTempsReel,
  ): Promise<TranscriptionTempsReel | null> {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return null;
    const AudioCtor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor || typeof AudioWorkletNode === 'undefined') return null;

    const jeton = await prechaufferTempsReel();
    if (!jeton) return null;

    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioCtor();
      if (!ctx.audioWorklet) throw new Error('audioWorklet');
      if (!urlWorklet) {
        urlWorklet = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
      }
      await ctx.audioWorklet.addModule(urlWorklet);
      if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
      // Safari peut garder le moteur audio en veille hors d'un geste : le direct
      // ne recevrait aucun son, sans erreur. On bascule tout de suite sur le repli.
      if (ctx.state !== 'running') throw new Error('audio en veille');

      const source = ctx.createMediaStreamSource(stream);
      const noeud = new AudioWorkletNode(ctx, 'priimo-pcm16', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });

      const ws = new WebSocket(`${URL_TEMPS_REEL}?model=${encodeURIComponent(jeton.model)}`, [
        'realtime',
        jeton.token,
      ]);
      const session = new TranscriptionTempsReel(ws, ctx, source, noeud, handlers);
      const pret = await session.ouvrir();
      if (!pret) {
        session.fermer();
        return null;
      }
      return session;
    } catch {
      if (ctx) void ctx.close().catch(() => undefined);
      return null;
    }
  }

  private ouvrir(): Promise<boolean> {
    const enAttente: string[] = [];
    let pret = false;

    this.noeud.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (this.fini) return;
      const message = JSON.stringify({ type: 'input_audio.append', audio: base64(e.data) });
      if (pret && this.ws.readyState === WebSocket.OPEN) this.ws.send(message);
      else if (enAttente.length < MAX_EN_ATTENTE) enAttente.push(message);
    };
    this.source.connect(this.noeud);

    return new Promise((resolve) => {
      let tranche = false;
      const trancher = (ok: boolean) => {
        if (tranche) return;
        tranche = true;
        window.clearTimeout(minuteur);
        resolve(ok);
      };
      const minuteur = window.setTimeout(() => trancher(false), DELAI_OUVERTURE_MS);

      this.ws.onmessage = (event) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(String(event.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        switch (data.type) {
          case 'session.created':
            this.ws.send(
              JSON.stringify({
                type: 'session.update',
                session: {
                  audio_format: { encoding: 'pcm_s16le', sample_rate: FREQUENCE_PCM },
                  target_streaming_delay_ms: RETARD_CIBLE_MS,
                },
              }),
            );
            pret = true;
            for (const m of enAttente.splice(0)) this.ws.send(m);
            trancher(true);
            break;
          case 'transcription.text.delta':
            if (typeof data.text === 'string' && data.text) {
              this.texte += data.text;
              this.handlers.onTexte(this.texte.trim());
            }
            break;
          case 'transcription.done': {
            const final = typeof data.text === 'string' && data.text.trim() ? data.text.trim() : this.texte.trim();
            this.texte = final;
            this.resoudreFin?.(final);
            break;
          }
          case 'error':
            console.warn('[voice] temps réel', (data.error as { message?: string } | undefined)?.message ?? 'erreur');
            if (!tranche) trancher(false);
            break;
          default:
            break;
        }
      };
      this.ws.onerror = () => trancher(false);
      this.ws.onclose = () => {
        trancher(false);
        if (!this.fini) this.handlers.onCoupure?.();
        this.resoudreFin?.(this.texte.trim());
      };
    });
  }

  get texteCourant(): string {
    return this.texte.trim();
  }

  /** Termine proprement : vide le tampon et attend le dernier mot (2,5 s au plus). */
  async arreter(): Promise<string> {
    if (this.fini) return this.texte.trim();
    this.fini = true;
    this.source.disconnect();
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
