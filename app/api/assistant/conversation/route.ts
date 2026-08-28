import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { MESSAGE_PLAFOND_ATTEINT, debutDuMois, etatBudget } from '@/lib/assistant/budget';
import { readCachedAnswer, writeCachedAnswer } from '@/lib/assistant/cache';
import { collecter, type AssistantSource } from '@/lib/assistant/collecte';
import { payloadBorne } from '@/lib/assistant/context-budget';
import {
  construireContexte,
  doitRegenererResume,
  messagesAResumer,
  messagesPourModele,
} from '@/lib/assistant/conversation';
import { peutRepondreDirect, reponseDirecte } from '@/lib/assistant/direct-answer';
import { interpretQuestion } from '@/lib/assistant/interpret';
import type { AssistantIntent } from '@/lib/assistant/intent';
import { journaliserRequete } from '@/lib/assistant/journal';
import { MESSAGE_AIDE, messageAucuneLigne, messageProduitInconnu } from '@/lib/assistant/messages';
import {
  chercherProduit,
  contexteProduit,
  PRODUIT_SYSTEM_PROMPT,
  reponseProduitDirecte,
} from '@/lib/assistant/produit';
import { listeVersEcran, type VoirTout } from '@/lib/assistant/liste-ecran';
import { chatStream } from '@/lib/assistant/mistral';
import { stableSystemMessage, tierForAnswer } from '@/lib/assistant/models';
import { REFORMULER_SYSTEM_PROMPT } from '@/lib/assistant/repondre';
import { regenererResume } from '@/lib/assistant/resume';
import { routeQuestion } from '@/lib/assistant/router';
import {
  ajouterMessage,
  chargerConversation,
  creerConversation,
  toucherConversation,
} from '@/lib/queries/assistant-conversations';
import { fetchMembersOfMyAgency, memberNamesById } from '@/lib/queries/agency-members';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { MistralKeyMissingError, requireMistralKey } from '@/lib/voice/transcribe';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_QUESTION = 500;
const MAX_OUTPUT_TOKENS = 400;

type Body = { question?: unknown; conversationId?: unknown };

function lireQuestion(body: Body): string | null {
  if (typeof body.question !== 'string') return null;
  const q = body.question.trim();
  return q ? q.slice(0, MAX_QUESTION) : null;
}

