import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  argumentaireRelance,
  ecartMarche,
  ESTIMATIONS_DORMANTES_CONFIG,
  proposerEstimationsDormantes,
  type EstimationDormante,
} from './estimations-dormantes';

const NOW = new Date('2026-08-31T09:00:00.000Z');

function estimation(over: Partial<EstimationDormante> = {}): EstimationDormante {
  return {
    id: 'est-1',
    bienId: 'bien-1',
    adresse: '12 rue de la Paix',
    codePostal: '44000',
    contactId: 'contact-1',
    proprietaireName: 'M. Durand',
    proprietairePhone: '0611223344',
    // 8 mois : dormante et dans la fenêtre de maturité.
    estimeeLe: '2026-01-05T00:00:00.000Z',
    valeurEstimee: 300_000,
    surfaceM2: 100,
    assignedTo: 'agent-1',
    createdBy: 'agent-2',
    rentree: false,
    ...over,
  };
}

// L'estimation vaut 3 000 €/m².
const MARCHE_STABLE = { '44000': 3_050 };
const MARCHE_HAUSSE = { '44000': 3_300 };

describe('ecartMarche', () => {
  it('compare le prix au m² de l’estimation au marché du jour', () => {
    assert.equal(ecartMarche(estimation(), { '44000': 3_300 }), 0.1);
    assert.equal(ecartMarche(estimation(), { '44000': 2_700 }), -0.1);
  });

  it('ne compare rien sans surface, sans valeur ou sans secteur', () => {
    assert.equal(ecartMarche(estimation({ surfaceM2: null }), MARCHE_HAUSSE), null);
    assert.equal(ecartMarche(estimation({ valeurEstimee: null }), MARCHE_HAUSSE), null);
    assert.equal(ecartMarche(estimation({ codePostal: null }), MARCHE_HAUSSE), null);
    assert.equal(ecartMarche(estimation(), {}), null);
  });

  it('ignore une surface nulle plutôt que de diviser par zéro', () => {
    assert.equal(ecartMarche(estimation({ surfaceM2: 0 }), MARCHE_HAUSSE), null);
  });
});

describe('proposerEstimationsDormantes', () => {
  it('appelle quand le marché a rattrapé l’estimation', () => {
    const [action] = proposerEstimationsDormantes({
      estimations: [estimation()],
      prixM2Actuels: MARCHE_HAUSSE,
      now: NOW,
    });
    assert.equal(action?.titre, 'Le marché a rattrapé votre estimation — 12 rue de la Paix');
    assert.equal(action?.payload.motif, 'marche_rattrape');
    assert.equal(action?.payload.ecartMarchePourcent, 10);
  });

  it('relance sur la maturité quand le marché n’a rien à dire', () => {
    const [action] = proposerEstimationsDormantes({
      estimations: [estimation()],
      prixM2Actuels: MARCHE_STABLE,
      now: NOW,
    });
    assert.equal(action?.titre, 'Estimation à relancer — 12 rue de la Paix');
    assert.equal(action?.payload.motif, 'maturite');
    assert.match(String(action?.detail), /Estimée il y a 8 mois/);
  });

  it('se tait quand ni le marché ni le calendrier ne justifient l’appel', () => {
    const actions = proposerEstimationsDormantes({
      // 4 mois : dormante, mais pas encore mûre.
      estimations: [estimation({ estimeeLe: '2026-05-01T00:00:00.000Z' })],
      prixM2Actuels: MARCHE_STABLE,
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('laisse tranquille une estimation encore chaude', () => {
    const actions = proposerEstimationsDormantes({
      estimations: [estimation({ estimeeLe: '2026-08-01T00:00:00.000Z' })],
      prixM2Actuels: MARCHE_HAUSSE,
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('abandonne une estimation trop vieille', () => {
    const actions = proposerEstimationsDormantes({
      estimations: [estimation({ estimeeLe: '2022-01-01T00:00:00.000Z' })],
      prixM2Actuels: MARCHE_HAUSSE,
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('ignore une estimation finalement rentrée au mandat', () => {
    const actions = proposerEstimationsDormantes({
      estimations: [estimation({ rentree: true })],
      prixM2Actuels: MARCHE_HAUSSE,
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('note mieux le marché rattrapé que la simple maturité', () => {
    const [hausse] = proposerEstimationsDormantes({
      estimations: [estimation()],
      prixM2Actuels: MARCHE_HAUSSE,
      now: NOW,
    });
    const [mur] = proposerEstimationsDormantes({
      estimations: [estimation()],
      prixM2Actuels: MARCHE_STABLE,
      now: NOW,
    });
    assert.ok((hausse?.score ?? 0) > (mur?.score ?? 0));
  });

  it('ne relance qu’une fois par trimestre', () => {
    const juillet = proposerEstimationsDormantes({
      estimations: [estimation()],
      prixM2Actuels: MARCHE_HAUSSE,
      now: new Date('2026-07-15T09:00:00.000Z'),
    });
    const aout = proposerEstimationsDormantes({
      estimations: [estimation()],
      prixM2Actuels: MARCHE_HAUSSE,
      now: NOW,
    });
    const octobre = proposerEstimationsDormantes({
      estimations: [estimation()],
      prixM2Actuels: MARCHE_HAUSSE,
      now: new Date('2026-10-15T09:00:00.000Z'),
    });

    assert.equal(juillet[0]?.dedupKey, aout[0]?.dedupKey, 'même trimestre, une seule relance');
    assert.notEqual(aout[0]?.dedupKey, octobre[0]?.dedupKey);
  });

  it('plafonne le volume', () => {
    const estimations = Array.from({ length: 20 }, (_, i) => estimation({ id: `est-${i}` }));
    const actions = proposerEstimationsDormantes({
      estimations,
      prixM2Actuels: MARCHE_HAUSSE,
      now: NOW,
    });
    assert.equal(actions.length, ESTIMATIONS_DORMANTES_CONFIG.maxPropositions);
  });
});

describe('argumentaireRelance', () => {
  it('chiffre la hausse quand c’est le motif', () => {
    const phrase = argumentaireRelance(estimation(), 'marche_rattrape', 0.1);
    assert.match(phrase, /^Bonjour M\. Durand, /);
    assert.match(phrase, /progressé d'environ 10 %/);
  });

  it('reste neutre sur une relance de maturité', () => {
    const phrase = argumentaireRelance(estimation({ proprietaireName: null }), 'maturite', null);
    assert.match(phrase, /^Bonjour, /);
    assert.match(phrase, /Où en êtes-vous de votre projet/);
    assert.doesNotMatch(phrase, /%/);
  });
});
