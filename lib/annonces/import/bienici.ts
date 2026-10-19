/**
 * Bien'ici : la seule API de portail qu'un serveur lit (constaté le
 * 19/10/2026 — PAP, SeLoger, Leboncoin, Logic-Immo et Le Figaro répondent 403).
 * Le détail donne tout : conso et émissions chiffrées, date du DPE, étage,
 * position floutée de l'annonce, photos.
 */
import type { FicheAnnonce } from './types';

const DETAIL = 'https://www.bienici.com/realEstateAds-one.json';
const ENTETES = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'fr-FR,fr;q=0.9',
  referer: 'https://www.bienici.com/',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
} as const;

type Brut = Record<string, unknown>;

const LETTRES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
const TYPES_BIEN: Record<string, FicheAnnonce['typeBien']> = { flat: 'appartement', loft: 'appartement', house: 'maison' };
const PARTICULIERS = new Set(['particulier', 'private', 'owner', 'individual']);

function nombre(v: unknown): number | null {
  if (Array.isArray(v)) {
    const ns = v.filter((x): x is number => typeof x === 'number' && x > 0);
    return ns.length ? Math.min(...ns) : null;
  }
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function lettre(v: unknown): string | null {
  const l = String(v ?? '').trim().toUpperCase();
  return LETTRES.has(l) ? l : null;
}

function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Pur : une annonce brute de l'API → fiche. */
export function ficheBienici(ad: Brut, url: string): FicheAnnonce {
  const blur = (ad.blurInfo ?? {}) as Brut;
  const pos = ((blur.position ?? blur.centroid) ?? {}) as Brut;
  const lat = typeof pos.lat === 'number' ? pos.lat : null;
  const lon = typeof pos.lon === 'number' ? pos.lon : null;
  const rayon = blur.type === 'exact' ? 0 : blur.type === 'disk' ? nombre(blur.radius) ?? 250 : 1500;
  const district = (ad.district ?? {}) as Brut;
  const particulier = PARTICULIERS.has(String(ad.accountType ?? '').toLowerCase()) || ad.adCreatedByPro === false;
  const publication = texte(ad.publicationDate);
  const photos = Array.isArray(ad.photos)
    ? (ad.photos as Brut[])
        .map((p) => texte(p.url) ?? texte(p.url_photo))
        .filter((p): p is string => p != null && p.startsWith('https://'))
        .slice(0, 12)
    : [];
  return {
    portail: 'bienici',
    idPortail: texte(ad.id),
    url,
    typeVendeur: particulier ? 'particulier' : 'professionnel',
    agenceNom: particulier ? null : texte(ad.accountDisplayName),
    typeBien: TYPES_BIEN[String(ad.propertyType ?? '')] ?? 'autre',
    titre: texte(ad.title),
    prix: nombre(ad.price),
    surface: nombre(ad.surfaceArea),
    pieces: nombre(ad.roomsQuantity),
    etage: typeof ad.floor === 'number' ? ad.floor : null,
    dpe: lettre(ad.energyClassification),
    consoKwhM2: nombre(ad.energyValue),
    ges: lettre(ad.greenhouseGazClassification),
    gesKgM2: typeof ad.greenhouseGazValue === 'number' ? ad.greenhouseGazValue : null,
    dpeApresJuillet2021: typeof ad.useJuly2021EnergyPerformanceDiagnostic === 'boolean' ? ad.useJuly2021EnergyPerformanceDiagnostic : null,
    dateDpe: texte(ad.energyPerformanceDiagnosticDate),
    anneeConstruction: nombre(ad.yearOfConstruction),
    chauffage: texte(ad.heating),
    codePostal: texte(ad.postalCode),
    ville: texte(ad.city),
    quartier: texte(district.libelle),
    description: texte(ad.description),
    // Bien'ici date à l'epoch les annonces réimportées : inconnue.
    datePublication: publication && !publication.startsWith('1970-01-01') ? publication : null,
    zone: lat != null && lon != null ? { latitude: lat, longitude: lon, rayonM: rayon } : null,
    photos,
  };
}

/** Détail d'une annonce ; null si elle n'existe plus ou si l'API ne répond pas. */
export async function lireBienici(idPortail: string, url: string): Promise<FicheAnnonce | null> {
  for (const filtres of [{ onTheMarket: [true] }, {}]) {
    try {
      const u = new URL(DETAIL);
      u.searchParams.set('filters', JSON.stringify(filtres));
      u.searchParams.set('onlyRealEstateAd', idPortail);
      const res = await fetch(u, { headers: ENTETES, cache: 'no-store', signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const ad = (await res.json()) as Brut;
      if (ad && typeof ad === 'object' && ad.id) return ficheBienici(ad, url);
    } catch {
      // API lente : le second essai, puis rien.
    }
  }
  return null;
}
