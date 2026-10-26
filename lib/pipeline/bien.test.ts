import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { biensParLead, prixBien, resumeBien, typeBienFiche } from './bien.js';

describe('bien du pipeline', () => {
  it('traduit le type du lead dans le libellé de la fiche bien', () => {
    assert.equal(typeBienFiche('appartement'), 'Appartement');
    assert.equal(typeBienFiche('maison'), 'Maison');
    assert.equal(typeBienFiche('autre'), null);
    assert.equal(typeBienFiche(null), null);
  });

  it('résume la fiche bien, le lead à défaut', () => {
    const lead = { propertyType: 'appartement', surfaceM2: 40, rooms: 2 };
    assert.equal(resumeBien({ ...lead, bien: null }), 'Appartement · 40 m² · 2 p.');
    assert.equal(
      resumeBien({
        ...lead,
        bien: { id: 'b', propertyType: 'Maison', surfaceM2: 120, rooms: null, price: null, photo: null },
      }),
      'Maison · 120 m² · 2 p.',
    );
    assert.equal(resumeBien({ propertyType: null, surfaceM2: null, rooms: null }), null);
  });

  it('un bien par lead, la première ligne gagne, les biens sans lead sont ignorés', () => {
    const map = biensParLead([
      { id: 'b1', lead_id: 'l1', property_type: null, surface_m2: null, rooms: null, price: 1, photos: ['p.jpg'] },
      { id: 'b2', lead_id: 'l1', property_type: null, surface_m2: null, rooms: null, price: 2, photos: null },
      { id: 'b3', lead_id: null, property_type: null, surface_m2: null, rooms: null, price: 3, photos: null },
    ]);
    assert.equal(map.size, 1);
    assert.equal(map.get('l1')?.id, 'b1');
    assert.equal(map.get('l1')?.photo, 'p.jpg');
  });

  it('pas de prix nul ou négatif', () => {
    assert.equal(prixBien(0), null);
    assert.equal(prixBien(null), null);
    assert.equal(prixBien(450000)?.replace(/\s/g, ' '), '450 000 €');
  });
});
