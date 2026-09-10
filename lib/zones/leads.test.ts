import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  JOURS_AVANT_OUVERTURE_AGENCE,
  grouperParSecteur,
  libelleMention,
  sousGroupesAgence,
  statistiquesParZone,
  type LeadSituable,
} from './leads';
import type { RegleZone, ValeurPolygone, Zone } from './types';

const MOI = 'moi';
const COLLEGUE = 'thomas';
const MAINTENANT = new Date('2026-09-09T10:00:00Z');

/** Deux carrés jointifs : l'ouest à moi, l'est au collègue. */
function carre(lngMin: number, lngMax: number): ValeurPolygone {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lngMin, 48.84],
        [lngMax, 48.84],
        [lngMax, 48.86],
        [lngMin, 48.86],
        [lngMin, 48.84],
      ],
    ],
  };
}

function zone(id: string, assignedTo: string | null, valeur: ValeurPolygone): Zone {
  const regle: RegleZone = {
    id: `r-${id}`,
    zoneId: id,
    inclusion: true,
    type: 'polygone',
    valeur,
  };
  return {
    id,
    agencyId: 'a1',
    nom: `Zone ${id}`,
    couleur: '#4C7A9E',
    assignedTo,
    jourSemaine: null,
    actif: true,
    regles: [regle],
  };
}

const MA_ZONE = zone('ouest', MOI, carre(2.38, 2.4));
const ZONE_COLLEGUE = zone('est', COLLEGUE, carre(2.4, 2.42));
const ZONES = [MA_ZONE, ZONE_COLLEGUE];

function lead(partiel: Partial<LeadSituable> & { id: string }): LeadSituable {
  return {
    address: '10 Rue de Test 75020 Paris',
    postalCode: '75020',
    latitude: 48.85,
    longitude: 2.39,
    assignedTo: null,
    stageId: null,
    deliveredAt: '2026-09-08',
    createdAt: '2026-09-08T08:00:00Z',
    ...partiel,
  };
}

function grouper(leads: readonly LeadSituable[]) {
  return grouperParSecteur({
    leads,
    zones: ZONES,
    profileId: MOI,
    prenoms: { [COLLEGUE]: 'Thomas' },
    maintenant: MAINTENANT,
  });
}

describe('mon secteur', () => {
  it('retient les adresses de ma zone, prises ou non', () => {
    const g = grouper([
      lead({ id: 'a', longitude: 2.39 }),
      lead({ id: 'b', longitude: 2.39, assignedTo: MOI, stageId: 'entree' }),
    ]);
    assert.deepEqual(
      g.monSecteur.map((l) => l.id),
      ['a', 'b'],
    );
    assert.equal(g.zone?.id, 'ouest');
    assert.equal(g.agence.length, 0);
  });

  it('n’invente pas de secteur quand l’agent n’en a pas', () => {
    const g = grouperParSecteur({
      leads: [lead({ id: 'a' })],
      zones: [ZONE_COLLEGUE],
      profileId: MOI,
      maintenant: MAINTENANT,
    });
    assert.equal(g.zone, null);
    assert.equal(g.monSecteur.length, 0);
    // Hors de toute zone attribuée : la file agence, avec la raison.
    assert.equal(g.agence[0]?.mention.kind, 'hors_secteur');
  });
});

describe('mes leads pris hors de ma zone', () => {
  it('ne disparaissent pas et ne tombent pas dans la file agence', () => {
    const g = grouper([lead({ id: 'a', longitude: 2.41, assignedTo: MOI, stageId: 'entree' })]);
    assert.deepEqual(
      g.mesHorsSecteur.map((l) => l.id),
      ['a'],
    );
    assert.equal(g.agence.length, 0);
    assert.equal(g.monSecteur.length, 0);
  });
});

