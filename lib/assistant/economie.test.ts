import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cacheKey, clearAnswerCache, readCachedAnswer, writeCachedAnswer } from './cache';
import { MAX_CHAMP_CHARS, MAX_LIGNES_MODELE, payloadBorne } from './context-budget';
import { peutRepondreDirect, reponseDirecte } from './direct-answer';
import {
  construireContexte,
  doitRegenererResume,
  messagesPourModele,
  titreDepuisQuestion,
} from './conversation';
import { debutDuMois, etatBudget, moisCourant } from './budget';
import { tierForAnswer } from './models';
import type { CollecteResult } from './collecte';

function collecte(over: Partial<CollecteResult> = {}): CollecteResult {
  return {
    type: 'immeuble',
    cherche: '12 rue Vitruve',
    banId: null,
    rechercheParTexte: false,
    lignes: [],
    sources: [],
    agregats: null,
    ...over,
  };
}

function ligne(i: number, faits: Record<string, unknown> = {}) {
  return {
    kind: 'lead' as const,
    id: `l${i}`,
    date: '2026-08-20T10:00:00Z',
    auteur: 'Simon',
    faits: { adresse: `${i} rue Vitruve`, ...faits },
  };
}

describe('cache par agence', () => {
  it('sépare deux agences sur la même question', () => {
    assert.notEqual(cacheKey('a1', 'combien de leads'), cacheKey('a2', 'combien de leads'));
  });

  it('ignore casse, accents et ponctuation', () => {
    assert.equal(cacheKey('a1', 'Combien de leads ?'), cacheKey('a1', 'combien   de leads'));
  });

  it('rend la réponse mémorisée puis expire', () => {
    clearAnswerCache();
    const value = { reponse: 'ok', sources: [], vide: false, tokens: 12 };
    writeCachedAnswer('a1', 'combien de leads', value, 1_000);
    assert.deepEqual(readCachedAnswer('a1', 'Combien de leads ?', 2_000), value);
    assert.equal(readCachedAnswer('a1', 'combien de leads', 1_000 + 15 * 60 * 1000 + 1), null);
  });

  it('ne rend rien à une autre agence', () => {
    clearAnswerCache();
    writeCachedAnswer('a1', 'q', { reponse: 'ok', sources: [], vide: false, tokens: 0 }, 0);
    assert.equal(readCachedAnswer('a2', 'q', 1), null);
  });
});

describe('plafond de contexte', () => {
  it('coupe à 20 lignes et annonce les omises', () => {
    const lignes = Array.from({ length: 26 }, (_, i) => ligne(i));
    const out = payloadBorne(collecte({ lignes }));
    assert.equal(out.envoyees, MAX_LIGNES_MODELE);
    assert.equal(out.omises, 6);
    assert.equal((out.payload.lignes as unknown[]).length, MAX_LIGNES_MODELE);
    assert.equal(out.payload.lignes_total, 26);
  });

  it('tronque les champs texte longs', () => {
    const long = 'x'.repeat(400);
    const out = payloadBorne(collecte({ lignes: [ligne(1, { notes: long })] }));
    const first = (out.payload.lignes as Array<Record<string, unknown>>)[0]!;
    assert.equal(String(first.notes).length, MAX_CHAMP_CHARS + 1);
  });

  it('retire les champs vides plutôt que de les facturer', () => {
    const out = payloadBorne(collecte({ lignes: [ligne(1, { notes: null, ville: '' })] }));
    const first = (out.payload.lignes as Array<Record<string, unknown>>)[0]!;
    assert.equal('notes' in first, false);
    assert.equal('ville' in first, false);
  });
});

