/**
 * Génération on-demand d'un prompt de prospection (Mistral).
 * Un seul texte oral, utilisable à l'appel ET à la porte.
 */

import {
  MAX_OUVERTURE_CHARS,
  parseScriptApproche,
  toStoredIntro,
  type ScriptApproche,
  type ScriptApprocheStored,
} from '@/lib/script-approche';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';

const PROMPT_TEMPLATE = `Tu aides un agent immobilier qui va soit APPELER, soit SONNER à la porte
pour CE bien précis. Tu lui rédiges UN SEUL texte oral qu'il peut lire tel quel
dans LES DEUX situations — un prompt de prospection hybride, pas une fiche
technique, pas une lettre, pas une liste à puces.

BUT
L'agent ne doit plus chercher les infos dans la fiche. Tu regroupes les faits UTILES
et tu les formules en phrases parlées, naturelles, prêtes à dire.
PRIORITÉ ABSOLUE : s'il y a des NOTES INTERNES laissées par les agents, tu DOIS
les prendre en compte. Elles reflètent ce qui s'est déjà passé sur le terrain
(relances, refus, disponibilité, ton du proprio, infos orales…). Intègre-les
dans le prompt (sans les recopier mot pour mot si c'est trop long) pour que
l'échange soit cohérent avec l'historique. Sans notes, base-toi uniquement sur
les données du bien.

LANGAGE HYBRIDE (appel + terrain) — RÈGLE CRITIQUE
Le texte doit fonctionner AU TÉLÉPHONE et À LA PORTE, sans modification.
Formule d'ouverture STANDARD : « je vous contacte » (neutre, valable partout).
INTERDIT : « je vous appelle », « je vous téléphone », « au téléphone »,
« je passe un coup de fil », « suite à mon appel », « je vous joinds »,
« je vous écris », « je me permets de venir vous voir », « je passe vous voir »
et toute formulation qui fige le canal (téléphone seul ou porte seule).
À UTILISER : « je vous contacte au sujet de… », « bonjour, je vous contacte
concernant votre appartement… », « je voulais échanger avec vous sur… ».

Exemple de ton (à adapter aux VRAIES données, jamais inventer) :
« Bonjour Madame Dupont,
je vous contacte au sujet de votre appartement au 4ème. Un diagnostic a été
refait récemment, et il y a eu plusieurs ventes dans l'immeuble — vous avez
un projet de votre côté ? »

RÈGLES ABSOLUES
1. N'invente RIEN. Chaque fait cité doit être dans les données. Si une info manque,
   saute-la — ne mets JAMAIS de placeholder du type [Nom], [Agence], [Adresse].
2. Sois PERTINENT : ne recycle pas tout. Choisis 2 à 4 faits qui aident vraiment
   l'échange (ex. étage, surface, diagnostic récent, ventes dans l'immeuble,
   société propriétaire…). Si un point n'apporte rien, ne le mets pas.
3. Formule comme un oral : première ligne = uniquement « Bonjour…, » (avec le nom
   si connu), puis un retour à la ligne, puis les faits clés et une question
   ouverte sur SA situation (pas une pitch de vente agressif).
4. Interdit : jargon interne (signal, score, prédictif, algorithme, data, DVF,
   BODACC). Tu peux parler de diagnostic, de ventes dans l'immeuble, d'étage, etc.
   en français courant — sans dire d'où tu tiens l'info (« j'ai vu dans une base »).
5. INTERDIT ABSOLU : ne mentionne JAMAIS la date d'achat, l'année d'acquisition,
   ni la durée de détention (« depuis 12 ans », « acquis en 2010 », etc.).
   Ces infos n'existent pas pour toi — même si tu les devines, tu ne les dis pas.
6. INTERDIT : ne dis JAMAIS « ces 3 dernières années », « ces X dernières années »,
   « ces derniers mois », ni aucune fenêtre de temps du même type. Dis le fait
   (« aucun permis déposé », « ventes dans l'immeuble ») sans période chiffrée —
   ou utilise au plus « récemment » si besoin.
7. Mets en gras markdown (**comme ceci**) les chiffres et infos importantes
   (surface, étage, classe énergétique, année d'échéance, nombre de ventes, nom…).
8. 4 à 8 phrases max. Pas d'objections, pas de plan B, pas de variante courrier.
9. Si le propriétaire est une société : parle du bien détenu par la société,
   ton pro, pas de vie privée du dirigeant.
10. Si des NOTES INTERNES sont fournies : adapte l'accroche et la question à
    cet historique (ex. déjà vu, a dit non pour l'instant, préfère un
    rappel, a mentionné des travaux…). Ne révèle pas au propriétaire que tu
    lis des « notes internes ».
11. Ouvre avec « je vous contacte » (ou une variante proche). N'utilise PAS
    « je vous appelle », « téléphone », « venir vous voir », « passer à la porte ».

DONNÉES DU BIEN (source unique — n'ajoute rien d'autre)
{donnees}

RÉPONDS UNIQUEMENT EN JSON, sans texte avant ni après :
{ "texte": "le prompt de prospection complet, prêt à lire (appel OU porte), avec **gras** sur les faits clés" }
`;

