import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bilanSemaine } from './bilan';
import { journalVide, type JournalActivite } from './derive';
import { OBJECTIFS_HEBDO_PAR_DEFAUT, REFERENCE_METIER_PROVISOIRE } from './objectifs';
import { semaineDe } from './semaines';
import { ACTIVITES, FAMILLES_ACTIVITE } from './types';

const MOI = 'profil-moi';
const SEMAINE = semaineDe(new Date('2026-09-02T10:00:00Z')); // 31 août → 6 sept.

function journal(partiel: Partial<JournalActivite>): JournalActivite {
  return { ...journalVide(), ...partiel };
}

function bilan(partiel: Partial<JournalActivite>, objectifs: Parameters<typeof bilanSemaine>[0]['objectifs'] = []) {
  return bilanSemaine({
    journal: journal(partiel),
    profileId: MOI,
    profileIdsAgence: [MOI],
    semaine: SEMAINE,
    objectifs,
    reference: REFERENCE_METIER_PROVISOIRE,
    referenceFournie: false,
  });
}

describe('bilanSemaine — forme du retour', () => {
  it('retourne les six compteurs, leur objectif et leur source', () => {
    const b = bilan({});

    assert.equal(b.compteurs.length, ACTIVITES.length);
    for (const c of b.compteurs) {
      assert.equal(c.objectif, OBJECTIFS_HEBDO_PAR_DEFAUT[c.activite]);
      assert.ok(c.provenance.length > 0, `provenance manquante pour ${c.activite}`);
    }

    const declares = b.compteurs.filter((c) => c.source === 'declare');
    assert.deepEqual(
      declares.map((c) => c.activite),
      ['contacts_physiques'],
      'un seul compteur doit demander un geste à l’agent',
    );
  });

  it('n’affiche en cartes que les cinq familles, mandats exclus', () => {
    const b = bilan({});
    assert.equal(b.familles.length, FAMILLES_ACTIVITE.length);
    assert.ok(!b.familles.some((c) => c.activite === 'mandats'));
  });
});

describe('bilanSemaine — état semaine 1', () => {
  it('est vrai sans aucun historique, et masque alors les écarts', () => {
    const b = bilan({
      contactsPhysiques: [{ profileId: MOI, jour: '2026-09-02', banId: 'imm-1' }],
    });

    assert.equal(b.semaine1, true);
    assert.equal(b.objectifsParDefaut, true);
    for (const c of b.compteurs) assert.equal(c.ecartSemainePrecedente, null);
    // Sans repères personnels ni agence, on annonce la référence comme provisoire.
    assert.equal(b.ratios.niveau, 'reference');
    assert.equal(b.ratios.provisoire, true);
  });

  it('devient faux dès qu’une semaine antérieure porte de l’activité', () => {
    const b = bilan({
      transitions: [
        { leadId: 'lead-a', profileId: MOI, depuisCle: null, versCle: 'contacte', createdAt: '2026-08-26T09:00:00Z', banId: 'a' },
        { leadId: 'lead-b', profileId: MOI, depuisCle: null, versCle: 'contacte', createdAt: '2026-09-02T09:00:00Z', banId: 'b' },
        { leadId: 'lead-c', profileId: MOI, depuisCle: null, versCle: 'contacte', createdAt: '2026-09-03T09:00:00Z', banId: 'c' },
      ],
    });

    assert.equal(b.semaine1, false);
    const qualifies = b.compteurs.find((c) => c.activite === 'contacts_qualifies');
    assert.equal(qualifies?.valeur, 2);
    assert.equal(qualifies?.ecartSemainePrecedente, 1); // 2 cette semaine, 1 la précédente
  });
});

describe('bilanSemaine — progression et objectif mensuel', () => {
  it('plafonne chaque famille à 100 % avant la moyenne', () => {
    // 500 contacts physiques pour un objectif de 50 ne doit pas compenser
    // quatre familles à zéro : 100 % sur une famille sur cinq = 20 %.
    const contactsPhysiques = Array.from({ length: 500 }, (_, i) => ({
      profileId: MOI,
      jour: '2026-09-02',
      banId: `imm-${i}`,
    }));
    const b = bilan({ contactsPhysiques });

    // Les immeubles montent aussi puisque chaque rencontre porte un ban_id.
    const familles = Object.fromEntries(b.familles.map((c) => [c.activite, c.valeur]));
    assert.equal(familles.contacts_physiques, 500);
    assert.equal(familles.immeubles_prospectes, 500);
    assert.equal(b.progressionHebdo, 40); // deux familles pleines sur cinq
  });

  it('compte les mandats sur le mois civil du lundi de la semaine', () => {
    const b = bilan({
      transitions: [
        { leadId: 'lead-a', profileId: MOI, depuisCle: null, versCle: 'mandat', createdAt: '2026-09-01T09:00:00Z', banId: 'a' },
        { leadId: 'lead-b', profileId: MOI, depuisCle: null, versCle: 'mandat', createdAt: '2026-09-20T09:00:00Z', banId: 'b' },
        // Août : hors du mois retenu.
        { leadId: 'lead-c', profileId: MOI, depuisCle: null, versCle: 'mandat', createdAt: '2026-08-31T09:00:00Z', banId: 'c' },
      ],
    });

    // La semaine commence le 31 août : c'est donc le mois d'août qui est retenu.
    assert.deepEqual(b.mandatsDuMois.mois, { debut: '2026-08-01', fin: '2026-08-31' });
    assert.equal(b.mandatsDuMois.valeur, 1);
  });

  it('reflète les objectifs posés par le directeur', () => {
    const b = bilan({ contactsPhysiques: [{ profileId: MOI, jour: '2026-09-02', banId: 'a' }] }, [
      { activite: 'contacts_physiques', periode: 'hebdo', cible: 2 },
      { activite: 'mandats', periode: 'mensuel', cible: 4 },
    ]);

    const physiques = b.compteurs.find((c) => c.activite === 'contacts_physiques');
    assert.equal(physiques?.objectif, 2);
    assert.equal(b.mandatsDuMois.objectif, 4);
    assert.equal(b.objectifsParDefaut, false);
  });
});

