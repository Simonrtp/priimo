import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  memeAdresse,
  numeroDeVoie,
  proposerVeilleDpe,
  VEILLE_DPE_CONFIG,
  type AdresseSuivie,
  type DpeRecent,
} from './veille-dpe';

const NOW = new Date('2026-08-31T09:00:00.000Z');
const SECTEUR = ['44000', '44100'];

function dpe(over: Partial<DpeRecent> = {}): DpeRecent {
  return {
    numeroDpe: '2287E0123456X',
    adresse: '12 rue de la Paix',
    codePostal: '44000',
    commune: 'Nantes',
    dateEtablissement: '2026-08-25',
    lettre: 'D',
    surfaceM2: 82,
    typeBatiment: 'Appartement',
    latitude: 47.21,
    longitude: -1.55,
    ...over,
  };
}

function suivi(over: Partial<AdresseSuivie> = {}): AdresseSuivie {
  return {
    entite: 'bien',
    id: 'bien-1',
    adresse: '12 rue de la Paix',
    codePostal: '44000',
    label: 'M. Durand',
    assignedTo: 'agent-1',
    ...over,
  };
}

describe('numeroDeVoie', () => {
  it('lit le numéro en tête', () => {
    assert.equal(numeroDeVoie('12 rue de la Paix'), '12');
    assert.equal(numeroDeVoie('12 bis rue de la Paix'), '12');
    assert.equal(numeroDeVoie('Rue de la Paix'), null);
  });
});

describe('memeAdresse', () => {
  const ref = { adresse: '12 rue de la Paix', codePostal: '44000' };

  it('reconnaît la même adresse écrite autrement', () => {
    assert.ok(memeAdresse(ref, { adresse: '12 Rue de la paix', codePostal: '44000' }));
  });

  it('refuse le voisin — c’est tout l’enjeu', () => {
    assert.equal(memeAdresse(ref, { adresse: '14 rue de la Paix', codePostal: '44000' }), false);
  });

  it('refuse une autre rue au même numéro', () => {
    assert.equal(memeAdresse(ref, { adresse: '12 rue Victor Hugo', codePostal: '44000' }), false);
  });

  it('refuse un autre code postal', () => {
    assert.equal(memeAdresse(ref, { adresse: '12 rue de la Paix', codePostal: '75001' }), false);
  });

  it('refuse quand un numéro manque, plutôt que de deviner', () => {
    assert.equal(memeAdresse(ref, { adresse: 'rue de la Paix', codePostal: '44000' }), false);
  });
});

describe('proposerVeilleDpe', () => {
  it('propose un DPE frais dans le secteur', () => {
    const [action] = proposerVeilleDpe({
      dpes: [dpe()],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(action?.kind, 'veille_dpe');
    assert.equal(action?.titre, 'Nouveau DPE au 12 rue de la Paix');
    assert.equal(action?.assignedTo, null);
  });

  it('ignore un DPE hors secteur', () => {
    const actions = proposerVeilleDpe({
      dpes: [dpe({ codePostal: '75001' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('ignore un DPE trop ancien pour être un signal', () => {
    const actions = proposerVeilleDpe({
      dpes: [dpe({ dateEtablissement: '2026-01-10' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('ne propose rien quand l’agence n’a pas de secteur', () => {
    const actions = proposerVeilleDpe({
      dpes: [dpe()],
      secteur: [],
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('hausse le ton quand l’adresse est déjà suivie', () => {
    const [avec] = proposerVeilleDpe({
      dpes: [dpe()],
      secteur: SECTEUR,
      adressesSuivies: [suivi()],
      now: NOW,
    });
    const [sans] = proposerVeilleDpe({
      dpes: [dpe()],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });

    assert.ok((avec?.score ?? 0) > (sans?.score ?? 0));
    assert.match(String(avec?.titre), /^M\. Durand prépare la vente/);
    assert.equal(avec?.assignedTo, 'agent-1');
  });

  it('n’attribue pas le DPE du voisin à un suivi', () => {
    const [action] = proposerVeilleDpe({
      dpes: [dpe({ adresse: '14 rue de la Paix' })],
      secteur: SECTEUR,
      adressesSuivies: [suivi()],
      now: NOW,
    });
    assert.equal(action?.assignedTo, null);
    assert.equal(action?.payload.suivi, null);
  });

  it('se tait sur un bien déjà au mandat — c’est nous qui avons demandé le DPE', () => {
    const actions = proposerVeilleDpe({
      dpes: [dpe()],
      secteur: SECTEUR,
      adressesSuivies: [suivi({ dejaAuMandat: true })],
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('remonte les passoires énergétiques', () => {
    const [passoire] = proposerVeilleDpe({
      dpes: [dpe({ lettre: 'G' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    const [normal] = proposerVeilleDpe({
      dpes: [dpe({ lettre: 'C' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.ok((passoire?.score ?? 0) > (normal?.score ?? 0));
    assert.equal(passoire?.payload.passoire, true);
    assert.match(String(passoire?.detail), /passoire énergétique/);
  });

  it('privilégie le tout frais', () => {
    const [frais] = proposerVeilleDpe({
      dpes: [dpe({ dateEtablissement: '2026-08-30' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    const [tiede] = proposerVeilleDpe({
      dpes: [dpe({ dateEtablissement: '2026-07-20' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.ok((frais?.score ?? 0) > (tiede?.score ?? 0));
    assert.match(String(frais?.detail), /hier/);
  });

  it('ignore un DPE daté dans le futur', () => {
    const actions = proposerVeilleDpe({
      dpes: [dpe({ dateEtablissement: '2026-12-01' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('déduplique sur le numéro de DPE', () => {
    const [a] = proposerVeilleDpe({
      dpes: [dpe()],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    const [b] = proposerVeilleDpe({
      dpes: [dpe({ dateEtablissement: '2026-08-26' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(a?.dedupKey, b?.dedupKey);
  });

  it('plafonne le volume et sort les meilleurs d’abord', () => {
    const dpes = Array.from({ length: 30 }, (_, i) =>
      dpe({ numeroDpe: `DPE-${i}`, adresse: `${i + 1} rue de la Paix`, lettre: i === 29 ? 'G' : 'C' }),
    );
    const actions = proposerVeilleDpe({
      dpes,
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(actions.length, VEILLE_DPE_CONFIG.maxPropositions);
    assert.equal(actions[0]?.payload.passoire, true);
  });
});
