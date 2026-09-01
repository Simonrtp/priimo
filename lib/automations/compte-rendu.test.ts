import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  arrondiCommercial,
  construireCompteRendu,
  proposerComptesRendus,
  recommandationPrix,
  type ActiviteBien,
  type BienSousMandat,
} from './compte-rendu';

const NOW = new Date('2026-08-31T09:00:00.000Z');

function bien(over: Partial<BienSousMandat> = {}): BienSousMandat {
  return {
    id: 'bien-1',
    address: '12 rue de la Paix',
    price: 300_000,
    mandatStatut: 'mandat_simple',
    mandatDate: '2026-05-01',
    proprietaireName: 'M. Durand',
    proprietaireEmail: 'durand@example.com',
    assignedTo: 'agent-1',
    createdBy: 'agent-2',
    ...over,
  };
}

function activite(over: Partial<ActiviteBien> = {}): ActiviteBien {
  return {
    diffusions: [{ portail: 'seloger', publieLe: '2026-05-05' }],
    visites: [],
    offres: [],
    ...over,
  };
}

describe('arrondiCommercial', () => {
  it('arrondit selon la tranche de prix', () => {
    assert.equal(arrondiCommercial(291_347), 290_000);
    assert.equal(arrondiCommercial(87_400), 87_000);
    assert.equal(arrondiCommercial(742_000), 740_000);
  });
});

describe('recommandationPrix', () => {
  it('tient le prix dès qu’une offre est arrivée', () => {
    const r = recommandationPrix({ prix: 300_000, joursEnLigne: 120, visites: 8, offres: 1 });
    assert.equal(r.sens, 'tenir');
    assert.equal(r.prixConseille, 300_000);
    assert.match(r.motif, /Une offre a été reçue/);
  });

  it('conseille une baisse franche quand personne ne visite', () => {
    const r = recommandationPrix({ prix: 300_000, joursEnLigne: 45, visites: 0, offres: 0 });
    assert.equal(r.sens, 'baisser');
    assert.equal(r.pourcentage, 0.05);
    assert.equal(r.prixConseille, 285_000);
    assert.match(r.motif, /Aucune visite en 45 jours/);
  });

  it('conseille une baisse mesurée quand on visite sans offrir', () => {
    const r = recommandationPrix({ prix: 300_000, joursEnLigne: 90, visites: 6, offres: 0 });
    assert.equal(r.sens, 'baisser');
    assert.equal(r.pourcentage, 0.03);
    assert.equal(r.prixConseille, 290_000);
    assert.match(r.motif, /6 visites en 90 jours/);
  });

  it('attend quand il est trop tôt pour conclure', () => {
    const r = recommandationPrix({ prix: 300_000, joursEnLigne: 12, visites: 2, offres: 0 });
    assert.equal(r.sens, 'attendre');
    assert.equal(r.pourcentage, 0);
  });

  it('ne conclut rien tant que le bien n’est pas diffusé', () => {
    const r = recommandationPrix({ prix: 300_000, joursEnLigne: null, visites: 0, offres: 0 });
    assert.equal(r.sens, 'attendre');
    assert.match(r.motif, /pas encore diffusé/);
  });

  it('reste utilisable sans prix connu', () => {
    const r = recommandationPrix({ prix: null, joursEnLigne: 45, visites: 0, offres: 0 });
    assert.equal(r.sens, 'baisser');
    assert.equal(r.prixConseille, null);
  });
});

describe('construireCompteRendu', () => {
  it('compte les jours depuis la première mise en ligne', () => {
    const cr = construireCompteRendu(
      bien(),
      activite({
        diffusions: [
          { portail: 'bienici', publieLe: '2026-06-01' },
          { portail: 'seloger', publieLe: '2026-05-05' },
        ],
      }),
      NOW,
    );
    assert.equal(cr.joursEnLigne, 118);
    assert.deepEqual(cr.portails, ['bienici', 'seloger']);
  });

  it('retient la meilleure offre', () => {
    const cr = construireCompteRendu(
      bien(),
      activite({
        offres: [
          { date: '2026-07-01', montant: 280_000 },
          { date: '2026-07-15', montant: 292_000 },
          { date: '2026-08-01', montant: null },
        ],
      }),
      NOW,
    );
    assert.equal(cr.offres, 3);
    assert.equal(cr.meilleureOffre, 292_000);
  });

  it('supporte un bien sans aucune activité', () => {
    const cr = construireCompteRendu(bien(), undefined, NOW);
    assert.equal(cr.joursEnLigne, null);
    assert.equal(cr.visites, 0);
    assert.equal(cr.meilleureOffre, null);
    assert.equal(cr.recommandation.sens, 'attendre');
  });
});

describe('proposerComptesRendus', () => {
  it('ne rend compte que sur un mandat de vente', () => {
    for (const statut of ['estimation', 'compromis', 'vendu', 'archive'] as const) {
      const actions = proposerComptesRendus({
        biens: [bien({ mandatStatut: statut })],
        activites: {},
        now: NOW,
      });
      assert.equal(actions.length, 0, `${statut} ne doit rien proposer`);
    }
  });

  it('laisse passer un mois avant le premier compte rendu', () => {
    const actions = proposerComptesRendus({
      biens: [bien({ mandatDate: '2026-08-20' })],
      activites: {},
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('propose un compte rendu mensuel dédupliqué', () => {
    const aout = proposerComptesRendus({ biens: [bien()], activites: {}, now: NOW });
    const memeMois = proposerComptesRendus({
      biens: [bien()],
      activites: {},
      now: new Date('2026-08-15T09:00:00.000Z'),
    });
    const septembre = proposerComptesRendus({
      biens: [bien()],
      activites: {},
      now: new Date('2026-09-10T09:00:00.000Z'),
    });

    assert.equal(aout[0]?.dedupKey, memeMois[0]?.dedupKey);
    assert.notEqual(aout[0]?.dedupKey, septembre[0]?.dedupKey);
  });

  it('fait passer devant l’exclusif et la baisse à annoncer', () => {
    const [simpleAttente] = proposerComptesRendus({
      biens: [bien()],
      activites: { 'bien-1': activite({ visites: [{ date: '2026-08-01' }] }) },
      now: NOW,
    });
    const [exclusifBaisse] = proposerComptesRendus({
      biens: [bien({ mandatStatut: 'mandat_exclusif' })],
      activites: { 'bien-1': activite() },
      now: NOW,
    });

    assert.ok((exclusifBaisse?.score ?? 0) > (simpleAttente?.score ?? 0));
    assert.match(String(exclusifBaisse?.detail), /baisse conseillée de 5 %/);
  });

  it('transporte le compte rendu complet dans la charge utile', () => {
    const [action] = proposerComptesRendus({
      biens: [bien()],
      activites: { 'bien-1': activite({ visites: [{ date: '2026-08-01' }] }) },
      now: NOW,
    });
    const cr = action?.payload.compteRendu as Record<string, unknown>;
    assert.equal(cr.adresse, '12 rue de la Paix');
    assert.equal(cr.proprietaireEmail, 'durand@example.com');
    assert.equal(cr.periode, '2026-08');
  });

  it('revient à l’auteur quand le bien n’est assigné à personne', () => {
    const [action] = proposerComptesRendus({
      biens: [bien({ assignedTo: null })],
      activites: {},
      now: NOW,
    });
    assert.equal(action?.assignedTo, 'agent-2');
  });
});
