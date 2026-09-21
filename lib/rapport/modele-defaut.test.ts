import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lignesDepuisModele } from './composer';
import {
  EMAIL_MODELE_DEFAUT,
  nomSlotModele,
  parseSlotsModele,
  slotsDepuisLignes,
  texteEmailModele,
} from './modele-defaut';
import { manquesAvantEnvoi } from './avant-envoyer';
import type { AgencyRapportPageRow } from '@/types/database';

function pageBiblio(over: Partial<AgencyRapportPageRow> & Pick<AgencyRapportPageRow, 'id' | 'nom'>): AgencyRapportPageRow {
  return {
    agency_id: 'ag',
    description: null,
    kind: 'image',
    storage_path: 'p.jpg',
    mime_type: 'image/jpeg',
    page_count: 1,
    position: 0,
    created_by: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...over,
  };
}

describe('modèle de rapport', () => {
  it('accepte bibliothèque et pages du dossier dans le même ordre', () => {
    const slots = parseSlotsModele([
      { source: 'bibliotheque', bibliothequeId: 'b1' },
      { source: 'generee', kindGeneree: 'prix' },
    ]);
    assert.deepEqual(slots, [
      { source: 'bibliotheque', bibliothequeId: 'b1' },
      { source: 'generee', kindGeneree: 'prix' },
    ]);
    assert.equal(parseSlotsModele([{ source: 'generee', kindGeneree: 'inconnu' }]), null);
  });

  it('relit les lignes SQL sans casser l’ordre', () => {
    const slots = slotsDepuisLignes([
      { source: 'bibliotheque', bibliotheque_id: 'b1', kind_generee: null },
      { source: 'generee', bibliotheque_id: null, kind_generee: 'couverture' },
      { source: 'bibliotheque', bibliotheque_id: null, kind_generee: null },
    ]);
    assert.deepEqual(slots, [
      { source: 'bibliotheque', bibliothequeId: 'b1' },
      { source: 'generee', kindGeneree: 'couverture' },
    ]);
  });

  it('compose le rapport sans toucher au modèle', () => {
    const biblio = [
      pageBiblio({ id: 'b1', nom: 'Présentation', page_count: 2 }),
      pageBiblio({
        id: 'b2',
        nom: 'Mentions',
        kind: 'modele',
        storage_path: null,
        mime_type: null,
        disposition: 'texte',
        contenu: { titre: 'Mentions' },
      }),
    ];
    const lignes = lignesDepuisModele({
      slots: [
        { source: 'bibliotheque', bibliothequeId: 'b1' },
        { source: 'generee', kindGeneree: 'comparables' },
        { source: 'bibliotheque', bibliothequeId: 'absente' },
        { source: 'bibliotheque', bibliothequeId: 'b2' },
      ],
      biblio,
      estimationId: 'e1',
      agencyId: 'ag',
    });
    assert.equal(lignes.length, 4);
    assert.equal(lignes[0]?.nom, 'Présentation (1)');
    assert.equal(lignes[1]?.nom, 'Présentation (2)');
    assert.equal(lignes[1]?.page_index, 1);
    assert.equal(lignes[2]?.source, 'generee');
    assert.equal(lignes[2]?.nom, 'Comparables');
    assert.deepEqual(lignes[2]?.contenu, { kind: 'comparables' });
    assert.equal(lignes[3]?.nom, 'Mentions');
    assert.equal(lignes[3]?.disposition, 'texte');
  });

  it('nomme une page retirée de la bibliothèque', () => {
    assert.equal(
      nomSlotModele({ source: 'bibliotheque', bibliothequeId: 'x' }, new Map()),
      'Page retirée',
    );
    assert.equal(nomSlotModele({ source: 'generee', kindGeneree: 'prix' }, new Map()), 'Prix');
  });

  it('reprend le texte d’agence, sinon le texte Priimo', () => {
    assert.equal(texteEmailModele('  '), EMAIL_MODELE_DEFAUT);
    assert.equal(texteEmailModele('Bonjour, voici le lien.'), 'Bonjour, voici le lien.');
  });
});

describe('avant d’envoyer', () => {
  it('liste seulement ce qui manque, sans bloquer', () => {
    assert.deepEqual(
      manquesAvantEnvoi({
        priceValue: 250000,
        photos: 2,
        contactEmail: 'a@b.fr',
        pages: 3,
      }),
      [],
    );
    const manques = manquesAvantEnvoi({
      priceValue: null,
      photos: 0,
      contactEmail: '  ',
      pages: 0,
    });
    assert.deepEqual(
      manques.map((m) => m.id),
      ['prix', 'photos', 'email', 'pages'],
    );
    assert.equal(manques.find((m) => m.id === 'prix')?.etape, 'estimation');
    assert.equal(manques.find((m) => m.id === 'photos')?.etape, 'bien');
    assert.equal(manques.find((m) => m.id === 'email')?.etape, 'client');
    assert.equal(manques.find((m) => m.id === 'pages')?.etape, 'rapport');
  });
});
