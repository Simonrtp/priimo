import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Annonce } from './types';
import { assessAnnonce, mentionsLegales } from './completeness';
import { ExportDiffusionProvider } from './providers/export';

function annonce(overrides: Partial<Annonce> = {}): Annonce {
  return {
    reference: 'bien-1',
    titre: 'Appartement 3 pièces à Lille',
    description: 'Bel appartement.',
    type: 'Appartement',
    adresse: '12 rue de la Monnaie',
    codePostal: '59000',
    ville: 'Lille',
    prix: 250000,
    surfaceM2: 72,
    pieces: 3,
    photos: ['https://cdn.example/1.jpg'],
    dpeLettre: 'D',
    dpeKwh: 180,
    gesLettre: 'C',
    gesKgCo2: 25,
    dpeVierge: false,
    dpeDate: '2026-01-15',
    mandatStatut: 'mandat_exclusif',
    mandatNumero: 'M-42',
    mandatDate: '2026-03-01',
    honorairesMontant: 12000,
    honorairesACharge: 'acquereur',
    honorairesPourcent: 4.8,
    agenceNom: 'Agence Test',
    ...overrides,
  };
}

describe('assessAnnonce', () => {
  it('signale prix, DPE et mandat comme bloquants quand ils manquent', () => {
    const { blockers } = assessAnnonce(
      annonce({ prix: null, dpeLettre: null, dpeVierge: false, mandatStatut: 'estimation' }),
    );
    assert.deepEqual(
      blockers.map((b) => b.field).sort(),
      ['dpe', 'mandat', 'prix'],
    );
    assert.ok(blockers.every((b) => b.blocking));
  });

  it('accepte un DPE vierge à la place de l’étiquette', () => {
    const { blockers } = assessAnnonce(annonce({ dpeLettre: null, dpeVierge: true }));
    assert.equal(
      blockers.find((b) => b.field === 'dpe'),
      undefined,
    );
  });

  it('n’accepte pas l’estimation comme mandat de diffusion', () => {
    const { blockers } = assessAnnonce(annonce({ mandatStatut: 'estimation' }));
    assert.ok(blockers.some((b) => b.field === 'mandat'));
  });
});

describe('ExportDiffusionProvider', () => {
  it('produit un XML sans aucun appel réseau', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('aucun fetch ne doit partir');
    }) as typeof fetch;

    try {
      const provider = new ExportDiffusionProvider('xml');
      const result = await provider.diffuser(annonce());
      assert.equal(result.kind, 'file');
      if (result.kind !== 'file') return;
      assert.match(result.filename, /\.xml$/);
      assert.match(result.content, /<prix_euros>250000<\/prix_euros>/);
      assert.match(result.content, /<lettre_energie>D<\/lettre_energie>/);
      assert.match(result.content, /photo rang="1"/);
      assert.match(result.content, /Honoraires d&apos;agence/);
      assert.doesNotMatch(result.content, /https?:\/\/(api|seloger|leboncoin|adictiz)/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('produit un CSV avec les colonnes du flux', async () => {
    const provider = new ExportDiffusionProvider('csv');
    const result = await provider.diffuser(annonce());
    assert.equal(result.kind, 'file');
    if (result.kind !== 'file') return;
    const [header, row] = result.content.trim().split('\n');
    assert.ok(header?.includes('prix_euros'));
    assert.ok(header?.includes('dpe_lettre'));
    assert.ok(row?.includes('250000'));
  });

  it('retirer n’appelle aucun service et le dit', async () => {
    const provider = new ExportDiffusionProvider();
    const result = await provider.retirer(annonce());
    assert.equal(result.kind, 'ack');
    if (result.kind !== 'ack') return;
    assert.match(result.message, /aucun portail/i);
  });
});

describe('mentionsLegales', () => {
  it('ajoute la mention F/G et les honoraires Hoguet', () => {
    const lines = mentionsLegales(annonce({ dpeLettre: 'G' }));
    assert.ok(lines.some((l) => /consommation énergétique excessive/.test(l)));
    assert.ok(lines.some((l) => /Honoraires d'agence/.test(l)));
    assert.ok(lines.some((l) => /Mandat exclusif/.test(l)));
  });
});
