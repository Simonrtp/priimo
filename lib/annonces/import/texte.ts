/**
 * Repli quand l'URL ne se lit pas (Leboncoin, portail bloqué, PC éteint) :
 * l'agent colle le texte de l'annonce. Mon assistant (Mistral) en tire les
 * chiffres — surtout la conso et les émissions affichées, que la loi impose
 * dans l'annonce et qui retrouvent le logement — puis le localiseur fait le
 * reste. Nos serveurs ne lisent jamais le site.
 */
import { chaineModeles, ecarterModele, MODELES_PROFONDS } from '@/lib/mistral/modeles';
import { searchBanDirect } from '@/lib/geo/ban';
import type { FicheAnnonce } from './types';
import type { UrlAnnonce } from './url';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MAX_TEXTE = 12_000;
const DELAI_MS = 20_000;

const SYSTEME = `Tu lis le texte d'une annonce immobilière française copié depuis un portail.
Réponds UNIQUEMENT par un objet JSON avec ces clés (null si l'information n'est pas écrite ; ne devine jamais) :
{
  "prix": nombre en euros,
  "surface": nombre en m² (surface habitable ou Carrez),
  "pieces": nombre de pièces,
  "etage": numéro d'étage du logement (0 = rez-de-chaussée),
  "type_bien": "appartement" | "maison" | "autre",
  "code_postal": "75020",
  "ville": texte,
  "quartier": texte,
  "dpe": lettre A à G de la classe énergie,
  "conso_kwh_m2": consommation énergétique en kWh/m²/an (le nombre affiché à côté de la classe énergie),
  "ges": lettre A à G de la classe climat,
  "ges_kg_m2": émissions en kg CO2/m²/an,
  "date_dpe": date de réalisation du DPE "AAAA-MM-JJ",
  "dpe_avant_2021": true si le texte dit que le DPE date d'avant juillet 2021,
  "annee_construction": nombre,
  "chauffage": texte (ex. "gaz individuel"),
  "vendeur": "particulier" | "professionnel",
  "agence": nom de l'agence si c'est un professionnel,
  "titre": titre de l'annonce,
  "adresse": numéro et voie SEULEMENT si le texte donne l'adresse du bien lui-même (pas un repère « à deux pas de… »),
  "date_publication": "AAAA-MM-JJ"
}`;

type Brut = Record<string, unknown>;

function nombre(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^\d.,-]/g, '').replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
}

function lettre(v: unknown): string | null {
  const l = String(v ?? '').trim().toUpperCase();
  return /^[A-G]$/.test(l) ? l : null;
}

function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : null;
}

/** Pur : la réponse de Mistral → fiche (sans le repère d'adresse). */
export function ficheDepuisExtraction(json: Brut, u: UrlAnnonce, description: string): FicheAnnonce {
  const cp = texte(json.code_postal)?.match(/\b\d{5}\b/)?.[0] ?? null;
  const type = json.type_bien === 'appartement' || json.type_bien === 'maison' ? json.type_bien : json.type_bien ? 'autre' : null;
  const agence = texte(json.agence);
  return {
    portail: u.portail,
    idPortail: u.idPortail,
    url: u.url,
    typeVendeur: json.vendeur === 'professionnel' || (json.vendeur !== 'particulier' && agence) ? 'professionnel' : 'particulier',
    agenceNom: agence,
    typeBien: type,
    titre: texte(json.titre),
    prix: nombre(json.prix),
    surface: nombre(json.surface),
    pieces: nombre(json.pieces),
    etage: nombre(json.etage),
    dpe: lettre(json.dpe),
    consoKwhM2: nombre(json.conso_kwh_m2),
    ges: lettre(json.ges),
    gesKgM2: nombre(json.ges_kg_m2),
    dpeApresJuillet2021: json.dpe_avant_2021 === true ? false : null,
    dateDpe: texte(json.date_dpe)?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
    anneeConstruction: nombre(json.annee_construction),
    chauffage: texte(json.chauffage),
    codePostal: cp,
    ville: texte(json.ville),
    quartier: texte(json.quartier),
    description: description.slice(0, 4000),
    datePublication: texte(json.date_publication)?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
    zone: null,
    photos: [],
  };
}

async function demander(model: string, apiKey: string, contenu: string): Promise<Brut | null> {
  try {
    const res = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(DELAI_MS),
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEME },
          { role: 'user', content: contenu },
        ],
      }),
    });
    if (!res.ok) {
      ecarterModele(model, res.status);
      return null;
    }
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const brut = body.choices?.[0]?.message?.content;
    return brut ? (JSON.parse(brut) as Brut) : null;
  } catch {
    return null;
  }
}

/** Mon assistant lit le texte d'une annonce ; null si la clé manque ou si aucun modèle ne répond. */
export async function extraireAvecAssistant(texteAnnonce: string): Promise<Brut | null> {
  const apiKey = process.env.MISTRAL_API_KEY;
  const contenu = texteAnnonce.trim().slice(0, MAX_TEXTE);
  if (!apiKey || contenu.length < 40) return null;
  for (const model of chaineModeles(MODELES_PROFONDS, process.env.MISTRAL_MODEL_ANNONCE)) {
    const json = await demander(model, apiKey, contenu);
    if (json) return json;
  }
  return null;
}

/**
 * Une adresse écrite dans l'annonce, retrouvée au numéro près par la BAN dans
 * le bon code postal, devient un repère exact. Sinon rien.
 */
export async function zoneDepuisAdresse(json: Brut, codePostal: string | null): Promise<FicheAnnonce['zone']> {
  const adresse = texte(json.adresse);
  if (!adresse || !codePostal) return null;
  const hits = await searchBanDirect(adresse, { limit: 1, postcode: codePostal, autocomplete: false }).catch(() => []);
  const props = (hits[0]?.properties ?? {}) as { type?: string; score?: number; postcode?: string };
  const coords = hits[0]?.geometry?.coordinates;
  if (props.type === 'housenumber' && (props.score ?? 0) >= 0.75 && props.postcode === codePostal && coords) {
    return { latitude: coords[1], longitude: coords[0], rayonM: 0 };
  }
  return null;
}

/** Texte collé → fiche. */
export async function ficheDepuisTexte(u: UrlAnnonce, collé: string): Promise<FicheAnnonce | null> {
  const contenu = collé.trim().slice(0, MAX_TEXTE);
  const json = await extraireAvecAssistant(contenu);
  if (!json) return null;
  const fiche = ficheDepuisExtraction(json, u, contenu);
  fiche.zone = await zoneDepuisAdresse(json, fiche.codePostal);
  return fiche;
}
