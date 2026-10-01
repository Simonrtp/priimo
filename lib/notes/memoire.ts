/**
 * La mémoire de l'agence sur une personne ou un immeuble : toutes les notes
 * dictées, relues en quelques lignes. C'est le briefing qu'on écoute dans la
 * voiture avant de sonner.
 *
 * Rien n'est inventé : la synthèse ne cite que ce que les notes disent, et
 * signale ce qui se contredit plutôt que de trancher.
 */

import { dateParisIso } from '@/lib/notes/date-relative';
import { chaineModeles, ecarterModele, MODELES_PROFONDS } from '@/lib/mistral/modeles';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MAX_NOTES = 30;
const MAX_CARACTERES = 14_000;

export type SourceMemoire = {
  date: string;
  auteur: string | null;
  texte: string;
  type: 'note' | 'echange';
};

export type Memoire = {
  /** Trois à six faits utiles, du plus important au moins important. */
  points: string[];
  /** Ce qui reste à faire ou à surveiller, en une phrase. */
  aSuivre: string | null;
  /** À lire à voix haute : deux ou trois phrases, sans liste. */
  briefing: string;
  sources: number;
  derniereNote: string | null;
};

function prompt(sujet: string, sources: readonly SourceMemoire[], aujourdhui: Date): string {
  const lignes: string[] = [];
  let total = 0;
  // Les plus récentes d'abord : si l'on doit couper, on coupe l'ancien.
  for (const s of sources.slice(0, MAX_NOTES)) {
    const ligne = `[${s.date}${s.auteur ? ` · ${s.auteur}` : ''} · ${s.type === 'note' ? 'note' : 'échange'}] ${s.texte.replace(/\s+/g, ' ').trim()}`;
    if (total + ligne.length > MAX_CARACTERES) break;
    lignes.push(ligne);
    total += ligne.length;
  }
  return [
    `Nous sommes le ${dateParisIso(aujourdhui)}. Voici ce que l'agence a noté sur ${sujet}, du plus récent au plus ancien :`,
    '"""',
    ...lignes,
    '"""',
    '',
    'Renvoie ce JSON :',
    '{ "points": [string], "a_suivre": string|null, "briefing": string }',
    '',
    'Règles :',
    '- "points" : 3 à 6 faits utiles à un agent immobilier (projet, délais, budget, situation, freins, personnes clés), le plus important d’abord. Une phrase courte chacun, avec la date quand elle compte (« en mai », « il y a 3 semaines »).',
    '- "a_suivre" : ce qui reste à faire ou à surveiller, en une phrase, ou null.',
    '- "briefing" : deux ou trois phrases à lire à voix haute avant un rendez-vous, sans liste ni abréviation.',
    '- N’invente rien. Si deux notes se contredisent, dis-le. Français, vouvoiement inutile : c’est un aide-mémoire.',
  ].join('\n');
}

function asString(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

export function parseMemoire(raw: string, sources: readonly SourceMemoire[]): Memoire | null {
  let parsed: Record<string, unknown>;
  try {
    const t = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    parsed = JSON.parse(t) as Record<string, unknown>;
  } catch {
    return null;
  }
  const points = (Array.isArray(parsed.points) ? parsed.points : [])
    .map((p) => asString(p, 240))
    .filter((p): p is string => Boolean(p))
    .slice(0, 6);
  const briefing = asString(parsed.briefing, 800);
  if (points.length === 0 || !briefing) return null;
  return {
    points,
    aSuivre: asString(parsed.a_suivre, 240),
    briefing,
    sources: sources.length,
    derniereNote: sources[0]?.date ?? null,
  };
}

export async function resumerMemoire(
  sujet: string,
  sources: readonly SourceMemoire[],
  apiKey: string,
  aujourdhui = new Date(),
): Promise<Memoire | null> {
  if (sources.length === 0) return null;
  const contenu = prompt(sujet, sources, aujourdhui);
  for (const model of chaineModeles(MODELES_PROFONDS, process.env.MISTRAL_MODEL_NOTE)) {
    try {
      const res = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 900,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                "Tu es la mémoire d'une agence immobilière française. Tu résumes fidèlement ses notes de terrain, sans rien ajouter. Tu réponds uniquement en JSON.",
            },
            { role: 'user', content: contenu },
          ],
        }),
      });
      if (!res.ok) {
        ecarterModele(model, res.status);
        continue;
      }
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const texte = body.choices?.[0]?.message?.content;
      const memoire = texte ? parseMemoire(texte, sources) : null;
      if (memoire) return memoire;
    } catch {
      /* modèle suivant */
    }
  }
  return null;
}