/** Fuites de méthode — pas les faits métier (diagnostic, ventes, etc.). */
const LEAK_PATTERNS =
  /\b(dvf|bodacc|algorithme|score|signal|pr[eé]dictif|donn[eé]es\s+publiques|base\s+de\s+donn[eé]es)\b/i;

/** Mentions d'achat / détention — interdites produit. */
const ACQUISITION_LEAK =
  /\b(acquis|acquisition|achet[eé]|achat|d[eé]tention|depuis\s+\d+\s+ans?|il\s+y\s+a\s+\d+\s+ans?\s+que|propri[eé]taire\s+depuis|achet[eé]\s+en\s+\d{4}|en\s+\d{4}\s*[,\.]?\s*(vous\s+avez\s+)?achet)\b/i;

export type LeadForApproach = {
  address: string;
  property_type: string | null;
  surface_m2: number | null;
  etage: string | null;
  score: number | null;
  acquired_year: number | null;
  owner_type: string | null;
  owner_name: string | null;
  owner_company: string | null;
  company_name: string | null;
  display_signals: unknown;
  signals: unknown;
  contacts_immeuble: unknown;
  /** Notes internes agents — contexte terrain prioritaire. */
  notes: string | null;
};

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Labels affichables pour l'agent — on garde le sens métier, on retire le jargon source. */
function sanitizeSignalLabel(label: string): string {
  let s = label.trim();
  s = s.replace(/\bDVF\b/gi, 'ventes');
  s = s.replace(/\bBODACC\b/gi, 'annonce légale');
  // Pas de fenêtre « ces X dernières années / mois » dans le brief.
  s = s.replace(/\s*ces\s+\d+\s+derni[eè]res?\s+ann[eé]es?/gi, '');
  s = s.replace(/\s*ces\s+\d+\s+derniers?\s+mois/gi, '');
  s = s.replace(/\s*au\s+cours\s+des\s+\d+\s+derni[eè]res?\s+ann[eé]es?/gi, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

function signauxEnClair(lead: LeadForApproach): string[] {
  const labels: string[] = [];
  const ds = lead.display_signals;
  if (ds && typeof ds === 'object' && !Array.isArray(ds)) {
    const root = ds as Record<string, unknown>;
    const dpe = root.dpe;
    if (dpe && typeof dpe === 'object') {
      const items = (dpe as { items?: unknown }).items;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && typeof item === 'object' && typeof (item as { label?: unknown }).label === 'string') {
            labels.push(sanitizeSignalLabel((item as { label: string }).label));
          }
        }
      }
    }
    const cascade = root.cascade;
    if (cascade && typeof cascade === 'object') {
      const c = cascade as { nb_ventes?: unknown; dates?: unknown };
      const nb = c.nb_ventes;
      if (nb != null && Number(nb) > 0) {
        const dates = Array.isArray(c.dates)
          ? c.dates.filter((d) => typeof d === 'string').join(', ')
          : '';
        labels.push(
          `${nb} vente(s) récente(s) dans l'immeuble${dates ? ` (${dates})` : ''}`,
        );
      }
    }
    const evts = root.evenements_vie;
    if (Array.isArray(evts)) {
      for (const item of evts) {
        if (typeof item === 'string' && item.trim()) {
          labels.push(sanitizeSignalLabel(item));
        } else if (
          item &&
          typeof item === 'object' &&
          typeof (item as { label?: unknown }).label === 'string'
        ) {
          labels.push(sanitizeSignalLabel((item as { label: string }).label));
        }
      }
    }
  }

  const signals = lead.signals;
  if (signals && typeof signals === 'object' && !Array.isArray(signals)) {
    const main =
      (signals as { main_signal?: unknown; main_signal_label?: unknown }).main_signal ??
      (signals as { main_signal_label?: unknown }).main_signal_label;
    if (typeof main === 'string' && main.trim()) {
      const mainS = sanitizeSignalLabel(main);
      if (!labels.includes(mainS)) labels.unshift(mainS);
    }
  }

  return labels;
}

