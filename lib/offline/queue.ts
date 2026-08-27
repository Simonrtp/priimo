/**
 * File hors-ligne terrain : actions JSON + dictées audio.
 * IndexedDB — survit aux cages d'escalier sans réseau.
 */

const DB_NAME = 'priimo-offline';
const DB_VERSION = 1;
const STORE = 'queue';

export type OfflineQueueKind = 'json' | 'form';

export type OfflineQueueItem = {
  id: string;
  kind: OfflineQueueKind;
  url: string;
  method: string;
  /** JSON body (kind=json) */
  body?: unknown;
  /** Serialized FormData parts (kind=form) */
  formParts?: OfflineFormPart[];
  headers?: Record<string, string>;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

export type OfflineFormPart =
  | { type: 'text'; name: string; value: string }
  | { type: 'file'; name: string; fileName: string; mime: string; buffer: ArrayBuffer };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    tx.oncomplete = () => {
      db.close();
      resolve(req ? (req.result as T) : undefined);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB tx failed'));
    };
  });
}

export function newOfflineId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `off-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueJson(item: {
  url: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  id?: string;
}): Promise<string> {
  const id = item.id ?? newOfflineId();
  const row: OfflineQueueItem = {
    id,
    kind: 'json',
    url: item.url,
    method: item.method ?? 'POST',
    body: item.body,
    headers: item.headers,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await withStore('readwrite', (store) => store.put(row));
  return id;
}

export async function enqueueFormData(item: {
  url: string;
  method?: string;
  form: FormData;
  id?: string;
}): Promise<string> {
  const parts: OfflineFormPart[] = [];
  for (const [name, value] of item.form.entries()) {
    if (typeof value === 'string') {
      parts.push({ type: 'text', name, value });
    } else {
      const buffer = await value.arrayBuffer();
      parts.push({
        type: 'file',
        name,
        fileName: value.name || 'blob',
        mime: value.type || 'application/octet-stream',
        buffer,
      });
    }
  }
  const id = item.id ?? newOfflineId();
  const row: OfflineQueueItem = {
    id,
    kind: 'form',
    url: item.url,
    method: item.method ?? 'POST',
    formParts: parts,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await withStore('readwrite', (store) => store.put(row));
  return id;
}

export async function listQueue(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      tx.oncomplete = () => {
        db.close();
        const rows = (req.result as OfflineQueueItem[]) ?? [];
        rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        resolve(rows);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    return [];
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function bumpAttempt(id: string, error: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const row = getReq.result as OfflineQueueItem | undefined;
      if (!row) return;
      row.attempts += 1;
      row.lastError = error.slice(0, 240);
      store.put(row);
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function rebuildForm(parts: OfflineFormPart[]): FormData {
  const form = new FormData();
  for (const part of parts) {
    if (part.type === 'text') {
      form.append(part.name, part.value);
    } else {
      form.append(part.name, new Blob([part.buffer], { type: part.mime }), part.fileName);
    }
  }
  return form;
}

export async function flushQueue(): Promise<{ sent: number; remaining: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const all = await listQueue();
    return { sent: 0, remaining: all.length };
  }
  const items = await listQueue();
  let sent = 0;
  for (const item of items) {
    try {
      let res: Response;
      if (item.kind === 'json') {
        res = await fetch(item.url, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            ...(item.headers ?? {}),
          },
          body: item.body === undefined ? undefined : JSON.stringify(item.body),
        });
      } else {
        res = await fetch(item.url, {
          method: item.method,
          body: rebuildForm(item.formParts ?? []),
        });
      }
      if (!res.ok && res.status !== 409) {
        await bumpAttempt(item.id, `HTTP ${res.status}`);
        continue;
      }
      await removeFromQueue(item.id);
      sent += 1;
    } catch (e) {
      await bumpAttempt(item.id, e instanceof Error ? e.message : 'network');
      break;
    }
  }
  const remaining = (await listQueue()).length;
  return { sent, remaining };
}

/** POST JSON : envoie maintenant, sinon file. */
export async function postJsonOrQueue(
  url: string,
  body: unknown,
  opts?: { id?: string },
): Promise<{ queued: boolean; ok: boolean }> {
  const id = opts?.id ?? newOfflineId();
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  if (offline) {
    await enqueueJson({ url, body, id });
    return { queued: true, ok: true };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok || res.status === 409) return { queued: false, ok: true };
    await enqueueJson({ url, body, id });
    return { queued: true, ok: true };
  } catch {
    await enqueueJson({ url, body, id });
    return { queued: true, ok: true };
  }
}

/** POST FormData (dictée) : jamais perdu hors ligne. */
export async function postFormOrQueue(
  url: string,
  form: FormData,
): Promise<{ queued: boolean; res: Response | null }> {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  if (offline) {
    await enqueueFormData({ url, form });
    return { queued: true, res: null };
  }
  try {
    const res = await fetch(url, { method: 'POST', body: form });
    if (res.ok) return { queued: false, res };
    // 5xx / réseau intermittent : file pour ne pas perdre la dictée
    if (res.status >= 500) {
      await enqueueFormData({ url, form });
      return { queued: true, res: null };
    }
    return { queued: false, res };
  } catch {
    await enqueueFormData({ url, form });
    return { queued: true, res: null };
  }
}
