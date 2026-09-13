import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { regrouperNotifications } from './regrouper';
import { destinataireValide, TYPES_NON_GENERES, type Notification } from './types';
import { titreAdressesARevoir, titreGroupe, titreLeadsLivresDirecteur, titreLeadsLivresNego } from './textes';

function notif(partial: Partial<Notification> & Pick<Notification, 'id' | 'createdAt'>): Notification {
  return {
    agencyId: 'ag',
    profileId: 'moi',
    type: 'note_transcrite',
    titre: 'Une note prête à relire',
    corps: 'Ta dictée est prête.',
    lien: '/dashboard?notes=1',
    entiteType: 'note',
    entiteId: partial.id,
    lueLe: null,
    groupeCle: 'note_transcrite',
    ...partial,
  };
}

describe('destinataireValide', () => {
  it('refuse d’écrire à l’auteur de l’action', () => {
    assert.equal(destinataireValide('a', 'a'), false);
  });
  it('accepte un autre destinataire', () => {
    assert.equal(destinataireValide('b', 'a'), true);
  });
});

describe('TYPES_NON_GENERES', () => {
  it('écarte les tâches Accueil et les actions qu’on vient de faire', () => {
    assert.ok(TYPES_NON_GENERES.includes('demande_estimation'));
    assert.ok(TYPES_NON_GENERES.includes('lead_portail'));
    assert.ok(TYPES_NON_GENERES.includes('estimation_consultee'));
    assert.ok(TYPES_NON_GENERES.includes('estimation_calculee'));
    assert.ok(TYPES_NON_GENERES.includes('import_termine'));
  });
});

describe('regrouperNotifications', () => {
  it('fusionne trois notes dans la fenêtre de 2 h', () => {
    const groupes = regrouperNotifications([
      notif({ id: '1', createdAt: '2026-09-12T10:00:00.000Z' }),
      notif({ id: '2', createdAt: '2026-09-12T10:40:00.000Z' }),
      notif({ id: '3', createdAt: '2026-09-12T11:10:00.000Z' }),
    ]);
    assert.equal(groupes.length, 1);
    assert.equal(groupes[0]!.items.length, 3);
    assert.equal(groupes[0]!.titre, '3 notes prêtes à relire');
    assert.equal(groupes[0]!.nonLues, 3);
  });

  it('sépare deux grappes à plus de 2 h', () => {
    const groupes = regrouperNotifications([
      notif({ id: '1', createdAt: '2026-09-12T08:00:00.000Z' }),
      notif({ id: '2', createdAt: '2026-09-12T11:00:00.000Z' }),
    ]);
    assert.equal(groupes.length, 2);
    assert.equal(groupes[0]!.id, '2');
    assert.equal(groupes[1]!.id, '1');
  });

  it('ne mélange pas des clés différentes', () => {
    const groupes = regrouperNotifications([
      notif({
        id: '1',
        createdAt: '2026-09-12T10:00:00.000Z',
        type: 'leads_assignes',
        groupeCle: 'leads_assignes',
        titre: 'Un lead t’a été assigné',
      }),
      notif({ id: '2', createdAt: '2026-09-12T10:05:00.000Z' }),
    ]);
    assert.equal(groupes.length, 2);
  });
});

describe('textes', () => {
  it('formule la livraison selon le rôle', () => {
    assert.equal(titreLeadsLivresNego(4), '4 adresses dans ton secteur');
    assert.equal(titreLeadsLivresDirecteur(25), '25 adresses livrées');
    assert.equal(titreGroupe('note_transcrite', 3, 'Une note prête à relire'), '3 notes prêtes à relire');
    assert.equal(titreAdressesARevoir(1), '1 adresse n’a pas été passée');
    assert.equal(titreAdressesARevoir(27), '27 adresses n’ont pas été passées');
  });
});
