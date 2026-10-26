import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CarteImport } from '@/lib/annonces/import/carte';
import {
  FORMULAIRE_VIDE,
  decouperAdresse,
  demandeDepuisFormulaire,
  prixAffiche,
  remplirDepuisAnnonce,
} from './nouveau-bien.js';

function carte(partiel: Partial<CarteImport> = {}): CarteImport {
  return {
    importId: 'i1',
    annonceId: null,
    suivie: false,
    portail: 'SeLoger',
    portailCle: 'seloger',
    url: 'https://www.seloger.com/annonces/1.htm',
    particulier: true,
    agence: null,
    prix: 450000,
    typeBien: 'appartement',
    surface: 62.4,
    pieces: 3,
    etage: '2',
    dpe: 'D',
    confiance: 'certaine',
    adresse: '10 Rue des Maraîchers 75020 Paris',
    latitude: 48.85,
    longitude: 2.4,
    approximative: false,
    rayonM: null,
    adressesPossibles: [],
    parcelleId: null,
    photo: 'https://img.seloger.com/1.jpg',
    ...partiel,
  };
}

describe('nouveau bien', () => {
  it('découpe la rue, le code postal et la ville', () => {
    assert.deepEqual(decouperAdresse('10 Rue des Maraîchers 75020 Paris', { latitude: 1, longitude: 2 }), {
      rue: '10 Rue des Maraîchers',
      postalCode: '75020',
      city: 'Paris',
      latitude: 1,
      longitude: 2,
      banId: null,
    });
    assert.equal(decouperAdresse('ab', { latitude: null, longitude: null }), null);
  });

  it('une annonce localisée remplit toute la fiche', () => {
    const f = remplirDepuisAnnonce(FORMULAIRE_VIDE, carte());
    assert.equal(f.adresse?.rue, '10 Rue des Maraîchers');
    assert.equal(f.type, 'appartement');
    assert.equal(f.surface, '62');
    assert.equal(f.pieces, '3');
    assert.equal(f.prix, '450000');
    assert.equal(f.annonce?.photo, 'https://img.seloger.com/1.jpg');
  });

  it('un simple repère ne devient jamais l’adresse du bien', () => {
    const possibles = [{ adresse: '12 Rue des Pyrénées 75020 Paris', latitude: 48.8, longitude: 2.4 }];
    const f = remplirDepuisAnnonce(
      FORMULAIRE_VIDE,
      carte({ approximative: true, confiance: 'incertaine', adresse: 'Rue des Pyrénées 75020 Paris', adressesPossibles: possibles }),
    );
    assert.equal(f.adresse, null);
    assert.equal(f.annonce?.adressesPossibles.length, 1);
  });

  it('l’adresse choisie parmi les possibles devient celle du bien', () => {
    const possibles = [{ adresse: '12 Rue des Pyrénées 75020 Paris', latitude: 48.8, longitude: 2.4 }];
    const f = remplirDepuisAnnonce(
      FORMULAIRE_VIDE,
      carte({ approximative: true, adressesPossibles: possibles, adresseChoisie: possibles[0]!.adresse }),
    );
    assert.equal(f.adresse?.rue, '12 Rue des Pyrénées');
  });

  it('ce que l’agent a saisi n’est pas écrasé par l’annonce', () => {
    const f = remplirDepuisAnnonce({ ...FORMULAIRE_VIDE, prix: '430000', type: 'maison' }, carte());
    assert.equal(f.prix, '430000');
    assert.equal(f.type, 'maison');
  });

  it('pas d’adresse, pas de demande ; sinon un bien complet', () => {
    assert.equal(demandeDepuisFormulaire(FORMULAIRE_VIDE), null);
    const d = demandeDepuisFormulaire(remplirDepuisAnnonce(FORMULAIRE_VIDE, carte()));
    assert.equal(d?.address, '10 Rue des Maraîchers');
    assert.equal(d?.price, 450000);
    assert.equal(d?.provenance, 'portail');
    assert.deepEqual(d?.photos, ['https://img.seloger.com/1.jpg']);
    // Le lien va sur la fiche bien ; la carte garde une note courte.
    assert.equal(d?.lien, 'https://www.seloger.com/annonces/1.htm');
    assert.doesNotMatch(d?.notes ?? '', /https?:/);
  });

  it('le prix s’affiche groupé, la saisie ne garde que les chiffres', () => {
    assert.equal(prixAffiche('450000').replace(/\s/g, ' '), '450 000');
    assert.equal(prixAffiche(''), '');
  });

  it('saisie à la main : prix avec espaces, provenance terrain', () => {
    const d = demandeDepuisFormulaire({
      ...FORMULAIRE_VIDE,
      adresse: { rue: '3 rue Oberkampf', city: 'Paris', postalCode: '75011', latitude: 48.86, longitude: 2.37, banId: 'b' },
      prix: '520 000',
      surface: '48,5',
    });
    assert.equal(d?.price, 520000);
    assert.equal(d?.surfaceM2, 48.5);
    assert.equal(d?.provenance, 'terrain');
    assert.equal(d?.notes, null);
  });
});