export function buildDonneesBloc(lead: LeadForApproach): string {
  const lines: string[] = [];
  const add = (label: string, value: unknown) => {
    if (value == null) return;
    if (typeof value === 'string' && !value.trim()) return;
    if (Array.isArray(value) && value.length === 0) return;
    lines.push(`- ${label} : ${value}`);
  };

  add('adresse', lead.address);
  add('type de bien', lead.property_type);
  if (lead.surface_m2 != null) add('surface', `${lead.surface_m2} m²`);
  if (lead.etage != null && String(lead.etage).trim() !== '') add('étage', lead.etage);
  // Jamais année d'achat / durée de détention — interdit produit.

  const notes = typeof lead.notes === 'string' ? lead.notes.trim() : '';
  if (notes) {
    // Tronque si très long pour rester dans le contexte utile.
    const clipped = notes.length > 1200 ? `${notes.slice(0, 1199).trimEnd()}…` : notes;
    lines.push(
      `- NOTES INTERNES DES AGENTS (PRIORITAIRE — historique terrain à respecter) : ${clipped}`,
    );
  }

  const signaux = signauxEnClair(lead);
  if (signaux.length > 0) {
    add(
      'faits importants à intégrer dans le prompt (choisis les plus utiles)',
      signaux.join(' ; '),
    );
  }

  add('nom du propriétaire / interlocuteur', lead.owner_name);
  add('société', lead.owner_company || lead.company_name);
  add('type de propriétaire', lead.owner_type || 'particulier');

  return lines.length > 0 ? lines.join('\n') : '- (aucune donnée structurée)';
}

function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  try {
    const data = JSON.parse(trimmed) as unknown;
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    // fallthrough
  }
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[0]) as unknown;
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function mistralChat(prompt: string, apiKey: string): Promise<string | null> {
  const res = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            "Tu rédiges des prompts de prospection pour agents immobiliers (téléphone ET porte). Ouverture standard : « je vous contacte ». Jamais « je vous appelle » ni « venir vous voir ». JSON uniquement.",
        },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    console.error('[approach] Mistral HTTP', res.status, await res.text().catch(() => ''));
    return null;
  }
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return body.choices?.[0]?.message?.content ?? null;
}

function looksLikePlaceholder(text: string): boolean {
  return /\[[^\]]+\]|\{[^}]+\}|Nom de l['']agence|votre agence|XXX/i.test(text);
}

function stripForbiddenTimeWindows(text: string): string {
  let s = text;
  s = s.replace(/\s*,?\s*ces\s+\d+\s+derni[eè]res?\s+ann[eé]es?/gi, '');
  s = s.replace(/\s*,?\s*ces\s+(trois|3)\s+derni[eè]res?\s+ann[eé]es?/gi, '');
  s = s.replace(/\s*,?\s*ces\s+\d+\s+derniers?\s+mois/gi, '');
  s = s.replace(/\s*,?\s*au\s+cours\s+des\s+\d+\s+derni[eè]res?\s+ann[eé]es?/gi, '');
  s = s.replace(/\s{2,}/g, ' ').replace(/\s+([,.—–])/g, '$1').trim();
  return s;
}

/** Canal figé (téléphone / porte) — « je vous contacte » est autorisé. */
const CHANNEL_LEAK =
  /\b(je\s+vous\s+(appelle|t[eé]l[eé]phone|joi[gn]ds|joinds)|je\s+vous\s+[eé]cris|au\s+t[eé]l[eé]phone|coup\s+de\s+fil|suite\s+[aà]\s+mon\s+appel|je\s+passe\s+un\s+coup|je\s+me\s+permets\s+de\s+venir|venir\s+vous\s+voir|passer\s+[aà]\s+la\s+porte)\b/i;

function normalizeIntroTexte(raw: Record<string, unknown>): string | null {
  const texte =
    (typeof raw.texte === 'string' && raw.texte.trim()) ||
    (typeof raw.intro === 'string' && raw.intro.trim()) ||
    (typeof raw.ouverture === 'string' && raw.ouverture.trim()) ||
    '';
  if (!texte) return null;
  if (looksLikePlaceholder(texte)) return null;
  let out = stripForbiddenTimeWindows(texte);
  if (out.length > MAX_OUVERTURE_CHARS) {
    out = `${out.slice(0, MAX_OUVERTURE_CHARS - 1).trimEnd()}…`;
  }
  if (LEAK_PATTERNS.test(stripAccents(out))) return null;
  if (ACQUISITION_LEAK.test(stripAccents(out))) return null;
  if (CHANNEL_LEAK.test(stripAccents(out))) return null;
  return out;
}

export async function generateScriptApprocheForLead(
  lead: LeadForApproach,
): Promise<(ScriptApprocheStored & { intro?: string }) | null> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY_MISSING');
  }

  const prompt = PROMPT_TEMPLATE.replace('{donnees}', buildDonneesBloc(lead));

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const rawText = await mistralChat(prompt, apiKey);
    if (!rawText) continue;
    const parsed = extractJson(rawText);
    if (!parsed) continue;
    const texte = normalizeIntroTexte(parsed);
    if (!texte) continue;
    return toStoredIntro(texte);
  }
  return null;
}

/** Re-parse un blob stocké pour la réponse API. */
export function parseStoredOrThrow(raw: unknown): ScriptApproche {
  const parsed = parseScriptApproche(raw);
  if (!parsed) throw new Error('SCRIPT_INVALID');
  return parsed;
}