describe('bilanSemaine — un zéro et une source cassée ne se ressemblent pas', () => {
  it('déclare la source muette quand elle n’a jamais rien produit', () => {
    const b = bilan({});
    const physiques = b.compteurs.find((c) => c.activite === 'contacts_physiques');
    assert.equal(physiques?.valeur, 0);
    assert.equal(physiques?.etatSource, 'muette');
  });

  it('déclare la source indisponible quand la lecture a échoué', () => {
    const b = bilanSemaine({
      journal: {
        ...journal({}),
        lectures: { transitions: 'ok', notes: 'ok', contactsPhysiques: 'erreur' },
      },
      profileId: MOI,
      profileIdsAgence: [MOI],
      semaine: SEMAINE,
      objectifs: [],
      reference: REFERENCE_METIER_PROVISOIRE,
      referenceFournie: false,
    });

    const physiques = b.compteurs.find((c) => c.activite === 'contacts_physiques');
    assert.equal(physiques?.etatSource, 'indisponible');
    // Les compteurs servis par une autre source restent lisibles.
    assert.equal(
      b.compteurs.find((c) => c.activite === 'contacts_qualifies')?.etatSource,
      'muette',
    );
  });

  it('ne rend les immeubles indisponibles que si les trois sources sont tombées', () => {
    const avecUneSourceDebout = bilanSemaine({
      journal: {
        ...journal({}),
        lectures: { transitions: 'ok', notes: 'erreur', contactsPhysiques: 'erreur' },
      },
      profileId: MOI,
      profileIdsAgence: [MOI],
      semaine: SEMAINE,
      objectifs: [],
      reference: REFERENCE_METIER_PROVISOIRE,
      referenceFournie: false,
    });
    assert.equal(
      avecUneSourceDebout.compteurs.find((c) => c.activite === 'immeubles_prospectes')?.etatSource,
      'muette',
    );

    const toutTombe = bilanSemaine({
      journal: {
        ...journal({}),
        lectures: { transitions: 'erreur', notes: 'erreur', contactsPhysiques: 'erreur' },
      },
      profileId: MOI,
      profileIdsAgence: [MOI],
      semaine: SEMAINE,
      objectifs: [],
      reference: REFERENCE_METIER_PROVISOIRE,
      referenceFournie: false,
    });
    assert.equal(
      toutTombe.compteurs.find((c) => c.activite === 'immeubles_prospectes')?.etatSource,
      'indisponible',
    );
  });

  it('passe la source à « ok » dès qu’il y a de l’activité dans la fenêtre', () => {
    const b = bilan({
      transitions: [
        { leadId: 'lead-a', profileId: MOI, depuisCle: null, versCle: 'contacte', createdAt: '2026-07-15T09:00:00Z', banId: 'a' },
      ],
    });
    assert.equal(
      b.compteurs.find((c) => c.activite === 'contacts_qualifies')?.etatSource,
      'ok',
    );
  });
});

describe('bilanSemaine — entonnoir et jour par jour', () => {
  it('cale l’entonnoir sur la fenêtre des ratios, pas sur la semaine', () => {
    const b = bilan({
      transitions: [
        // Hors de la semaine courante, mais dans les 12 semaines.
        { leadId: 'lead-a', profileId: MOI, depuisCle: null, versCle: 'contacte', createdAt: '2026-07-15T09:00:00Z', banId: 'a' },
        { leadId: 'lead-a', profileId: MOI, depuisCle: null, versCle: 'mandat', createdAt: '2026-07-16T09:00:00Z', banId: 'a' },
      ],
    });

    const qualifies = b.entonnoir.find((e) => e.cle === 'contacts_qualifies');
    assert.equal(qualifies?.valeur, 1, 'l’entonnoir doit voir au-delà de la semaine');
    assert.equal(b.compteurs.find((c) => c.activite === 'contacts_qualifies')?.valeur, 0);
    assert.deepEqual(b.fenetrePersonnelle, {
      contacts_physiques: 0,
      contacts_qualifies: 1,
      estimations: 0,
      mandats: 1,
    });
  });

  it('donne sept jours, du lundi au dimanche', () => {
    const b = bilan({});
    assert.equal(b.jours.length, 7);
    assert.equal(b.jours[0]!.jour, SEMAINE.debut);
    assert.equal(b.jours[6]!.jour, SEMAINE.fin);
  });

  it('range chaque événement sur le bon jour', () => {
    const b = bilan({
      contactsPhysiques: [
        { profileId: MOI, jour: '2026-09-02', banId: 'a' },
        { profileId: MOI, jour: '2026-09-02', banId: 'b' },
        { profileId: MOI, jour: '2026-09-04', banId: 'c' },
      ],
    });

    const parJour = Object.fromEntries(
      b.jours.map((j) => [j.jour, j.compteurs.contacts_physiques]),
    );
    assert.equal(parJour['2026-09-02'], 2);
    assert.equal(parJour['2026-09-04'], 1);
    assert.equal(parJour['2026-09-03'], 0);
    // La somme des jours redonne le compteur de la semaine.
    const total = b.jours.reduce((s, j) => s + j.compteurs.contacts_physiques, 0);
    assert.equal(total, b.compteurs.find((c) => c.activite === 'contacts_physiques')?.valeur);
  });
});
