import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { searchPatterns, significantSearchTokens } from './normalize';
import { buildSearchHits } from './search';

describe('searchPatterns', () => {
  it('extrait la voie d’une question', () => {
    assert.deepEqual(significantSearchTokens("qu'est ce que tu sais rue vitruve ?"), ['vitruve']);
    assert.ok(searchPatterns("qu'est ce que tu sais rue vitruve ?").includes('rue vitruve'));
  });
});

describe('buildSearchHits', () => {
  const viewer = { id: 'u1', role: 'directeur' as const };

  it('trouve une dictée par transcript', () => {
    const hits = buildSearchHits(
      'mandat signé',
      {
        leads: [],
        contacts: [],
        biens: [],
        notes: [
          {
            id: 'n1',
            transcript: 'Le mandat signé hier chez le propriétaire',
            adresse_normalisee: '11 square Vitruve',
            contact_id: 'c1',
            created_by: 'u1',
            visibilite: 'agence',
            created_at: '2026-08-20T08:00:00Z',
          },
        ],
        interactions: [],
      },
      viewer,
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.kind, 'note');
  });

  it('trouve un bien rue Vitruve dans une question en langage naturel', () => {
    const hits = buildSearchHits(
      "qu'est ce que tu sais rue vitruve ?",
      {
        leads: [],
        contacts: [],
        biens: [
          {
            id: 'b1',
            address: '5 Rue Vitruve',
            city: 'Paris',
            postal_code: '75020',
            listing_title: 'Mandat simple',
            created_by: 'u1',
          },
        ],
        notes: [],
        interactions: [],
      },
      viewer,
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.kind, 'bien');
    assert.match(hits[0]?.label ?? '', /Vitruve/i);
  });

  it('trouve un contact par téléphone', () => {
    const hits = buildSearchHits(
      '061234',
      {
        leads: [],
        contacts: [
          {
            id: 'c1',
            first_name: 'Jean',
            last_name: 'Dupont',
            phone: '06 12 34 56 78',
            email: null,
            summary: null,
            address: null,
            contact_type: 'vendeur',
            assigned_to: null,
            created_by: 'u1',
          },
        ],
        biens: [],
        notes: [],
        interactions: [],
      },
      viewer,
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.kind, 'contact');
  });
});

describe('recherche de personnes tolérante aux fautes', () => {
  const viewer = { id: 'u1', role: 'directeur' as const };

  function contact(id: string, first: string, last: string) {
    return {
      id,
      first_name: first,
      last_name: last,
      address: null,
      phone: null,
      email: null,
      summary: null,
      contact_type: 'vendeur',
      assigned_to: null,
      created_by: 'u1',
    };
  }

  const rows = {
    leads: [],
    contacts: [
      contact('c1', 'Cécile', 'Ropiot'),
      contact('c2', 'Cécile', 'Ropiot'),
      contact('c3', 'Jean', 'Martin'),
    ],
    biens: [],
    notes: [],
    interactions: [],
  };

  it('retrouve un nom mal orthographié', () => {
    const ids = buildSearchHits('Cécile ROPIOTY', rows, viewer).map((h) => h.id);
    assert.deepEqual(ids.sort(), ['c1', 'c2']);
  });

  it('remonte les deux fiches sur le seul nom de famille', () => {
    assert.equal(buildSearchHits('Ropiot', rows, viewer).length, 2);
  });

  it('ignore l’ordre des mots', () => {
    assert.equal(buildSearchHits('Ropiot Cécile', rows, viewer).length, 2);
  });

  it('ignore les accents manquants', () => {
    assert.equal(buildSearchHits('cecile ropiot', rows, viewer).length, 2);
  });

  it('laisse de côté un nom sans rapport', () => {
    const ids = buildSearchHits('Ropiot', rows, viewer).map((h) => h.id);
    assert.equal(ids.includes('c3'), false);
  });
});

describe('buildSearchHits — une phrase ne ramène pas toute la base', () => {
  const viewer = { id: 'u1', role: 'directeur' as const };
  const contact = (id: string, nom: string, summary: string) => ({
    id,
    first_name: nom,
    last_name: null,
    phone: null,
    email: null,
    summary,
    contact_type: 'acquereur',
    created_by: 'u1',
    visibilite: 'agence' as const,
  });
  const rows = {
    leads: [],
    contacts: [
      contact('c1', 'Alice', 'Cherche un bien avec balcon dans le 11e'),
      contact('c2', 'Bruno', 'Cherche un bien près du métro'),
      contact('c3', 'Chloé', 'Veut un bien neuf, cherche en banlieue'),
    ],
    biens: [],
    notes: [],
    interactions: [],
  };

  it('le vocabulaire de la question ne compte pas : seul « 11e » discrimine', () => {
    const hits = buildSearchHits('qui cherche un bien dans le 11e', rows, viewer);
    assert.deepEqual(hits.map((h) => h.id), ['c1']);
  });

  it('plusieurs mots : la fiche doit tous les contenir', () => {
    assert.deepEqual(buildSearchHits('balcon métro', rows, viewer), []);
    assert.deepEqual(buildSearchHits('balcon 11e', rows, viewer).map((h) => h.id), ['c1']);
  });

  it('une question ne remonte aucune dictée ni échange', () => {
    const hits = buildSearchHits(
      'qui cherche un bien près du métro ?',
      {
        ...rows,
        notes: [
          {
            id: 'n1',
            transcript: 'Il cherche un bien près du métro',
            adresse_normalisee: null,
            contact_id: null,
            created_by: 'u1',
            visibilite: 'agence',
            created_at: '2026-10-01T08:00:00Z',
          },
        ],
      },
      viewer,
    );
    assert.ok(hits.every((h) => h.kind !== 'note'));
  });
});
