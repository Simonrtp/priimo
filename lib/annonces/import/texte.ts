/**
 * Lecture universelle : Mon assistant (Mistral) lit le texte visible d'une
 * page d'annonce téléchargée quand ses données structurées ne suffisent pas.
 * Il en tire les chiffres — surtout la conso et les émissions affichées, que
 * la loi impose dans l'annonce et qui retrouvent le logement — puis le
 * localiseur fait le reste.
 */
import 'server-only';
import { chaineModeles, ecarterModele, MODELES_PROFONDS } from '@/lib/mistral/modeles';
import type { Brut } from './extraction';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MAX_TEXTE = 12_000;
const DELAI_MS = 20_000;

const SYSTEME = `Tu lis le texte d'une annonce immobilière française copié depuis un portail.
Programme neuf ou annonce de plusieurs logements : décris le logement le moins cher affiché (le prix « à partir de »), avec sa surface et ses pièces.
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
