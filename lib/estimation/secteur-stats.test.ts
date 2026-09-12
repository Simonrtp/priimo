import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { baselineRadarSecteur, lignesStatsSecteur } from './secteur-stats';

const BASE = {
  immeubles: 12,
  dpeRepartition: [{ letter: 'D', count: 8 }],
  surfaces: { p25: 40, mediane: 55, p75: 70 },
  epoqueConstruction: null as string | null,
  partAscenseur: null as number | null,
  logementsSociaux: null as number | null,
  partProprietaires: null as number | null,
  partLocataires: null as number | null,
  profilsBiens: [] as { type: string; count: number }[],
};

describe('baseline radar secteur', () => {
  it('ne invente pas de score sur une famille sans donnée', () => {
    const axes = baselineRadarSecteur(BASE);
    const cuisine = axes.find((a) => a.famille === 'cuisine');
    const energie = axes.find((a) => a.famille === 'energie');
    assert.equal(cuisine?.score, null);
    assert.ok(energie && energie.score != null);
  });
});

describe('lignes stats secteur', () => {
  it('n’affiche pas l’ascenseur quand IRIS le laisse vide', () => {
    const lignes = lignesStatsSecteur(BASE);
    assert.equal(
      lignes.some((l) => /ascenseur/i.test(l.libelle) || l.valeur === '—' || l.valeur === ''),
      false,
    );
  });

  it('affiche l’ascenseur seulement s’il est connu', () => {
    const lignes = lignesStatsSecteur({ ...BASE, partAscenseur: 0.4 });
    assert.ok(lignes.some((l) => l.libelle === 'Ascenseur' && l.valeur === '40 %'));
  });
});