describe('file agence — deux cas, jamais confondus', () => {
  it('signale un lead hors de toute zone', () => {
    const g = grouper([lead({ id: 'a', longitude: 2.5 })]);
    assert.deepEqual(g.agence.map((x) => x.mention.kind), ['hors_secteur']);
    assert.equal(libelleMention(g.agence[0]!.mention), 'Hors secteur attribué');
  });

  it('traite une zone sans titulaire comme hors secteur', () => {
    const orpheline = zone('nord', null, carre(2.42, 2.44));
    const g = grouperParSecteur({
      leads: [lead({ id: 'a', longitude: 2.43 })],
      zones: [MA_ZONE, orpheline],
      profileId: MOI,
      maintenant: MAINTENANT,
    });
    assert.equal(g.agence[0]?.mention.kind, 'hors_secteur');
  });

  it('laisse au collègue ses leads récents', () => {
    const g = grouper([lead({ id: 'a', longitude: 2.41, deliveredAt: '2026-09-08' })]);
    assert.equal(g.agence.length, 0);
    assert.equal(g.monSecteur.length, 0);
    assert.equal(g.mesHorsSecteur.length, 0);
  });

  it('ouvre son lead oublié passé le délai, en nommant le titulaire', () => {
    const g = grouper([lead({ id: 'a', longitude: 2.41, deliveredAt: '2026-08-20' })]);
    assert.equal(g.agence.length, 1);
    const mention = g.agence[0]!.mention;
    assert.equal(mention.kind, 'zone_collegue');
    if (mention.kind !== 'zone_collegue') return;
    assert.equal(mention.prenom, 'Thomas');
    assert.equal(mention.jours, 20);
    assert.match(libelleMention(mention), /^Zone de Thomas, non pris depuis 20 jours$/);
  });

  it('n’ouvre jamais un lead que le collègue a déjà pris', () => {
    const g = grouper([
      lead({ id: 'a', longitude: 2.41, deliveredAt: '2026-01-01', stageId: 'entree', assignedTo: COLLEGUE }),
    ]);
    assert.equal(g.agence.length, 0);
  });

  it('retombe sur le nom de zone quand le prénom est inconnu', () => {
    const g = grouperParSecteur({
      leads: [lead({ id: 'a', longitude: 2.41, deliveredAt: '2026-08-20' })],
      zones: ZONES,
      profileId: MOI,
      maintenant: MAINTENANT,
    });
    assert.match(libelleMention(g.agence[0]!.mention), /^Zone de Zone est, non pris/);
  });

  it('tient exactement le seuil de sept jours', () => {
    const jourPile = new Date(MAINTENANT.getTime() - JOURS_AVANT_OUVERTURE_AGENCE * 86_400_000);
    const surLeSeuil = grouper([
      lead({ id: 'a', longitude: 2.41, deliveredAt: jourPile.toISOString().slice(0, 10) }),
    ]);
    assert.equal(surLeSeuil.agence.length, 0, 'sept jours pile : encore au collègue');

    const veille = new Date(MAINTENANT.getTime() - (JOURS_AVANT_OUVERTURE_AGENCE + 1) * 86_400_000);
    const apres = grouper([
      lead({ id: 'a', longitude: 2.41, deliveredAt: veille.toISOString().slice(0, 10) }),
    ]);
    assert.equal(apres.agence.length, 1, 'huit jours : ouvert à l’agence');
  });

  it('ne place pas un lead non géocodé dans un secteur', () => {
    const g = grouper([lead({ id: 'a', latitude: null, longitude: null })]);
    assert.equal(g.agence[0]?.mention.kind, 'hors_secteur');
  });
});

describe('découpage de la file agence', () => {
  it('met les orphelins avant les zones de collègues', () => {
    const g = grouper([
      lead({ id: 'collegue', longitude: 2.41, deliveredAt: '2026-08-20' }),
      lead({ id: 'orphelin', longitude: 2.5 }),
    ]);
    const groupes = sousGroupesAgence(g.agence);
    assert.deepEqual(
      groupes.map((x) => x.cle),
      ['hors-secteur', 'Zone est'],
    );
    assert.equal(groupes[0]?.titre, 'Hors secteur attribué');
    assert.match(groupes[1]!.titre, /^Zone de Thomas · non pris depuis plus de 7 jours$/);
  });

  it('regroupe plusieurs leads d’une même zone sous un seul titre', () => {
    const g = grouper([
      lead({ id: 'a', longitude: 2.41, deliveredAt: '2026-08-20' }),
      lead({ id: 'b', longitude: 2.415, deliveredAt: '2026-08-25' }),
    ]);
    const groupes = sousGroupesAgence(g.agence);
    assert.equal(groupes.length, 1);
    assert.equal(groupes[0]?.leads.length, 2);
  });

  it('ne produit aucun groupe sur une file vide', () => {
    assert.deepEqual(sousGroupesAgence([]), []);
  });
});

describe('vue directeur — taux de prise par zone', () => {
  it('compte les leads et la part prise de chaque zone', () => {
    const { parZone, horsZone } = statistiquesParZone(
      [
        lead({ id: 'a', longitude: 2.39, stageId: 'entree' }),
        lead({ id: 'b', longitude: 2.39 }),
        lead({ id: 'c', longitude: 2.41 }),
        lead({ id: 'd', longitude: 2.5 }),
      ],
      ZONES,
    );

    const ouest = parZone.find((z) => z.zone.id === 'ouest');
    assert.equal(ouest?.total, 2);
    assert.equal(ouest?.pris, 1);
    assert.equal(ouest?.tauxPrise, 50);

    const est = parZone.find((z) => z.zone.id === 'est');
    assert.equal(est?.total, 1);
    assert.equal(est?.tauxPrise, 0);

    assert.deepEqual(
      horsZone.map((l) => l.id),
      ['d'],
    );
  });

  it('affiche une zone vide sans diviser par zéro', () => {
    const { parZone } = statistiquesParZone([], ZONES);
    assert.deepEqual(
      parZone.map((z) => z.tauxPrise),
      [0, 0],
    );
  });

  it('ignore les zones désactivées', () => {
    const eteinte: Zone = { ...ZONE_COLLEGUE, actif: false };
    const { parZone, horsZone } = statistiquesParZone(
      [lead({ id: 'a', longitude: 2.41 })],
      [MA_ZONE, eteinte],
    );
    assert.equal(parZone.length, 1);
    assert.deepEqual(
      horsZone.map((l) => l.id),
      ['a'],
    );
  });
});
