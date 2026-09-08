import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bilanPeriode } from '@/lib/activite/bilan';
import { valeursDe } from '@/lib/activite/bilan';
import { RANGS_CANONIQUES, journalVide, type JournalActivite } from '@/lib/activite/derive';
import { REFERENCE_METIER_PROVISOIRE } from '@/lib/activite/objectifs';
import { phrasePilotage } from '@/lib/activite/phrase';
import { MANDATS_MINIMUM } from '@/lib/activite/ratios';
import { intervalleDe, semaineDe } from '@/lib/activite/semaines';
import { dateKeyParis } from '@/lib/today/calendar';
import {
  CIBLES_SCENARIO,
  LEADS_REQUIS,
  SEMAINE_CREUSE,
  construireActiviteFictive,
} from './activite-scenario';

/**
 * Le scénario de démonstration passe dans la VRAIE chaîne de calcul.
 *
 * C'est le seul test qui vaille : vérifier que les tableaux du scénario
 * contiennent les bons nombres ne prouverait rien. Ce qu'on veut savoir, c'est
 * ce que l'écran raconte à quelqu'un qui le découvre.
 */

const CAMILLE = 'profil-camille';
// Un mercredi, pour que la semaine en cours soit à moitié écoulée.
const MAINTENANT = new Date('2026-09-02T10:00:00Z');

const LEADS = Array.from({ length: LEADS_REQUIS }, (_, i) => `lead-${i}`);
const IMMEUBLES = Array.from({ length: 30 }, (_, i) => `ban-${i}`);

function journalDeDemo(): JournalActivite {
  const a = construireActiviteFictive({
    maintenant: MAINTENANT,
    leadIds: LEADS,
    banIds: IMMEUBLES,
  });

  return {
    ...journalVide(),
    rangParCle: RANGS_CANONIQUES,
    transitions: a.transitions.map((t) => ({
      leadId: t.leadId,
      profileId: CAMILLE,
      depuisCle: t.depuisCle,
      versCle: t.versCle,
      createdAt: t.quand,
      // Le ban_id du lead : stable, comme en base.
      banId: `ban-lead-${t.leadId}`,
    })),
    notes: a.notes.map((n) => ({
      auteurId: CAMILLE,
      createdAt: n.quand,
      banId: n.banId,
      rattacheeTerrain: true,
    })),
    contactsPhysiques: a.sorties.map((s) => ({
      profileId: CAMILLE,
      jour: s.jour,
      banId: s.banId,
    })),
  };
}

function bilanDeDemo(periode: 'semaine' | 'mois' = 'semaine') {
  return bilanPeriode({
    journal: journalDeDemo(),
    profileId: CAMILLE,
    profileIdsAgence: [CAMILLE],
    periode,
    intervalle: intervalleDe(periode, MAINTENANT),
    objectifs: [],
    reference: REFERENCE_METIER_PROVISOIRE,
    referenceFournie: false,
  });
}

describe('scénario de démo — volumes produits', () => {
  it('produit les volumes annoncés', () => {
    const a = construireActiviteFictive({
      maintenant: MAINTENANT,
      leadIds: LEADS,
      banIds: IMMEUBLES,
    });

    assert.equal(a.leadsUtilises.length, LEADS_REQUIS);
    assert.equal(a.sorties.length, CIBLES_SCENARIO.contactsPhysiques);
    assert.equal(a.notes.length, CIBLES_SCENARIO.notes);
    assert.equal(
      a.transitions.filter((t) => t.versCle === 'mandat').length,
      CIBLES_SCENARIO.mandats,
    );
  });

  it('ne date jamais rien dans le futur', () => {
    const a = construireActiviteFictive({
      maintenant: MAINTENANT,
      leadIds: LEADS,
      banIds: IMMEUBLES,
    });
    const finSemaine = semaineDe(MAINTENANT).fin;

    for (const t of a.transitions) {
      assert.ok(t.quand.slice(0, 10) <= finSemaine, `transition future : ${t.quand}`);
    }
    for (const s of a.sorties) assert.ok(s.jour <= finSemaine, `sortie future : ${s.jour}`);
    for (const n of a.notes) assert.ok(n.quand.slice(0, 10) <= finSemaine);
  });

  it('enchaîne les étapes d’un lead dans l’ordre et sans trou', () => {
    const a = construireActiviteFictive({
      maintenant: MAINTENANT,
      leadIds: LEADS,
      banIds: IMMEUBLES,
    });
    const parLead = new Map<string, typeof a.transitions>();
    for (const t of a.transitions) {
      parLead.set(t.leadId, [...(parLead.get(t.leadId) ?? []), t]);
    }

    for (const [leadId, suite] of parLead) {
      assert.equal(suite[0]!.depuisCle, null, `${leadId} n’a pas d’entrée`);
      for (let i = 1; i < suite.length; i += 1) {
        assert.equal(suite[i]!.depuisCle, suite[i - 1]!.versCle, `${leadId} saute une étape`);
        assert.ok(suite[i]!.quand > suite[i - 1]!.quand, `${leadId} remonte le temps`);
      }
    }
  });

  it('creuse bien une semaine au milieu', () => {
    const a = construireActiviteFictive({
      maintenant: MAINTENANT,
      leadIds: LEADS,
      banIds: IMMEUBLES,
    });
    const parSemaine = new Map<string, number>();
    for (const s of a.sorties) {
      const lundi = semaineDe(new Date(`${s.jour}T12:00:00Z`)).debut;
      parSemaine.set(lundi, (parSemaine.get(lundi) ?? 0) + 1);
    }
    const volumes = [...parSemaine.entries()].sort().map(([, n]) => n);

    assert.equal(volumes.length, 12);
    const creux = volumes[SEMAINE_CREUSE]!;
    const voisins = [volumes[SEMAINE_CREUSE - 1]!, volumes[SEMAINE_CREUSE + 1]!];
    for (const v of voisins) {
      assert.ok(creux < v / 2, `la semaine creuse (${creux}) doit trancher sur ${v}`);
    }
  });
});

