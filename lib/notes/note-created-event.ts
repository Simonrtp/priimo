/**
 * Signal « une note vient d'être enregistrée ».
 *
 * La prise en main a besoin de savoir que la dictée a réellement abouti, sans
 * interroger le serveur en boucle. Les deux dialogues (vocal et clavier)
 * émettent l'événement au moment où le serveur a accepté la note ; qui veut
 * réagir s'y abonne.
 */

export const NOTE_CREATED_EVENT = 'priimo:note-enregistree';

export type NoteCreatedDetail = {
  /** Identifiant de la note créée, quand il est connu. */
  noteId: string | null;
  source: 'vocal' | 'clavier';
};

export function emitNoteCreated(detail: NoteCreatedDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<NoteCreatedDetail>(NOTE_CREATED_EVENT, { detail }));
}

export function onNoteCreated(handler: (detail: NoteCreatedDetail) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => {
    handler((event as CustomEvent<NoteCreatedDetail>).detail);
  };
  window.addEventListener(NOTE_CREATED_EVENT, listener);
  return () => window.removeEventListener(NOTE_CREATED_EVENT, listener);
}
