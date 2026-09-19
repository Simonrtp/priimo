import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EstimationObjet } from './objet';
import { BIEN_VIDE } from './objet';
import {
  applyEstimationVoiceDraft,
  EMPTY_ESTIMATION_VOICE,
  parseEstimationVoice,
  parseFloor,
  voiceDraftKeys,
} from './voice-extract';

describe('parseEstimationVoice', () => {
  it('ne devine rien sur un JSON vide', () => {
    const d = parseEstimationVoice('{}');
    assert.deepEqual(d, EMPTY_ESTIMATION_VOICE);
  });

  it('ignore un texte qui n’est pas du JSON', () => {
    assert.deepEqual(parseEstimationVoice('pas json'), EMPTY_ESTIMATION_VOICE);
  });

  it('lit un appartement dit clairement', () => {
    const d = parseEstimationVoice(
      JSON.stringify({
        propertyType: 'appartement',
        sousType: 'Duplex',
        rooms: 4,
        chambres: 2,
        surfaceM2: 78,
        carrez: true,
        floor: '3',
        occupation: 'occupe',
        dpeClass: 'D',
        address: '12 rue de la Paix',
      }),
    );
    assert.equal(d.propertyType, 'appartement');
    assert.equal(d.sousType, 'Duplex');
    assert.equal(d.rooms, 4);
    assert.equal(d.chambres, 2);
    assert.equal(d.surfaceM2, 78);
    assert.equal(d.carrez, true);
    assert.equal(d.floor, '3');
    assert.equal(d.occupation, 'occupe');
    assert.equal(d.dpeClass, 'D');
    assert.equal('address' in d, false);
  });

  it('normalise l’étage RDC', () => {
    assert.equal(parseFloor('rez-de-chaussée'), 'RDC');
    assert.equal(parseFloor('RDC'), 'RDC');
    assert.equal(parseFloor('3ème'), '3');
    assert.equal(parseFloor('inconnu'), null);
  });

  it('lit une qualité d’emplacement partielle', () => {
    const d = parseEstimationVoice(JSON.stringify({ qualiteEmplacement: 'très bon emplacement' }));
    assert.equal(d.qualiteEmplacement, 'Très bon');
  });

  it('laisse vide un champ non dit', () => {
    const d = parseEstimationVoice(JSON.stringify({ rooms: 3 }));
    assert.equal(d.rooms, 3);
    assert.equal(d.surfaceM2, null);
    assert.equal(d.ascenseur, null);
    assert.deepEqual(d.annexes, []);
  });
});

describe('applyEstimationVoiceDraft', () => {
  const base = {
    bien: { ...BIEN_VIDE },
    annexes: [],
    pointsForts: [],
    pointsFaibles: [],
    commentairesPublics: null,
    rooms: null,
    surfaceM2: null,
    floor: null,
    propertyType: null,
    occupation: 'libre',
    dpeClass: null,
    address: '12 rue déjà saisie',
  } as unknown as EstimationObjet;

  it('ne pose jamais l’adresse', () => {
    const { patch } = applyEstimationVoiceDraft(base, {
      ...EMPTY_ESTIMATION_VOICE,
      rooms: 3,
    });
    assert.equal('address' in patch, false);
    assert.equal(patch.rooms, 3);
  });

  it('marque seulement les champs dits', () => {
    const { keys } = applyEstimationVoiceDraft(base, {
      ...EMPTY_ESTIMATION_VOICE,
      surfaceM2: 65,
      annexes: [{ libelle: 'Cave', surfaceM2: 8, valorisationEur: null }],
    });
    assert.deepEqual(keys.sort(), ['annexes', 'surfaceM2'].sort());
  });

  it('liste les clés d’un brouillon vide', () => {
    assert.deepEqual(voiceDraftKeys(EMPTY_ESTIMATION_VOICE), []);
  });

  it('n’écrit pas l’occupation par défaut si elle n’a pas été dite', () => {
    const { patch } = applyEstimationVoiceDraft(base, {
      ...EMPTY_ESTIMATION_VOICE,
      rooms: 3,
    });
    assert.equal('occupation' in patch, false);
  });

  it('déduit dernier étage = non si 2e sur 3', () => {
    const { patch } = applyEstimationVoiceDraft(base, {
      ...EMPTY_ESTIMATION_VOICE,
      floor: '2',
      etagesImmeuble: 3,
    });
    const bien = patch.bien as { dernierEtage: boolean | null };
    assert.equal(bien.dernierEtage, false);
  });

  it('ajoute une cave et sa valorisation', () => {
    const { patch, keys } = applyEstimationVoiceDraft(base, {
      ...EMPTY_ESTIMATION_VOICE,
      annexes: [{ libelle: 'Cave', surfaceM2: 8, valorisationEur: 2000 }],
    });
    assert.ok(keys.includes('annexes'));
    const annexes = patch.annexes as { libelle: string; valorisationEur: number | null }[];
    assert.equal(annexes.length, 1);
    assert.equal(annexes[0].libelle, 'Cave');
    assert.equal(annexes[0].valorisationEur, 2000);
  });
});
