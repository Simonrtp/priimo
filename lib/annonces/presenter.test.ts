import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adresseVisible,
  badgeAnnonce,
  baisseCumulee,
  bandeauMiseAJour,
  ligneHistorique,
  regrouperAnnonces,
} from './presenter';
import type { Annonce, EvenementAnnonce } from './types';

function annonce(over: Partial<Annonce> = {}): Annonce {
  return {
    id: 'a1',
    idPortail: 'demo-1',
    portail: 'pap',
    url: 'https://example.test/a',
    typeVendeur: 'particulier',
    agenceNom: null,
    refusDemarchage: true,
    statut: 'active',
    publieeLe: '2026-10-01T06:00:00.000Z',
    premiereVueLe: null,
    derniereVueLe: null,
    retireeLe: null,
    typeBien: 'appartement',
    titre: null,
    prixInitial: 850000,
    prix: 820000,
    surface: 40,
    pieces: 2,
    etage: '2',
    dpe: 'D',
    codePostal: '75020',
    ville: 'Paris',
    quartier: 'Père-Lachaise',
    confiance: 'probable',
    localisationPrecision: 'immeuble',
    adresse: '12 rue Orfila',
    adresseNumero: '12',
    adresseVoie: 'rue Orfila',
    parcelleIds: [],
    numeroDpe: null,
    complementDpe: null,
    latitude: 48.86,
    longitude: 2.39,
    logementCle: null,
    scoreLocalisation: null,
    raisonsLocalisation: [],
    ...over,
  };
}

describe('annonces', () => {
  it('cache l’adresse incertaine', () => {
    assert.equal(adresseVisible('incertaine'), false);
    assert.equal(adresseVisible('probable'), true);
    assert.equal(adresseVisible('adresse_publiee'), true);
  });

  it('calcule la baisse cumulée et ne parle jamais de vente', () => {
    assert.equal(baisseCumulee(annonce()), 3.5);
    const badge = badgeAnnonce(annonce({ statut: 'retiree', retireeLe: '2026-11-02' }));
    assert.equal(badge?.kind, 'retiree');
  });

  it('écrit l’historique sans dire vendue', () => {
    const evt: EvenementAnnonce = {
      id: 'e1',
      annonceId: 'a1',
      type: 'baisse_prix',
      survenuLe: '2026-10-21T08:00:00.000Z',
      avant: { prix: 850000 },
      apres: { prix: 820000 },
      createdAt: '2026-10-21T08:00:00.000Z',
    };
    const ligne = ligneHistorique(evt);
    assert.match(ligne, /baisse à/);
    assert.match(ligne, /3,5 %/);
    assert.doesNotMatch(ligne, /vendu/i);
    const ancien = ligneHistorique(
      { ...evt, survenuLe: '2026-09-01T08:00:00.000Z' },
      '2026-10-01T06:00:00.000Z',
    );
    assert.match(ancien, /ancien prix/);
    assert.doesNotMatch(ancien, /baisse/);
    const retrait = ligneHistorique({ ...evt, type: 'retiree', avant: null, apres: null });
    assert.match(retrait, /retirée/);
    assert.doesNotMatch(retrait, /vendu/i);
  });

  it('regroupe deux portails du même logement', () => {
    const groupes = regrouperAnnonces([
      annonce({ id: '1', portail: 'pap', logementCle: 'cle' }),
      annonce({ id: '2', portail: 'leboncoin', logementCle: 'cle' }),
      annonce({ id: '3', logementCle: null }),
    ]);
    assert.equal(groupes.length, 2);
    assert.equal(groupes.find((g) => g.cle === 'cle')?.annonces.length, 2);
  });

  it('ignore un passage interrompu et dit hier ou ce soir', () => {
    const maintenant = new Date('2026-10-16T20:00:00.000Z');
    const hier = bandeauMiseAJour(
      [
        { portail: 'pap', status: 'running', startedAt: '2026-10-16T18:00:00.000Z', finishedAt: null },
        { portail: 'pap', status: 'success', startedAt: '2026-10-15T18:00:00.000Z', finishedAt: '2026-10-15T20:14:00.000Z' },
      ],
      maintenant,
    );
    assert.match(hier.texte, /hier à/);
    const soir = bandeauMiseAJour(
      [{ portail: 'seloger', status: 'success', startedAt: '2026-10-16T18:00:00.000Z', finishedAt: '2026-10-16T20:14:00.000Z' }],
      maintenant,
    );
    assert.match(soir.texte, /ce soir à/);
  });
});
