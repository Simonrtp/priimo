import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_INTENT, type AssistantIntent } from './intent';
import { LIGNES_AVANT_RENVOI, listeVersEcran } from './liste-ecran';
import {
  EXEMPLES_QUESTIONS,
  MESSAGE_AIDE,
  messageAucuneLigne,
  messageProduitInconnu,
} from './messages';

function intent(patch: Partial<AssistantIntent>): AssistantIntent {
  return { ...EMPTY_INTENT, ...patch };
}

describe('MESSAGE_AIDE', () => {
  it('dit qu’on n’a pas compris, pas qu’il n’y a pas de données', () => {
    assert.match(MESSAGE_AIDE, /n'ai pas compris/);
    assert.doesNotMatch(MESSAGE_AIDE, /aucune information/i);
  });

  it('donne trois exemples réellement traitables', () => {
    assert.equal(EXEMPLES_QUESTIONS.length, 3);
    for (const exemple of EXEMPLES_QUESTIONS) assert.ok(MESSAGE_AIDE.includes(exemple));
  });
});

describe('messageAucuneLigne', () => {
  it('propose les correspondances proches sur un nom', () => {
    const texte = messageAucuneLigne(intent({ type: 'personne', nom: 'Ropioty' }), [
      { id: 'c1', nom: 'Cécile Ropiot', href: '/dashboard/contacts?fiche=c1' },
    ]);
    assert.match(texte, /Aucun contact nommé Ropioty/);
    assert.match(texte, /Vouliez-vous dire Cécile Ropiot/);
  });

  it('énumère plusieurs correspondances proches', () => {
    const texte = messageAucuneLigne(intent({ type: 'personne', nom: 'Ropi' }), [
      { id: 'c1', nom: 'Cécile Ropiot', href: '/x' },
      { id: 'c2', nom: 'Paul Ropion', href: '/y' },
    ]);
    assert.match(texte, /Cécile Ropiot ou Paul Ropion/);
  });

  it('reste net quand rien n’est proche', () => {
    const texte = messageAucuneLigne(intent({ type: 'personne', nom: 'Zzz' }));
    assert.match(texte, /Aucun contact nommé Zzz/);
    assert.doesNotMatch(texte, /Vouliez-vous dire/);
  });

  it('ne parle jamais d’activité du jour pour une adresse', () => {
    const texte = messageAucuneLigne(intent({ type: 'immeuble', adresse: '12 rue Vitruve' }));
    assert.match(texte, /12 rue Vitruve/);
    assert.doesNotMatch(texte, /activité/i);
  });

  it('ne parle d’activité que pour une question d’activité', () => {
    assert.match(messageAucuneLigne(intent({ type: 'activite', periode_jours: 1 })), /aujourd/i);
    assert.match(messageAucuneLigne(intent({ type: 'activite', periode_jours: 30 })), /30 derniers/);
  });
});

describe('messageProduitInconnu', () => {
  it('dit ce qu’il sait expliquer plutôt que de se taire', () => {
    const texte = messageProduitInconnu();
    assert.match(texte, /pas de réponse documentée/);
    assert.match(texte, /score/);
  });
});

describe('listeVersEcran', () => {
  const lignes = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      kind: 'lead' as const,
      id: `l${i}`,
      date: null,
      auteur: null,
      faits: {},
    }));

  it('ne renvoie nulle part sous le seuil', () => {
    assert.equal(
      listeVersEcran(intent({ type: 'personne', nom: 'Ropiot' }), {
        lignes: lignes(LIGNES_AVANT_RENVOI),
      }),
      null,
    );
  });

  it('renvoie vers les contacts filtrés au-delà du seuil', () => {
    const out = listeVersEcran(intent({ type: 'personne', nom: 'Ropiot' }), { lignes: lignes(9) });
    assert.equal(out?.total, 9);
    assert.equal(out?.href, '/dashboard/contacts?q=Ropiot');
  });

  it('renvoie vers la prospection pour une adresse', () => {
    const out = listeVersEcran(intent({ type: 'immeuble', adresse: '12 rue Vitruve' }), {
      lignes: lignes(12),
    });
    assert.match(out!.href, /^\/dashboard\/prospection\?q=12%20rue%20Vitruve/);
  });

  it('renvoie vers les acquéreurs avec le secteur', () => {
    const out = listeVersEcran(
      intent({ type: 'recherche_acquereur', code_postal: '75020' }),
      { lignes: lignes(8) },
    );
    assert.equal(out?.href, '/dashboard/contacts?type=acquereur&q=75020');
  });

  it('ne fabrique pas de lien sans filtre exploitable', () => {
    assert.equal(listeVersEcran(intent({ type: 'personne' }), { lignes: lignes(8) }), null);
    assert.equal(listeVersEcran(intent({ type: 'produit' }), { lignes: lignes(8) }), null);
  });
});
