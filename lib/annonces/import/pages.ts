/**
 * Lire une page d'annonce téléchargée. Pur, sans réseau.
 *
 * Les portails cachent dans leurs pages des données structurées plus sûres
 * que le texte : coordonnées, conso chiffrée, prix exact. On les lit d'abord
 * (SeLoger, Leboncoin, PAP, puis schema.org pour tout autre site) ; Mon
 * assistant complète ensuite à partir du texte visible (lecture universelle).
 */
import { extrairePhotosPap } from '../photos';
import type { FicheAnnonce } from './types';

export type Partielle = Partial<Omit<FicheAnnonce, 'portail' | 'idPortail' | 'url'>>;
type Brut = Record<string, unknown>;

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', euro: '€', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê' };

export function decoder(t: string): string {
  return t
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, e: string) => ENTITES[e.toLowerCase()] ?? m);
}

function texteHtml(fragment: string): string {
  return decoder(fragment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

function nombre(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = v.replace(/[\s  ]/g, '').replace(/\.(?=\d{3}\b)/g, '').match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : null;
}

function lettre(v: unknown): string | null {
  const l = String(v ?? '').trim().toUpperCase();
  return /^[A-G]$/.test(l) ? l : null;
}

function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? decoder(v.trim()) : null;
}

function chemin(o: unknown, ...cles: string[]): unknown {
  let x = o;
  for (const c of cles) {
    if (!x || typeof x !== 'object') return undefined;
    x = (x as Brut)[c];
  }
  return x;
}

const PLAFOND_PHOTOS = 12;

/* -------------------------------------------------------------------------- */
/*                                     PAP                                    */
/* -------------------------------------------------------------------------- */

/** Fiche PAP (même lecture que priimo-pipeline/portails/pap.py). PAP n'affiche que les lettres du DPE. */
export function lirePap(html: string): Partielle | null {
  const titre = html.match(/<h1 class="item-title[^"]*">([\s\S]*?)<\/h1>/);
  if (!titre) return null;
  const prix = titre[1]!.match(/class="item-price[^"]*">([\s\S]*?)<\/span>/);
  const titreTxt = texteHtml(titre[1]!.replace(/<span class="item-price[\s\S]*?<\/span>/, ''));
  const tags = texteHtml(html.match(/<ul class="item-tags[^"]*">([\s\S]*?)<\/ul>/)?.[1] ?? '');
  const description = texteHtml(html.match(/<div class="margin-bottom-30">\s*<p>([\s\S]*?)<\/p>/)?.[1] ?? '');
  const lettres: Record<string, string | null> = {};
  for (const bloc of ['energy-indice', 'ges-indice']) {
    lettres[bloc] = html.match(new RegExp(`class="${bloc}">[\\s\\S]*?<li class="active">([A-G])</li>`))?.[1] ?? null;
  }
  let zone: FicheAnnonce['zone'] = null;
  const carte = html.match(/map-annonce-adresse"[^>]*data-thunderforest=(?:'([^']+)'|"([^"]+)")/);
  if (carte) {
    try {
      const [lat, lon] = (JSON.parse(decoder(carte[1] ?? carte[2]!)) as { center: [string, string] }).center.map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lon)) zone = { latitude: lat!, longitude: lon!, rayonM: 0 };
    } catch {
      zone = null;
    }
  }
  const etage = description.match(/\b(\d{1,2})\s*(?:er|e|ème|eme|è)\s*étage/i);
  return {
    typeVendeur: 'particulier',
    titre: titreTxt || null,
    typeBien: /maison/i.test(titreTxt) ? 'maison' : /appartement|studio/i.test(titreTxt) ? 'appartement' : null,
    prix: prix ? nombre(texteHtml(prix[1]!)) : null,
    codePostal: titreTxt.match(/\((\d{5})\)/)?.[1] ?? null,
    surface: nombre(tags.match(/([\d.,]+)\s*m²/)?.[1]),
    pieces: nombre(tags.match(/(\d+)\s*pièce/)?.[1]),
    etage: etage ? Number(etage[1]) : /rez-de-chauss/i.test(description) ? 0 : null,
    dpe: lettres['energy-indice'] ?? null,
    ges: lettres['ges-indice'] ?? null,
    description: description || null,
    zone,
    photos: extrairePhotosPap(html).slice(0, PLAFOND_PHOTOS),
  };
}

/* -------------------------------------------------------------------------- */
/*                                   SeLoger                                  */
/* -------------------------------------------------------------------------- */

const RE_UFRN = /window\["__UFRN_LIFECYCLE_SERVERREQUEST__"\]=JSON\.parse\(("(?:[^"\\]|\\.)*")\)/;

/** JSON embarqué des fiches SeLoger (même lecture que priimo-pipeline/portails/seloger.py). */
export function lireSeLoger(html: string): Partielle | null {
  const m = html.match(RE_UFRN);
  if (!m) return null;
  let data: unknown;
  try {
    data = JSON.parse(JSON.parse(m[1]!) as string);
  } catch {
    return null;
  }
  const classified = chemin(data, 'app_cldp', 'data', 'classified') as Brut | undefined;
  if (!classified || typeof classified !== 'object') return null;
  const sections = (classified.sections ?? {}) as Brut;
  const facts = new Map<string, Brut>();
  for (const f of ((chemin(sections, 'hardFacts', 'facts') as Brut[] | undefined) ?? [])) {
    if (f && typeof f.type === 'string') facts.set(f.type, f);
  }
  const location = (sections.location ?? {}) as Brut;
  const adresse = (location.address ?? {}) as Brut;
  const geometrie = (location.geometry ?? {}) as Brut;

  let zone: FicheAnnonce['zone'] = null;
  if (geometrie.type === 'Point' && Array.isArray(geometrie.coordinates)) {
    const [lon, lat] = geometrie.coordinates as number[];
    if (typeof lat === 'number' && typeof lon === 'number') zone = { latitude: lat, longitude: lon, rayonM: 0 };
  } else if ((geometrie.type === 'Polygon' || geometrie.type === 'MultiPolygon') && Array.isArray(geometrie.coordinates)) {
    const anneaux = geometrie.type === 'MultiPolygon' ? (geometrie.coordinates as number[][][][]).map((p) => p[0]!) : [(geometrie.coordinates as number[][][])[0]!];
    const points = anneaux.flat().filter((p) => Array.isArray(p) && p.length >= 2);
    if (points.length) {
      const lat = points.reduce((s, p) => s + p[1]!, 0) / points.length;
      const lon = points.reduce((s, p) => s + p[0]!, 0) / points.length;
      const rayon = Math.max(...points.map((p) => Math.hypot((p[0]! - lon) * 73_000, (p[1]! - lat) * 111_000)));
      zone = { latitude: lat, longitude: lon, rayonM: Math.round(rayon) };
    }
  }

  let dpe: string | null = null;
  let conso: number | null = null;
  let ges: string | null = null;
  let gesKg: number | null = null;
  let apres2021: boolean | null = null;
  let annee: number | null = null;
  let chauffage: string | null = null;
  const energy = (sections.energy ?? {}) as Brut;
  for (const f of ((energy.features as Brut[] | undefined) ?? [])) {
    if (f.type === 'yearOfConstruction') annee = nombre(f.value);
    else if (f.type === 'energySource') chauffage = texte(f.value);
  }
  for (const certificat of ((energy.certificates as Brut[] | undefined) ?? [])) {
    for (const scale of ((certificat.scales as Brut[] | undefined) ?? [])) {
      const type = String(scale.type ?? '');
      const note = lettre(chemin(scale, 'efficiencyClass', 'rating'));
      const valeurs = ((scale.values as Brut[] | undefined) ?? []).map((v) => String(v.value ?? ''));
      if (type.startsWith('FR_ENERGY')) {
        dpe = note;
        conso = nombre(valeurs.find((v) => /kwh/i.test(v)));
        if (type.includes('AFTER_2021')) apres2021 = true;
      } else if (type.startsWith('FR_GHG')) {
        ges = note;
        gesKg = nombre(valeurs.find((v) => /co/i.test(v)));
      }
    }
  }

  const surfaceFact = facts.get('livingSpace');
  const etageFact = texte(facts.get('numberOfFloors')?.label);
  const etage = etageFact ? (/^rdc|^rez/i.test(etageFact) ? 0 : nombre(etageFact.split('/')[0])) : null;
  const prix = nombre(chemin(sections, 'mortgage', 'price')) ?? nombre(chemin(sections, 'hardFacts', 'price', 'value'));
  const description = texte(chemin(sections, 'mainDescription', 'description')) ?? texte(chemin(sections, 'description', 'description'));
  const agence = texte(chemin(classified, 'contactSections', 'contactCard', 'title'));
  const typeBrut = String(chemin(classified, 'rawData', 'propertyType') ?? '').toUpperCase();
  const photos = ((chemin(classified, 'gallery', 'images') as Brut[] | undefined) ?? (chemin(sections, 'gallery', 'images') as Brut[] | undefined) ?? [])
    .map((p) => texte(p.url))
    .filter((p): p is string => p != null && p.startsWith('https://'));
  return {
    typeVendeur: !agence || /particulier/i.test(agence) ? 'particulier' : 'professionnel',
    agenceNom: agence && !/particulier/i.test(agence) ? agence : null,
    typeBien: typeBrut === 'HOUSE' ? 'maison' : typeBrut === 'APARTMENT' ? 'appartement' : null,
    prix,
    surface: nombre(surfaceFact?.splitValue ?? surfaceFact?.value),
    pieces: nombre(facts.get('numberOfRooms')?.splitValue),
    etage,
    dpe,
    consoKwhM2: conso,
    ges,
    gesKgM2: gesKg,
    dpeApresJuillet2021: apres2021,
    anneeConstruction: annee,
    chauffage,
    codePostal: texte(adresse.zipCode),
    ville: texte(adresse.city),
    quartier: texte(adresse.district),
    description,
    datePublication: texte(chemin(classified, 'metadata', 'creationDate')),
    zone,
    photos: photos.slice(0, PLAFOND_PHOTOS),
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Leboncoin                                 */
/* -------------------------------------------------------------------------- */

/** `props.pageProps.ad` du JSON Next.js de la fiche. La position de Leboncoin est floutée. */
export function lireLeboncoin(html: string): Partielle | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  let data: unknown;
  try {
    data = JSON.parse(m[1]!);
  } catch {
    return null;
  }
  const ad = chemin(data, 'props', 'pageProps', 'ad') as Brut | undefined;
  if (!ad || typeof ad !== 'object') return null;
  const attributs = new Map<string, Brut>();
  for (const a of ((ad.attributes as Brut[] | undefined) ?? [])) {
    if (a && typeof a.key === 'string') attributs.set(a.key, a);
  }
  const valeur = (cle: string) => attributs.get(cle)?.value ?? attributs.get(cle)?.value_label;
  const loc = (ad.location ?? {}) as Brut;
  const lat = nombre(loc.lat);
  const lon = nombre(loc.lng);
  const owner = (ad.owner ?? {}) as Brut;
  const etiquette = (cle: string) => texte(attributs.get(cle)?.value_label);
  const chauffage = [etiquette('heating_mode'), etiquette('heating_type')].filter(Boolean).join(' ').toLowerCase() || null;
  // « Paris 75020 Ménilmontant - Amandiers » → « Ménilmontant - Amandiers »
  const quartier = texte(loc.city_label)?.replace(/^.*?\b\d{5}\b\s*/, '') || null;
  const prix = Array.isArray(ad.price) ? nombre(ad.price[0]) : nombre(ad.price) ?? (nombre(ad.price_cents) != null ? nombre(ad.price_cents)! / 100 : null);
  // Une conso chiffrée, si le portail l'expose (selon les annonces).
  let conso: number | null = null;
  let gesKg: number | null = null;
  for (const [cle, a] of attributs) {
    const v = nombre(a.value);
    if (v == null) continue;
    if (/energy_(?:value|consumption)|conso/i.test(cle) && v > 20) conso = v;
    if (/ges_(?:value|emission)|emission/i.test(cle)) gesKg = v;
  }
  const type = String(valeur('real_estate_type') ?? '');
  const images = (chemin(ad, 'images', 'urls_large') as string[] | undefined) ?? (chemin(ad, 'images', 'urls') as string[] | undefined) ?? [];
  return {
    typeVendeur: owner.type === 'pro' ? 'professionnel' : 'particulier',
    agenceNom: owner.type === 'pro' ? (texte(owner.name) ?? texte(valeur('store_name'))) : null,
    typeBien: type === '1' ? 'maison' : type === '2' ? 'appartement' : null,
    titre: texte(ad.subject),
    prix,
    surface: nombre(valeur('square')),
    pieces: nombre(valeur('rooms')),
    etage: nombre(valeur('floor_number')),
    dpe: lettre(valeur('energy_rate')),
    consoKwhM2: conso,
    ges: lettre(valeur('ges')),
    gesKgM2: gesKg,
    codePostal: texte(loc.zipcode),
    ville: texte(loc.city),
    quartier,
    chauffage,
    anneeConstruction: nombre(valeur('building_year')),
    description: texte(ad.body),
    datePublication: texte(ad.first_publication_date),
    // Leboncoin floute la position (commune ou quartier) : un repère, jamais une adresse.
    zone: lat != null && lon != null ? { latitude: lat, longitude: lon, rayonM: 800 } : null,
    photos: images.filter((p) => typeof p === 'string' && p.startsWith('https://')).slice(0, PLAFOND_PHOTOS),
  };
}

/* -------------------------------------------------------------------------- */
/*                              schema.org (tout site)                        */
/* -------------------------------------------------------------------------- */

function objetsJsonLd(html: string): Brut[] {
  const out: Brut[] = [];
  for (const m of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const v = JSON.parse(m[1]!.trim()) as unknown;
      const pile = Array.isArray(v) ? v : [v];
      while (pile.length) {
        const o = pile.shift();
        if (!o || typeof o !== 'object') continue;
        out.push(o as Brut);
        const graphe = (o as Brut)['@graph'];
        if (Array.isArray(graphe)) pile.push(...graphe);
      }
    } catch {
      // JSON-LD mal formé : ignoré.
    }
  }
  return out;
}

/** Les annonces d'agences publient souvent prix, surface et position en schema.org. */
export function lireJsonLd(html: string): Partielle | null {
  const objets = objetsJsonLd(html);
  if (!objets.length) return null;
  const r: Partielle = {};
  for (const o of objets) {
    const offre = (Array.isArray(o.offers) ? o.offers[0] : o.offers) as Brut | undefined;
    r.prix ??= nombre(offre?.price) ?? nombre(o.price);
    r.surface ??= nombre(chemin(o, 'floorSize', 'value')) ?? nombre(o.floorSize);
    r.pieces ??= nombre(o.numberOfRooms);
    r.codePostal ??= texte(chemin(o, 'address', 'postalCode'));
    r.ville ??= texte(chemin(o, 'address', 'addressLocality'));
    r.titre ??= texte(o.name);
    r.description ??= texte(o.description);
    const lat = nombre(chemin(o, 'geo', 'latitude'));
    const lon = nombre(chemin(o, 'geo', 'longitude'));
    if (!r.zone && lat != null && lon != null) r.zone = { latitude: lat, longitude: lon, rayonM: 300 };
    const image = o.image;
    if (!r.photos?.length && image) {
      const liste = (Array.isArray(image) ? image : [image]).map((i) => (typeof i === 'string' ? i : texte((i as Brut).url)));
      r.photos = liste.filter((p): p is string => p != null && p.startsWith('https://')).slice(0, PLAFOND_PHOTOS);
    }
  }
  return Object.values(r).some((v) => v != null && !(Array.isArray(v) && v.length === 0)) ? r : null;
}

/* -------------------------------------------------------------------------- */
/*                       Chiffres du DPE écrits dans le texte                 */
/* -------------------------------------------------------------------------- */

function premierNombre(texteSource: string, motifs: RegExp[]): number | null {
  for (const motif of motifs) {
    const m = texteSource.match(motif);
    if (m?.[1]) {
      const n = nombre(m[1]);
      if (n != null) return n;
    }
  }
  return null;
}

/**
 * La loi impose dans l'annonce la consommation (énergie primaire), les
 * émissions et souvent la date du diagnostic : une simple lecture du texte
 * suffit, sans Mon assistant (« Consommation énergie primaire : 352 kWh/m²/an »,
 * « Date de réalisation du diagnostic énergétique : 28/09/2026 »).
 */
export function chiffresDpeDuTexte(source: string | null | undefined): Partielle {
  const t = (source ?? '').replace(/[\u00a0\u202f]/g, ' ');
  if (!t) return {};
  const conso = premierNombre(t, [
    /[ée]nergie primaire[^0-9]{0,40}?(\d[\d\s.,]*)\s*kwh/i,
    /consommation[^0-9]{0,60}?(\d[\d\s.,]*)\s*kwh/i,
    /(\d[\d\s.,]*)\s*kwh\s*\/?\s*m(?:²|2)/i,
  ]);
  const gesKg = premierNombre(t, [/(?:[ée]missions?|gaz à effet de serre|ges)[^0-9]{0,60}?(\d[\d\s.,]*)\s*kg/i, /(\d[\d\s.,]*)\s*kg\s*(?:co2|eq|éq)/i]);
  const date = t.match(/diagnostic[^0-9]{0,60}?(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/i);
  const r: Partielle = {};
  if (conso != null && conso > 0 && conso < 1000) r.consoKwhM2 = conso;
  if (gesKg != null && gesKg >= 0 && gesKg < 300) r.gesKgM2 = gesKg;
  if (date) r.dateDpe = `${date[3]}-${date[2]!.padStart(2, '0')}-${date[1]!.padStart(2, '0')}`;
  return r;
}

/* -------------------------------------------------------------------------- */
/*                          Texte visible pour Mon assistant                  */
/* -------------------------------------------------------------------------- */

const MOTS_CLES = /kwh|co2|m²|m2|€|étage|etage|dpe|ges|énergie|energie|pièce|piece|chambre|construit|chauffage|diagnostic/i;

/** Le texte de la page, sans scripts ni menus, ramené à l'essentiel pour Mon assistant. */
export function texteVisible(html: string, max = 12_000): string {
  const titre = texteHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const meta = decoder(html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? '');
  const corps = texteHtml(
    html
      .replace(/<(script|style|noscript|svg|header|footer|nav)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' '),
  );
  const lignes = corps.split('\n').map((l) => l.trim()).filter((l) => l.length > 1);
  const utiles = lignes.filter((l) => MOTS_CLES.test(l));
  const debut = lignes.slice(0, 120);
  const assemble = [titre, meta, ...new Set([...utiles, ...debut])].join('\n');
  return assemble.slice(0, max);
}

/** Page vide, page d'erreur ou défi anti-robot encore présent. */
export function pageInexploitable(html: string): 'bloquee' | 'disparue' | null {
  if (html.length < 800) return 'bloquee';
  if (/captcha-delivery\.com|cf-chl-|Just a moment\.\.\.|Please enable JS and disable any ad blocker/i.test(html)) return 'bloquee';
  if (/annonce (?:n'est plus|n’est plus) (?:disponible|en ligne)|cette annonce a été (?:supprimée|désactivée)|page introuvable/i.test(html.slice(0, 200_000))) {
    return 'disparue';
  }
  return null;
}
