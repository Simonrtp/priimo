/**
 * Programme neuf SeLoger Neuf (selogerneuf.com/program/…, /annonces/neuf/programme/…).
 * Pur, sans réseau.
 *
 * La page porte tout dans __NEXT_DATA__ (detailsAnnonce.annonce) : les lots
 * (pièces, surface, prix), le promoteur, les photos et surtout l'adresse du
 * programme, écrite en toutes lettres. Les coordonnées ne sont gardées que si
 * le site dit qu'elles ne sont pas floutées : sinon ce n'est que le centre de
 * la ville, qui ne localise rien.
 *
 * Un programme vend plusieurs logements : la fiche retient le moins cher, le
 * « à partir de » affiché par le site, avec sa surface et ses pièces.
 */
import { decoder, type Partielle } from './pages';

type Brut = Record<string, unknown>;

const PLAFOND_PHOTOS = 12;

function objet(v: unknown): Brut | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Brut) : null;
}

function liste(v: unknown): Brut[] {
  return Array.isArray(v) ? v.filter((x): x is Brut => Boolean(objet(x))) : [];
}

function nombre(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? decoder(v.trim()) : null;
}

function jour(v: unknown): string | null {
  return texte(v)?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

/** « 116, avenue de la République » → « 116 avenue de la République » (forme attendue par la BAN). */
function adresseNette(v: unknown): string | null {
  const a = texte(v)?.replace(/^(\d+\s*(?:bis|ter)?)\s*,\s*/i, '$1 ').replace(/\s+/g, ' ');
  return a && /\d/.test(a) && a.length >= 6 ? a : null;
}

function programme(html: string): Brut | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]!) as Brut;
    const etat = objet(objet(data.props)?.initialReduxState);
    return objet(objet(etat?.detailsAnnonce)?.annonce);
  } catch {
    return null;
  }
}

type Lot = { prix: number; surface: number | null; pieces: number | null; typeId: number | null };

function lots(a: Brut): Lot[] {
  const r: Lot[] = [];
  for (const type of liste(a.propertyTypes)) {
    for (const lot of liste(type.propertiesByType)) {
      const prix = nombre(lot.price);
      if (prix == null) continue;
      r.push({
        prix,
        surface: nombre(lot.livingArea) ?? nombre(lot.usableLivingArea),
        pieces: nombre(lot.rooms) ?? nombre(type.rooms),
        typeId: nombre(type.propertyTypeId),
      });
    }
  }
  return r.sort((x, y) => x.prix - y.prix);
}

export function lireSeLogerNeuf(html: string): Partielle | null {
  const a = programme(html);
  if (!a || a.programId == null) return null;

  // Deux formes de page : ssotGeoData (adresse + point) ou location (adresse + centre de la ville).
  const geo = objet(a.ssotGeoData);
  const location = objet(a.location);
  const ville = objet(location?.city);
  const adresse = adresseNette(geo?.address) ?? adresseNette(location?.address);
  const codePostal = (texte(geo?.postalCode) ?? texte(ville?.zipCode))?.match(/^\d{5}$/)?.[0] ?? null;

  let zone: Partielle['zone'] = null;
  const point = objet(geo?.coordinates);
  const lat = nombre(point?.lat);
  const lon = nombre(point?.lon);
  if (geo?.isRandomised === false && lat != null && lon != null) zone = { latitude: lat, longitude: lon, rayonM: 0 };

  const tous = lots(a);
  const premier = tous[0] ?? null;
  const prixMin = premier?.prix ?? nombre(a.propertiesMinPrice);
  const typeId = premier?.typeId ?? null;

  const photos = liste(a.photos)
    .map((p) => texte(p.HDurl) ?? texte(p.url))
    .filter((u): u is string => Boolean(u && /^https:\/\//.test(u)))
    .slice(0, PLAFOND_PHOTOS);

  const nom = texte(a.name);
  return {
    typeVendeur: 'professionnel',
    agenceNom: texte(a.professionalName) ?? texte(objet(a.leadData)?.professionalName),
    typeBien: typeId === 1 ? 'appartement' : typeId === 2 ? 'maison' : typeId != null ? 'autre' : null,
    titre: nom ? `Programme neuf · ${nom}` : 'Programme neuf',
    prix: prixMin,
    surface: premier?.surface ?? null,
    pieces: premier?.pieces ?? null,
    codePostal,
    ville: texte(geo?.cityName) ?? texte(ville?.cityName),
    description: texte(a.description)?.slice(0, 4000) ?? null,
    datePublication: jour(a.creationDate),
    adressePubliee: adresse,
    zone,
    photos,
  };
}