describe('scénario de démo — ce que l’écran raconte', () => {
  it('déclenche le ratio personnel', () => {
    const b = bilanDeDemo();
    assert.equal(b.ratios.niveau, 'personnel');
    assert.ok(b.ratios.mandatsRetenus >= MANDATS_MINIMUM);
    assert.equal(b.ratios.provisoire, false);
  });

  it('dessine un entonnoir lisible et strictement décroissant', () => {
    const b = bilanDeDemo();
    const valeurs = b.entonnoir.map((e) => e.valeur);

    for (let i = 1; i < valeurs.length; i += 1) {
      assert.ok(valeurs[i]! <= valeurs[i - 1]!, `étage ${i} plus large que le précédent`);
    }
    // Quatre étages qui portent quelque chose : un entonnoir, pas un trait.
    assert.ok(valeurs.every((v) => v > 0), `un étage est vide : ${valeurs.join(' → ')}`);
    assert.equal(valeurs[0], CIBLES_SCENARIO.leadsPris);
    assert.equal(valeurs[3], CIBLES_SCENARIO.mandats);
  });

  it('n’a aucune source muette : tous les compteurs ont vécu', () => {
    const b = bilanDeDemo();
    for (const c of b.compteurs) {
      assert.equal(c.etatSource, 'ok', `${c.activite} est ${c.etatSource}`);
    }
  });

  it('sort de l’état semaine 1', () => {
    assert.equal(bilanDeDemo().semaine1, false);
  });

  it('désigne un vrai levier, sur une source qui mesure', () => {
    const b = bilanDeDemo();
    const p = phrasePilotage({
      compteurs: valeursDe(b),
      objectifMandatsMois: b.mandatsDuMois.objectif,
      ratios: b.ratios,
      periode: 'semaine',
      intervalle: b.intervalle,
      semaine1: b.semaine1,
      etatsSource: b.etatsSource,
      jourCourant: dateKeyParis(MAINTENANT),
    });

    assert.equal(p.ton, 'retard');
    assert.ok(p.levier, 'la phrase doit désigner un levier');
    assert.equal(b.etatsSource[p.levier!], 'ok');
    assert.ok(p.manque > 0);
    // Un retard crédible : ni dérisoire, ni décourageant.
    assert.ok(p.manque < 60, `retard invraisemblable : ${p.manque}`);
  });

  it('garde des ratios plausibles pour du porte-à-porte', () => {
    const { ratios } = bilanDeDemo();
    assert.ok(
      ratios.physiquesParQualifie! >= 5 && ratios.physiquesParQualifie! <= 20,
      `ratio contacts/qualifié hors du plausible : ${ratios.physiquesParQualifie}`,
    );
    assert.ok(ratios.estimationsParMandat! >= 1 && ratios.estimationsParMandat! <= 5);
  });

  it('montre de l’activité chaque jour ouvré de la semaine en cours', () => {
    const b = bilanDeDemo();
    const ouvres = b.jours.filter((j) => {
      const jour = new Date(`${j.jour}T12:00:00Z`).getUTCDay();
      return jour >= 1 && jour <= 6;
    });
    const actifs = ouvres.filter((j) =>
      Object.values(j.compteurs).some((v) => v > 0),
    );
    assert.ok(actifs.length >= 3, `seulement ${actifs.length} jours actifs`);
  });

  it('reste cohérent sur la vue mensuelle', () => {
    const mois = bilanDeDemo('mois');
    assert.equal(mois.semaine1, false);
    assert.equal(mois.ratios.niveau, 'personnel');
    const valeurs = mois.entonnoir.map((e) => e.valeur);
    for (let i = 1; i < valeurs.length; i += 1) {
      assert.ok(valeurs[i]! <= valeurs[i - 1]!);
    }
  });
});
