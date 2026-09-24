import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adresseDejaAppliquee,
  adressesProposeesPourContact,
  extraireCodePostal,
  fusionnerAdressesProposees,
  biensCitesDansTexte,
  filtrerCatalogue,
  ligneRattachementContact,
  patchDepuisAdresseProposee,
} from './rattacher-catalogue';

describe('catalogue de rattachement', () => {
  const items = [
    { id: '1', kind: 'contact' as const, label: 'Marie Durand', subtitle: 'Nantes' },
    { id: '2', kind: 'contact' as const, label: 'Paul Martin', subtitle: '06 12 34 56 78' },
  ];

  it('rend toute la liste sans recherche', () => {
    assert.equal(filtrerCatalogue(items, '').length, 2);
  });

  it('filtre sans tenir compte des accents', () => {
    const hits = filtrerCatalogue(items, 'durànd');
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.id, '1');
  });
});

describe('biensCitesDansTexte', () => {
  it('retrouve un bien dont l’adresse est dite', () => {
    const hits = biensCitesDansTexte('passage au 12 rue de la paix ce matin', [
      { id: 'b1', address: '12 rue de la Paix, Nantes', city: 'Nantes' },
      { id: 'b2', address: '8 avenue Foch', city: 'Nantes' },
    ]);
    assert.deepEqual(
      hits.map((h) => h.id),
      ['b1'],
    );
  });
});

describe('ligneRattachementContact', () => {
  const philippe = {
    id: 'c1',
    fullName: 'Philippe Martin',
    phone: '06 12 34 56 78',
    address: '12 rue Orfila 75020 Paris',
    banId: '75120_orfila_12',
  };
  const marie = {
    id: 'c2',
    fullName: 'Marie Martin',
    phone: null,
    address: '12 rue Orfila 75020 Paris',
    banId: '75120_orfila_12',
  };
  const voisin = {
    id: 'c3',
    fullName: 'Paul Durand',
    phone: null,
    address: '14 rue Orfila 75020 Paris',
    banId: '75120_orfila_14',
  };

  it('pose le bien et les autres occupants sur la même ligne', () => {
    const ligne = ligneRattachementContact(
      philippe,
      [{ proprietaireContactId: 'c1', address: '12 rue Orfila', banId: '75120_orfila_12' }],
      [philippe, marie, voisin],
    );
    assert.equal(ligne, '12 rue Orfila · Marie Martin');
  });

  it('rattache aussi un bien au même BAN même sans être propriétaire', () => {
    const ligne = ligneRattachementContact(
      marie,
      [{ proprietaireContactId: 'c1', address: '12 rue Orfila', banId: '75120_orfila_12' }],
      [philippe, marie],
    );
    assert.equal(ligne, '12 rue Orfila · Philippe Martin');
  });

  it('revient au téléphone et à l’adresse s’il n’y a pas de rattachement', () => {
    const ligne = ligneRattachementContact(philippe, [], [philippe]);
    assert.equal(ligne, '06 12 34 56 78 · 12 rue Orfila 75020 Paris');
  });
});

describe('adressesProposeesPourContact', () => {
  const philippe = {
    id: 'c1',
    fullName: 'Philippe Martin',
    phone: '06 12 34 56 78',
    address: '12 rue Orfila 75020 Paris',
    banId: '75120_orfila_12',
    latitude: 48.86,
    longitude: 2.39,
  };

  it('lit le code postal dans l’adresse', () => {
    assert.equal(extraireCodePostal('12 rue Orfila 75020 Paris'), '75020');
  });

  it('propose l’appartement du client plutôt que de redoubler l’adresse', () => {
    const props = adressesProposeesPourContact(philippe, [
      {
        id: 'b1',
        proprietaireContactId: 'c1',
        address: '12 rue Orfila 75020 Paris',
        city: 'Paris',
        postalCode: '75020',
        banId: '75120_orfila_12',
        propertyType: 'Appartement',
        surfaceM2: 48,
        rooms: 2,
      },
    ]);
    assert.equal(props.length, 1);
    assert.equal(props[0]?.source, 'bien');
    assert.equal(props[0]?.bienId, 'b1');
    assert.equal(props[0]?.propertyType, 'appartement');
    assert.equal(props[0]?.surfaceM2, 48);
  });

  it('propose l’adresse de la fiche s’il n’y a pas de bien', () => {
    const props = adressesProposeesPourContact(philippe, []);
    assert.equal(props.length, 1);
    assert.equal(props[0]?.source, 'contact');
    assert.equal(props[0]?.postalCode, '75020');
    assert.equal(props[0]?.city, 'Paris');
  });

  it('remplit l’adresse et les champs vides, sans écraser une surface déjà saisie', () => {
    const [p] = adressesProposeesPourContact(philippe, [
      {
        id: 'b1',
        proprietaireContactId: 'c1',
        address: '12 rue Orfila 75020 Paris',
        city: 'Paris',
        postalCode: '75020',
        propertyType: 'Appartement',
        surfaceM2: 48,
        rooms: 2,
      },
    ]);
    assert.ok(p);
    const patch = patchDepuisAdresseProposee(p, { surfaceM2: 52, rooms: null });
    assert.equal(patch.address, '12 rue Orfila 75020 Paris');
    assert.equal(patch.bienId, 'b1');
    assert.equal(patch.surfaceM2, undefined);
    assert.equal(patch.rooms, 2);
    assert.equal(adresseDejaAppliquee({ address: '12 rue Orfila 75020 Paris', bienId: 'b1' }, p), true);
  });

  it('ne dédouble pas la fiche client et l’appartement au même lieu', () => {
    const remote = adressesProposeesPourContact(philippe, [
      {
        id: 'b1',
        proprietaireContactId: 'c1',
        address: '12 rue Orfila',
        banId: '75120_orfila_12',
      },
    ]);
    const fusion = fusionnerAdressesProposees(
      {
        key: 'contact:c1',
        source: 'contact',
        bienId: null,
        label: '12 rue Orfila 75020 Paris',
        city: 'Paris',
        postalCode: '75020',
        banId: '75120_orfila_12',
        latitude: null,
        longitude: null,
        propertyType: null,
        surfaceM2: null,
        rooms: null,
      },
      remote,
    );
    assert.equal(fusion.length, 1);
    assert.equal(fusion[0]?.source, 'bien');
  });
});