describe('réponse directe', () => {
  it('court-circuite le modèle sous 5 lignes factuelles', () => {
    assert.equal(peutRepondreDirect(collecte({ lignes: [ligne(1), ligne(2)] })), true);
  });

  it('passe par le modèle au-delà de 5 lignes', () => {
    const lignes = Array.from({ length: 6 }, (_, i) => ligne(i));
    assert.equal(peutRepondreDirect(collecte({ lignes })), false);
  });

  it('ne court-circuite pas une intention inconnue ni un résultat vide', () => {
    assert.equal(peutRepondreDirect(collecte({ type: 'inconnu', lignes: [ligne(1)] })), false);
    assert.equal(peutRepondreDirect(collecte({ lignes: [] })), false);
  });

  it('met en forme sans rien inventer', () => {
    const texte = reponseDirecte(collecte({ lignes: [ligne(1, { statut: 'nouveau' })] }));
    assert.ok(texte.includes('1 rue Vitruve'));
    assert.ok(texte.includes('Statut : nouveau'));
    assert.ok(texte.includes('Prospect'));
  });
});

describe('paliers de modèle', () => {
  it('trie sur le petit modèle, synthétise sur le grand', () => {
    assert.equal(tierForAnswer({ lignesCount: 3, kinds: ['lead'] }), 'tri');
    assert.equal(tierForAnswer({ lignesCount: 12, kinds: ['lead'] }), 'synthese');
    assert.equal(tierForAnswer({ lignesCount: 3, kinds: ['lead', 'contact'] }), 'synthese');
  });
});

describe('mémoire de conversation', () => {
  const msgs = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      contenu: `m${i}`,
    }));

  it('ne renvoie que les six derniers messages', () => {
    const ctx = construireContexte(msgs(20), 'résumé');
    assert.equal(ctx.recents.length, 6);
    assert.deepEqual(
      ctx.recents.map((m) => m.contenu),
      ['m14', 'm15', 'm16', 'm17', 'm18', 'm19'],
    );
    assert.equal(ctx.couvertsParResume, 14);
    assert.equal(ctx.resume, 'résumé');
  });

  it('ignore le résumé tant que rien n’est sorti de la fenêtre', () => {
    const ctx = construireContexte(msgs(4), 'résumé');
    assert.equal(ctx.resume, null);
    assert.equal(ctx.couvertsParResume, 0);
  });

  it('régénère le résumé par paliers de six, pas à chaque tour', () => {
    assert.equal(doitRegenererResume(6, 0), false);
    assert.equal(doitRegenererResume(11, 0), false);
    assert.equal(doitRegenererResume(12, 0), true);
    assert.equal(doitRegenererResume(13, 6), false);
    assert.equal(doitRegenererResume(18, 6), true);
  });

  it('n’envoie jamais tout le fil au modèle', () => {
    const ctx = construireContexte(msgs(40), 'résumé');
    const out = messagesPourModele('SYS', ctx, 'nouvelle question', '{}');
    assert.equal(out.length, 1 + 1 + 6 + 1);
    assert.equal(out[0]!.role, 'system');
    assert.ok(out[1]!.content.startsWith('Résumé des échanges précédents'));
    assert.ok(out[out.length - 1]!.content.includes('nouvelle question'));
  });

  it('titre la conversation avec la première question', () => {
    assert.equal(titreDepuisQuestion('  Combien de leads ce mois ? '), 'Combien de leads ce mois ?');
    assert.equal(titreDepuisQuestion(''), 'Conversation');
    const long = titreDepuisQuestion('a'.repeat(200));
    assert.ok(long.length <= 71);
    assert.ok(long.endsWith('…'));
  });
});

describe('budget mensuel', () => {
  it('signale le dépassement', () => {
    assert.deepEqual(etatBudget(10, 100), {
      consommes: 10,
      plafond: 100,
      restants: 90,
      depasse: false,
    });
    assert.equal(etatBudget(100, 100).depasse, true);
    assert.equal(etatBudget(150, 100).restants, 0);
  });

  it('cadre le mois en UTC', () => {
    const d = debutDuMois(new Date('2026-08-28T22:00:00Z'));
    assert.equal(d.toISOString(), '2026-08-01T00:00:00.000Z');
    assert.equal(moisCourant(new Date('2026-01-05T00:00:00Z')), '2026-01');
  });
});
