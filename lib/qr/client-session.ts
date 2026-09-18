import QRCode from 'qrcode';

export type QrClientSession = {
  id: string;
  expireLe: string;
  plafond: number;
  contactsCrees: number;
  vivant: boolean;
  dernierScan: { prenom: string; nom: string; le: string } | null;
};

export type QrClientCard = {
  url: string;
  session: QrClientSession;
  image: string;
};

const STORAGE_KEY = 'priimo-qr-session-v1';
const QR_OPTS = {
  width: 480,
  margin: 1,
  color: { dark: '#111111', light: '#FFFFFF' },
  errorCorrectionLevel: 'M' as const,
};

let memory: QrClientCard | null = null;
let inflight: Promise<QrClientCard> | null = null;

function stillGood(session: QrClientSession, now = Date.now()): boolean {
  if (!session.vivant) return false;
  const exp = Date.parse(session.expireLe);
  return Number.isFinite(exp) && exp > now + 30_000;
}

function readStorage(): QrClientCard | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QrClientCard;
    if (!parsed?.url || !parsed.session || !parsed.image) return null;
    if (!stillGood(parsed.session)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(card: QrClientCard) {
  memory = card;
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(card));
  } catch {
    /* quota / mode privé */
  }
}

export function peekQrCard(): QrClientCard | null {
  if (memory && stillGood(memory.session)) return memory;
  const stored = readStorage();
  if (stored) memory = stored;
  return stored;
}

export function patchQrSession(session: QrClientSession) {
  const current = memory ?? readStorage();
  if (!current || current.session.id !== session.id) return;
  writeStorage({ ...current, session });
}

export async function loadQrCard(): Promise<QrClientCard> {
  const existing = peekQrCard();
  if (existing) return existing;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch('/api/dashboard/qr-session', { method: 'POST' });
    const data = (await res.json()) as { url?: string; session?: QrClientSession; error?: string };
    if (!res.ok || !data.url || !data.session) {
      throw new Error(data.error ?? 'Impossible d’ouvrir le QR.');
    }
    const image = await QRCode.toDataURL(data.url, QR_OPTS);
    const card = { url: data.url, session: data.session, image };
    writeStorage(card);
    return card;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function prefetchQrCard() {
  void loadQrCard().catch(() => undefined);
}
