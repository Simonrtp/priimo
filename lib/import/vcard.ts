/**
 * Lecture d'un export vCard (.vcf) : iPhone / iCloud, Android, Google, Outlook.
 *
 * Chaque fiche devient une ligne de tableau aux colonnes fixes ci-dessous, que
 * la correspondance automatique reconnaît d'elle-même. Versions 2.1, 3.0 et
 * 4.0 : lignes repliées, quoted-printable (Android), groupes « item1. »
 * (iCloud), « tel: » (4.0). Les photos sont ignorées.
 */

export const VCARD_COLONNES = [
  'Prénom',
  'Nom',
  'Nom complet',
  'Téléphone',
  'Autre téléphone',
  'Email',
  'Adresse',
  'Code postal',
  'Ville',
  'Notes',
] as const;

type Propriete = { nom: string; types: string[]; valeur: string };

function encoderOctets(v: string): number[] {
  const octets: number[] = [];
  const encodeur = new TextEncoder();
  for (let i = 0; i < v.length; i++) {
    const hex = v.slice(i + 1, i + 3);
    if (v[i] === '=' && /^[0-9A-F]{2}$/i.test(hex)) {
      octets.push(parseInt(hex, 16));
      i += 2;
    } else {
      octets.push(...encodeur.encode(v[i] ?? ''));
    }
  }
  return octets;
}

function decoderQuotedPrintable(v: string, charset: string): string {
  const octets = new Uint8Array(encoderOctets(v));
  try {
    return new TextDecoder(charset).decode(octets);
  } catch {
    return new TextDecoder('utf-8').decode(octets);
  }
}

/** Lignes repliées (espace en tête) et sauts doux du quoted-printable (« = » final). */
function deplier(texte: string): string[] {
  const out: string[] = [];
  for (const ligne of texte.replace(/\r\n?/g, '\n').split('\n')) {
    const derniere = out[out.length - 1];
    if (
      derniere !== undefined &&
      derniere.endsWith('=') &&
      /QUOTED-PRINTABLE/i.test(derniere.slice(0, derniere.indexOf(':')))
    ) {
      out[out.length - 1] = derniere.slice(0, -1) + ligne.trimStart();
    } else if (derniere !== undefined && (ligne.startsWith(' ') || ligne.startsWith('\t'))) {
      out[out.length - 1] = derniere + ligne.slice(1);
    } else {
      out.push(ligne);
    }
  }
  return out;
}

function lirePropriete(ligne: string): Propriete | null {
  const deuxPoints = ligne.indexOf(':');
  if (deuxPoints <= 0) return null;
  const [nomGroupe = '', ...params] = ligne.slice(0, deuxPoints).split(';');
  const nom = (nomGroupe.split('.').pop() ?? '').toUpperCase();
  const types: string[] = [];
  let encodage = '';
  let charset = 'utf-8';
  for (const param of params) {
    const egal = param.indexOf('=');
    const cle = egal === -1 ? 'TYPE' : param.slice(0, egal).toUpperCase();
    const valeur = (egal === -1 ? param : param.slice(egal + 1)).replace(/"/g, '').trim();
    if (cle === 'TYPE') types.push(...valeur.toUpperCase().split(','));
    else if (cle === 'ENCODING') encodage = valeur.toUpperCase();
    else if (cle === 'CHARSET') charset = valeur;
    else if (cle === 'PREF') types.push('PREF');
  }
  // vCard 2.1 : « TEL;CELL;QUOTED-PRINTABLE:… » sans « TYPE= » ni « ENCODING= ».
  if (types.includes('QUOTED-PRINTABLE')) encodage = 'QUOTED-PRINTABLE';
  if (encodage === 'B' || encodage === 'BASE64') return { nom, types, valeur: '' };
  const brute = ligne.slice(deuxPoints + 1);
  return {
    nom,
    types,
    valeur: encodage === 'QUOTED-PRINTABLE' ? decoderQuotedPrintable(brute, charset) : brute,
  };
}

function desechapper(s: string): string {
  return s
    .replace(/\\[nN]/g, '\n')
    .replace(/\\([,;:\\])/g, '$1')
    .trim();
}

/** Composants séparés par « ; » non échappés (N, ADR, ORG). */
function composants(v: string): string[] {
  const out: string[] = [];
  let courant = '';
  for (let i = 0; i < v.length; i++) {
    const c = v[i] ?? '';
    if (c === '\\' && i + 1 < v.length) {
      courant += c + (v[i + 1] ?? '');
      i++;
    } else if (c === ';') {
      out.push(courant);
      courant = '';
    } else {
      courant += c;
    }
  }
  out.push(courant);
  return out.map(desechapper);
}

/** Le portable d'abord, puis le numéro préféré, puis l'ordre du fichier. */
function rang(p: Propriete): number {
  if (p.types.includes('CELL')) return 0;
  if (p.types.includes('PREF')) return 1;
  return 2;
}

function valeursFiche(props: readonly Propriete[]): Record<string, string> {
  const premiere = (nom: string) => props.find((p) => p.nom === nom);
  const toutes = (nom: string) =>
    props
      .filter((p) => p.nom === nom && p.valeur.trim())
      .map((p, i) => ({ p, i }))
      .sort((a, b) => rang(a.p) - rang(b.p) || a.i - b.i)
      .map(({ p }) => desechapper(p.valeur));

  const n = premiere('N');
  const [famille = '', donne = '', autres = ''] = n ? composants(n.valeur) : [];
  const prenom = [donne, autres].filter(Boolean).join(' ');
  const fn = desechapper(premiere('FN')?.valeur ?? '');
  const org = composants(premiere('ORG')?.valeur ?? '')[0] ?? '';
  const aUnNom = Boolean(prenom || famille || fn);

  const telephones = toutes('TEL');
  const emails = toutes('EMAIL');
  const adr = premiere('ADR');
  const [, , rue = '', ville = '', , codePostal = ''] = adr ? composants(adr.valeur) : [];

  const notes = [
    aUnNom && org ? `Société : ${org}` : '',
    emails.length > 1 ? `Autres emails : ${emails.slice(1).join(', ')}` : '',
    desechapper(premiere('NOTE')?.valeur ?? ''),
  ].filter(Boolean);

  return {
    Prénom: prenom,
    Nom: famille,
    'Nom complet': fn || (aUnNom ? '' : org),
    Téléphone: telephones[0] ?? '',
    'Autre téléphone': telephones.slice(1).join(' / '),
    Email: emails[0] ?? '',
    Adresse: rue.replace(/\n+/g, ', '),
    'Code postal': codePostal,
    Ville: ville,
    Notes: notes.join('\n'),
  };
}

export function lireVcard(texte: string): Record<string, string>[] {
  const fiches: Propriete[][] = [];
  let courante: Propriete[] | null = null;
  for (const ligne of deplier(texte)) {
    const l = ligne.trim();
    if (/^BEGIN:VCARD$/i.test(l)) {
      courante = [];
    } else if (/^END:VCARD$/i.test(l)) {
      if (courante) fiches.push(courante);
      courante = null;
    } else if (courante) {
      const propriete = lirePropriete(l);
      if (propriete) courante.push(propriete);
    }
  }
  return fiches.map(valeursFiche);
}

export function ressembleAVcard(texte: string): boolean {
  return /^\s*BEGIN:VCARD/i.test(texte.slice(0, 2000));
}
