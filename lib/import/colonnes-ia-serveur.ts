/**
 * Relecture des colonnes, partie serveur : Mon assistant (Mistral) et la
 * mémoire des formats déjà importés.
 *
 * Un format retenu, c'est l'empreinte de ses en-têtes (SHA-256, dans l'ordre)
 * et des numéros de colonnes : aucun texte du fichier. Commun à toutes les
 * agences : un export Hektor relié une fois est reconnu partout.
 */
import 'server-only';
import { createHash } from 'node:crypto';
import { chaineModeles, ecarterModele, MODELES_PROFONDS } from '@/lib/mistral/modeles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeHeader } from './normalize';
import { validerColonnes, type ColonnesIndex } from './colonnes-ia';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const DELAI_MS = 15_000;

const SYSTEME = `Tu relies les colonnes d'un fichier de contacts d'agent immobilier français (export de CRM, de téléphone, d'Outlook, ou tableur fait main) aux champs de Priimo.
Pour chaque colonne tu reçois son numéro, son en-tête et jusqu'à trois exemples (les chiffres au-delà des deux premiers sont remplacés par des zéros, le début des emails est masqué).

Champs Priimo :
- firstName : prénom seul, dans sa propre colonne
- lastName : nom de famille seul, dans sa propre colonne
- fullName : une seule colonne qui contient à la fois le nom et le prénom (« Nom / Prénom », « Nom complet », « Contact », « Client » avec des exemples comme « DUPONT Jean »), ou une raison sociale. Dans ce cas, ni firstName ni lastName.
- phone : téléphone principal (le portable de préférence)
- phone2 : un autre téléphone
- email : adresse email
- type : rôle ou projet du contact (vendeur, propriétaire, acquéreur, acheteur, locataire, « achat », « vente »…)
- secteur : quartier ou zone recherchée
- address : adresse postale (numéro et voie)
- ville : ville, même si la colonne contient aussi le code postal (« 75002 Paris »)
- postalCodes : code postal, seulement dans une colonne qui lui est propre
- budgetMax : budget (un budget seul est un maximum)
- budgetMin : budget minimum, seulement s'il est explicitement un minimum
- surfaceMin : surface recherchée
- roomsMin : nombre de pièces recherché
- summary : le commentaire libre principal

Réponds UNIQUEMENT par un objet JSON :
{
  "premiere_ligne_est_une_donnee": true si les « en-têtes » reçus sont en fait les valeurs d'un contact et non des titres : un nom propre, un prénom, un numéro de téléphone, un email, un rôle comme « Vendeur ». Compare-les aux exemples : s'ils leur ressemblent, c'est true.
  "champs": { "<champ>": numéro de colonne ou null },
  "notes": [numéros des autres colonnes utiles à garder dans le résumé : historique, source, statut, date du dernier contact, négociateur, critères…]
}
Règles : une colonne sert au plus une fois ; null si le champ n'existe pas dans le fichier ; ne devine jamais ; jamais dans "notes" une colonne vide, une civilité (M., Mme), un identifiant interne, une date de création technique ou une colonne déjà reliée.`;

export function signatureEnTetes(enTetes: readonly string[]): string {
  return createHash('sha256').update(enTetes.map(normalizeHeader).join('|')).digest('hex');
}

async function demander(model: string, apiKey: string, contenu: string): Promise<unknown | null> {
  const attente = new AbortController();
  const timer = setTimeout(() => attente.abort(), DELAI_MS);
  try {
    const res = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: attente.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 600,
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
    return brut ? (JSON.parse(brut) as unknown) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Mon assistant relie les colonnes ; null si la clé manque ou si aucun modèle ne répond. */
export async function relireColonnesAvecAssistant(
  enTetes: readonly string[],
  exemples: readonly (readonly string[])[],
): Promise<ColonnesIndex | null> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey || enTetes.length === 0) return null;
  const contenu = JSON.stringify(
    enTetes.map((en_tete, numero) => ({ numero, en_tete, exemples: exemples[numero] ?? [] })),
  );
  for (const model of chaineModeles(MODELES_PROFONDS, process.env.MISTRAL_MODEL_IMPORT)) {
    const brut = await demander(model, apiKey, contenu);
    const colonnes = brut ? validerColonnes(brut, enTetes.length) : null;
    if (colonnes) return colonnes;
  }
  return null;
}

/** Un format déjà importé (par n'importe quelle agence) : sa correspondance, sans appel à Mistral. */
export async function formatConnu(enTetes: readonly string[]): Promise<ColonnesIndex | null> {
  try {
    const { data, error } = await createSupabaseAdminClient()
      .from('import_formats')
      .select('nb_colonnes, correspondance, notes')
      .eq('signature', signatureEnTetes(enTetes))
      .maybeSingle();
    if (error || !data || data.nb_colonnes !== enTetes.length) return null;
    return validerColonnes({ champs: data.correspondance, notes: data.notes }, enTetes.length);
  } catch {
    return null;
  }
}

/** Retient la correspondance d'un import lancé : la prochaine fois, ce format est reconnu d'emblée. */
export async function retenirFormat(
  enTetes: readonly string[],
  colonnes: { champs: Record<string, number>; notes: number[] },
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const signature = signatureEnTetes(enTetes);
    const { data: avant } = await admin
      .from('import_formats')
      .select('imports')
      .eq('signature', signature)
      .maybeSingle();
    const { error } = await admin.from('import_formats').upsert(
      {
        signature,
        nb_colonnes: enTetes.length,
        correspondance: colonnes.champs,
        notes: colonnes.notes,
        imports: (avant?.imports ?? 0) + 1,
        mis_a_jour_le: new Date().toISOString(),
      },
      { onConflict: 'signature' },
    );
    if (error && !/import_formats/.test(error.message)) console.error('[import] format', error.message);
  } catch (err) {
    console.error('[import] format', err);
  }
}
