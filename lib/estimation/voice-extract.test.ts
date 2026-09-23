import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EstimationObjet } from './objet';
import { BIEN_VIDE } from './objet';
import {
  applyEstimationVoiceDraft,
  EMPTY_ESTIMATION_VOICE,
  mergeEstimationVoiceDrafts,
  modelContentToJson,
  parseAnneeConstruction,
  parseEstimationVoice,
  parseFloor,
  voiceDraftKeys,
} from './voice-extract';
import { ditSurfaceLogement, extractEstimationHeuristic } from './voice-heuristic';

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

  it('prend une année chiffrée, refuse un style', () => {
    assert.equal(parseAnneeConstruction(1910), 1910);
    assert.equal(parseAnneeConstruction('construit en 1910'), 1910);
    assert.equal(parseAnneeConstruction(96), 1996);
    assert.equal(parseAnneeConstruction('année 96'), 1996);
    assert.equal(parseAnneeConstruction(1000), null);
    assert.equal(parseAnneeConstruction('haussmannien'), null);
    assert.equal(parseAnneeConstruction('années 30'), null);
    const style = parseEstimationVoice(
      JSON.stringify({ anneeConstruction: 'haussmannien', pointsForts: ['haussmannien', 'lumineux'] }),
    );
    assert.equal(style.anneeConstruction, null);
    assert.deepEqual(style.pointsForts, ['haussmannien', 'lumineux']);
  });

  it('laisse vide un champ non dit', () => {
    const d = parseEstimationVoice(JSON.stringify({ rooms: 3 }));
    assert.equal(d.rooms, 3);
    assert.equal(d.surfaceM2, null);
    assert.equal(d.ascenseur, null);
    assert.deepEqual(d.annexes, []);
  });

  it('donne un libellé Terrasse à une annexe sans nom si balcon/terrasse est dit', () => {
    const d = parseEstimationVoice(
      JSON.stringify({ balconTerrasse: true, annexes: [{ surfaceM2: 30 }] }),
    );
    assert.equal(d.annexes[0]?.libelle, 'Terrasse');
    assert.equal(d.annexes[0]?.surfaceM2, 30);
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

  it('écrit une année dite, pas un style', () => {
    const { patch, keys } = applyEstimationVoiceDraft(base, {
      ...EMPTY_ESTIMATION_VOICE,
      anneeConstruction: 1910,
    });
    assert.ok(keys.includes('anneeConstruction'));
    const bien = patch.bien as { anneeConstruction: number | null };
    assert.equal(bien.anneeConstruction, 1910);
  });

  it('retire la surface du bien si elle appartenait à la terrasse', () => {
    const deja = { ...base, surfaceM2: 30 } as unknown as EstimationObjet;
    const { patch } = applyEstimationVoiceDraft(deja, {
      ...EMPTY_ESTIMATION_VOICE,
      annexes: [{ libelle: 'Terrasse', surfaceM2: 30, valorisationEur: null }],
    });
    assert.equal(patch.surfaceM2, null);
    const annexes = patch.annexes as { libelle: string; surfaceM2: number | null }[];
    assert.equal(annexes[0]?.libelle, 'Terrasse');
    assert.equal(annexes[0]?.surfaceM2, 30);
  });

  it('n’écrit pas 30 au logement si le brouillon répète la surface de la terrasse', () => {
    const { patch } = applyEstimationVoiceDraft(base, {
      ...EMPTY_ESTIMATION_VOICE,
      surfaceM2: 30,
      annexes: [{ libelle: 'Terrasse', surfaceM2: 30, valorisationEur: null }],
    });
    assert.equal(patch.surfaceM2, undefined);
    const annexes = patch.annexes as { libelle: string; surfaceM2: number | null }[];
    assert.equal(annexes[0]?.libelle, 'Terrasse');
    assert.equal(annexes[0]?.surfaceM2, 30);
  });

  it('remplit le libellé d’une annexe déjà posée vide', () => {
    const vide = {
      ...base,
      annexes: [{ id: 'a1', libelle: '', surfaceM2: 30, valorisationEur: null }],
    } as unknown as EstimationObjet;
    const { patch } = applyEstimationVoiceDraft(vide, {
      ...EMPTY_ESTIMATION_VOICE,
      annexes: [{ libelle: 'Terrasse', surfaceM2: 30, valorisationEur: null }],
    });
    const annexes = patch.annexes as { libelle: string; surfaceM2: number | null }[];
    assert.equal(annexes.length, 1);
    assert.equal(annexes[0]?.libelle, 'Terrasse');
    assert.equal(annexes[0]?.surfaceM2, 30);
  });

  it('met à jour la surface d’une cave déjà posée', () => {
    const avecCave = {
      ...base,
      annexes: [{ id: 'a1', libelle: 'Cave', surfaceM2: null, valorisationEur: null }],
    } as unknown as EstimationObjet;
    const { patch } = applyEstimationVoiceDraft(avecCave, {
      ...EMPTY_ESTIMATION_VOICE,
      annexes: [{ libelle: 'Cave', surfaceM2: 10, valorisationEur: null }],
    });
    const annexes = patch.annexes as { libelle: string; surfaceM2: number | null }[];
    assert.equal(annexes[0]?.surfaceM2, 10);
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

describe('parseEstimationVoice — réponses modèle', () => {
  it('lit un JSON entouré de fences', () => {
    const d = parseEstimationVoice('```json\n{"rooms":3,"surfaceM2":65}\n```');
    assert.equal(d.rooms, 3);
    assert.equal(d.surfaceM2, 65);
  });

  it('lit un objet déjà parsé', () => {
    const json = modelContentToJson({ rooms: 2, propertyType: 'appartement' });
    const d = parseEstimationVoice(json);
    assert.equal(d.rooms, 2);
    assert.equal(d.propertyType, 'appartement');
  });
});

describe('extractEstimationHeuristic', () => {
  it('range une dictée d’appartement parlée', () => {
    const d = extractEstimationHeuristic(
      'Alors c’est un T3 de 65 mètres carrés au troisième étage avec cave et ascenseur, assez lumineux, occupé, DPE D',
    );
    assert.equal(d.propertyType, 'appartement');
    assert.equal(d.rooms, 3);
    assert.equal(d.surfaceM2, 65);
    assert.equal(d.floor, '3');
    assert.equal(d.ascenseur, true);
    assert.equal(d.occupation, 'occupe');
    assert.equal(d.dpeClass, 'D');
    assert.equal(d.annexes[0]?.libelle, 'Cave');
    assert.ok(d.pointsForts.includes('lumineux'));
  });

  it('prend la surface de la cave, pas comme surface du logement', () => {
    const d = extractEstimationHeuristic(
      'T3 de 65 mètres carrés avec une cave de 10 m² environ',
    );
    assert.equal(d.rooms, 3);
    assert.equal(d.surfaceM2, 65);
    assert.equal(d.annexes[0]?.libelle, 'Cave');
    assert.equal(d.annexes[0]?.surfaceM2, 10);
  });

  it('lit 3 étages dans l’immeuble', () => {
    const d = extractEstimationHeuristic('il y a 3 étages dans l’immeuble');
    assert.equal(d.etagesImmeuble, 3);
    assert.equal(d.floor, null);
  });

  it('lit immeuble de trois étages', () => {
    const d = extractEstimationHeuristic('immeuble de trois étages');
    assert.equal(d.etagesImmeuble, 3);
  });

  it('attache 50 000 € à la cave, pas 500 000', () => {
    const d = extractEstimationHeuristic(
      'il y a une cave de 10 m², d’une valorisation de 50 000 €',
    );
    assert.equal(d.annexes[0]?.libelle, 'Cave');
    assert.equal(d.annexes[0]?.surfaceM2, 10);
    assert.equal(d.annexes[0]?.valorisationEur, 50_000);
    assert.equal(d.surfaceM2, null);
  });

  it('lit cinquante mille euros de valorisation de cave', () => {
    const d = extractEstimationHeuristic(
      'cave de 10 m2 valorisation cinquante mille euros',
    );
    assert.equal(d.annexes[0]?.valorisationEur, 50_000);
  });

  it('met une terrasse de 30 m² dans les annexes, pas dans la surface du bien', () => {
    const d = extractEstimationHeuristic('Il y a une terrasse de 30 m²');
    assert.equal(d.surfaceM2, null);
    assert.equal(d.annexes[0]?.libelle, 'Terrasse');
    assert.equal(d.annexes[0]?.surfaceM2, 30);
    assert.equal(d.balconTerrasse, true);
  });

  it('garde 70 m² pour le T3, la cave n’a pas cette surface', () => {
    const d = extractEstimationHeuristic('T3 de 70 m2 avec cave');
    assert.equal(d.rooms, 3);
    assert.equal(d.surfaceM2, 70);
    assert.equal(d.annexes[0]?.libelle, 'Cave');
    assert.equal(d.annexes[0]?.surfaceM2, null);
  });

  it('ne donne pas le 70 m² à une terrasse citée plus tôt', () => {
    const d = extractEstimationHeuristic('terrasse et un T3 de 70 m2');
    assert.equal(d.surfaceM2, 70);
    assert.equal(d.annexes[0]?.libelle, 'Terrasse');
    assert.equal(d.annexes[0]?.surfaceM2, null);
  });

  it('met un balcon de 8 m² dans les annexes', () => {
    const d = extractEstimationHeuristic('il y a un balcon de 8 m²');
    assert.equal(d.surfaceM2, null);
    assert.equal(d.annexes[0]?.libelle, 'Terrasse');
    assert.equal(d.annexes[0]?.surfaceM2, 8);
  });

  it('ne prend pas un m² isolé pour la surface du logement', () => {
    assert.equal(ditSurfaceLogement('Il y a une terrasse de 30 m²'), false);
    assert.equal(ditSurfaceLogement('30 m²'), false);
    assert.equal(ditSurfaceLogement('T3 de 70 m2 avec cave'), true);
    assert.equal(ditSurfaceLogement('surface habitable 65 m2'), true);
  });

  it('lit « année 96 » et garde la dernière année après une reprise', () => {
    assert.equal(extractEstimationHeuristic('année de construction 96').anneeConstruction, 1996);
    assert.equal(
      extractEstimationHeuristic(
        'année de construction 2000 ah non pardon l’année de construction c’est 1800',
      ).anneeConstruction,
      1800,
    );
  });

  it('lit un studio RDC sans ascenseur', () => {
    const d = extractEstimationHeuristic('Studio 28 m2 RDC sans ascenseur un peu sombre');
    assert.equal(d.propertyType, 'appartement');
    assert.equal(d.sousType, 'Studio');
    assert.equal(d.rooms, 1);
    assert.equal(d.surfaceM2, 28);
    assert.equal(d.floor, 'RDC');
    assert.equal(d.ascenseur, false);
    assert.ok(d.pointsFaibles.includes('sombre'));
  });
});

describe('mergeEstimationVoiceDrafts', () => {
  it('empêche le modèle de voler la surface d’une terrasse', () => {
    const merged = mergeEstimationVoiceDrafts(
      { ...EMPTY_ESTIMATION_VOICE, surfaceM2: 30, annexes: [{ libelle: 'Terrasse', surfaceM2: null, valorisationEur: null }] },
      extractEstimationHeuristic('Il y a une terrasse de 30 m²'),
    );
    assert.equal(merged.surfaceM2, null);
    assert.equal(merged.annexes[0]?.libelle, 'Terrasse');
    assert.equal(merged.annexes[0]?.surfaceM2, 30);
  });

  it('garde le modèle et complète avec l’heuristique', () => {
    const merged = mergeEstimationVoiceDrafts(
      { ...EMPTY_ESTIMATION_VOICE, rooms: 4 },
      extractEstimationHeuristic('T3 de 70 m2 avec cave'),
    );
    assert.equal(merged.rooms, 4);
    assert.equal(merged.surfaceM2, 70);
    assert.equal(merged.annexes[0]?.libelle, 'Cave');
  });
});