function lireConversationId(body: Body): string | null {
  return typeof body.conversationId === 'string' && body.conversationId.trim()
    ? body.conversationId.trim()
    : null;
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const started = Date.now();
  const ip = clientIpFromRequest(req);
  const limit = rateLimit(`assistant-conversation:${ip}`, {
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de questions coup sur coup. Réessayez dans un instant.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }

  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const question = lireQuestion(body);
  if (!question) {
    return NextResponse.json({ error: 'Question manquante' }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = requireMistralKey();
  } catch (err) {
    if (err instanceof MistralKeyMissingError) {
      return NextResponse.json(
        { error: "L'assistant n'est pas disponible pour le moment." },
        { status: 503 },
      );
    }
    throw err;
  }

  const supabase = await createSupabaseServerClient();

  // Plafond mensuel de l'agence : un message en français, pas une erreur.
  const { data: consommes } = await supabase.rpc('assistant_tokens_du_mois', {
    p_agency_id: agency.id,
    p_debut: debutDuMois().toISOString(),
  });
  const budget = etatBudget(Number(consommes ?? 0));
  if (budget.depasse) {
    return NextResponse.json(
      { error: MESSAGE_PLAFOND_ATTEINT, plafondAtteint: true },
      { status: 200 },
    );
  }

  // Fil existant, ou nouveau fil titré par la première question.
  const demandeId = lireConversationId(body);
  const existant = demandeId ? await chargerConversation(supabase, demandeId, profile.id) : null;
  const conversationId =
    existant?.id ??
    (await creerConversation(supabase, {
      agencyId: agency.id,
      profileId: profile.id,
      premiereQuestion: question,
    }));
  if (!conversationId) {
    return NextResponse.json({ error: "La conversation n'a pas pu être ouverte." }, { status: 500 });
  }

  // a) Routage par règles AVANT tout appel de modèle.
  const route = routeQuestion(question);
  let intent: AssistantIntent | null = route?.intent ?? null;
  let tokensIntention = 0;
  if (!intent) {
    intent = await interpretQuestion(question, apiKey);
    // L'interprétation est facturée même quand elle échoue : ~250 tokens.
    tokensIntention = 250;
  }

  const viewer = viewerFromProfile(profile);
  const members = await fetchMembersOfMyAgency(agency.id, memberships);

  let sources: AssistantSource[] = [];
  let texteDirect: string | null = null;
  /** Lignes mises en forme, servies si la reformulation échoue. */
  let repli = '';
  let donnees = '';
  let tierSynthese: 'tri' | 'synthese' = 'tri';
  let systemPrompt = REFORMULER_SYSTEM_PROMPT;
  let lignesCount = 0;
  let depuisCache = false;
  let voirTout: VoirTout | null = null;

  if (intent.type === 'inconnu') {
    texteDirect = MESSAGE_AIDE;
  } else if (intent.type === 'produit') {
    // Aucune collecte SQL : la réponse vient de la base de connaissance.
    const produit = chercherProduit(question);
    const direct = reponseProduitDirecte(produit);
    sources = produit.ecrans.map((e) => ({
      kind: 'bien' as const,
      id: e.href,
      typeLabel: 'Ecran',
      titre: e.titre,
      date: null,
      auteur: null,
      href: e.href,
    }));
    if (produit.sujets.length === 0) {
      texteDirect = messageProduitInconnu();
      sources = [];
    } else if (direct) {
      texteDirect = direct;
    } else {
      donnees = contexteProduit(produit);
      repli = produit.sujets.map((sujet) => sujet.corps).join('\n\n');
      systemPrompt = PRODUIT_SYSTEM_PROMPT;
    }
  } else {
    // d) Cache par agence — mêmes données, même quart d'heure.
    const cache = readCachedAnswer(agency.id, question);
    if (cache) {
      texteDirect = cache.reponse;
      sources = cache.sources as AssistantSource[];
      depuisCache = true;
    } else {
      const collecte = await collecter(intent, supabase, {
        agencyId: agency.id,
        viewer,
        auteurNoms: memberNamesById(members),
      });
      sources = collecte.sources;
      lignesCount = collecte.lignes.length;

      voirTout = listeVersEcran(intent, collecte);

      if (lignesCount === 0) {
        texteDirect = messageAucuneLigne(intent, collecte.proches ?? []);
      } else if (peutRepondreDirect(collecte)) {
        // c) Cinq lignes ou moins et intention factuelle : aucun second appel.
        texteDirect = reponseDirecte(collecte);
      } else {
        // e) Contexte plafonné : 20 lignes, champs coupés à 200 caractères.
        const borne = payloadBorne(collecte);
        donnees = JSON.stringify(borne.payload);
        repli = reponseDirecte(collecte);
        tierSynthese = tierForAnswer({
          lignesCount,
          kinds: collecte.lignes.map((l) => l.kind),
        });
      }
    }
  }

  const contexte = construireContexte(existant?.messages ?? [], existant?.resume ?? null);
  const totalApres = (existant?.total ?? 0) + 2;
  const dejaResumes = existant?.resume ? messagesAResumer(existant.total) : 0;

  await ajouterMessage(supabase, { conversationId, role: 'user', contenu: question });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      push('meta', {
        conversationId,
        nouveau: !existant,
        question,
        voirTout,
        lignesTotal: lignesCount,
      });
      push('sources', sources);

      let texte = texteDirect ?? '';
      let tokens = tokensIntention;

      try {
        if (texteDirect !== null) {
          push('delta', { t: texteDirect });
        } else {
          const out = await chatStream({
            tier: tierSynthese,
            apiKey,
            maxTokens: MAX_OUTPUT_TOKENS,
            messages: messagesPourModele(systemPrompt, contexte, question, donnees).map((m) =>
              m.role === 'system' && m.content === systemPrompt ? stableSystemMessage(m.content) : m,
            ),
            onDelta: (fragment) => push('delta', { t: fragment }),
          });

          if (out) {
            texte = out.texte;
            tokens += out.usage.total;
          } else {
            // Le service n'a rien produit : les lignes existent, le style est
            // un confort. On sert les données brutes, pas une erreur.
            texte = repli;
            push('delta', { t: texte });
          }
        }

        await ajouterMessage(supabase, {
          conversationId,
          role: 'assistant',
          contenu: texte,
          sources,
          tokens,
        });

        // Résumé roulant : régénéré tous les six messages, jamais à chaque tour.
        let resume: string | null | undefined;
        if (doitRegenererResume(totalApres, dejaResumes)) {
          const horsFenetre = (existant?.messages ?? []).slice(
            0,
            Math.max(0, totalApres - 6),
          );
          const out = await regenererResume(horsFenetre, existant?.resume ?? null, apiKey);
          if (out) {
            resume = out.texte;
            tokens += out.tokens;
          }
        }
        await toucherConversation(supabase, conversationId, resume);

        if (!depuisCache && intent.type !== 'inconnu' && texte) {
          writeCachedAnswer(agency.id, question, { reponse: texte, sources, vide: lignesCount === 0, tokens });
        }

        await journaliserRequete(supabase, {
          agencyId: agency.id,
          profileId: profile.id,
          question,
          type: intent.type,
          lignesCount,
          durationMs: Date.now() - started,
        });

        push('done', {
          conversationId,
          tokens,
          cache: depuisCache,
          sansModele: texteDirect !== null,
          route: route?.forme ?? null,
        });
      } catch (error) {
        console.error('[assistant] conversation', error);
        push('erreur', { message: "La réponse n'a pas pu être produite." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
    },
  });
}
