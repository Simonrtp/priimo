export const MAX_IMPORT_ROWS = 2_000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Un carnet de téléphone dépasse vite 2 000 fiches. */
export const MAX_CONTACT_IMPORT_ROWS = 10_000;
export const MAX_CONTACT_IMPORT_BYTES = 10 * 1024 * 1024;
/** Un export vCard d'iPhone embarque les photos : bien plus lourd que le texte utile. */
export const MAX_VCARD_IMPORT_BYTES = 80 * 1024 * 1024;

/** Lignes envoyées au serveur par requête : une barre de progression, pas de délai dépassé. */
export const CONTACT_IMPORT_LOT = 250;
