import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_DISPLAY_SIGNALS } from './display-signals';
import { nomProprietaireAffiche, noteEssentielle, signauxEssentiels } from './lead-apercu';

describe('signauxEssentiels', () => {
  it('prend le signal principal en premier', () => {
    assert.deepEqual(
      signauxEssentiels({
        mainSignalLabel: 'DPE récent',
        signals: [{ label: 'Vente dans l’immeuble' }],
      }),
      ['DPE récent', 'Vente dans l’immeuble'],
    );
  });

  it('ignore les doublons et s’arrête à trois', () => {
    assert.deepEqual(
      signauxEssentiels({
        mainSignalLabel: 'DPE F',
        signals: [
          { label: 'DPE F' },
          { label: 'Cascade' },
          { label: 'SCI' },
          { label: 'Encore un' },
        ],
      }),
      ['DPE F', 'Cascade', 'SCI'],
    );
  });

  it('complète avec les familles affichables s’il manque des libellés', () => {
    assert.deepEqual(
      signauxEssentiels({
        displaySignals: {
          ...EMPTY_DISPLAY_SIGNALS,
          dpe: { classe: 'E', date: null, ageJours: null, items: [] },
          cascade: { nbVentes: 2, dates: [], tooltip: null },
        },
      }),
      ['DPE E', '2 ventes dans l’immeuble'],
    );
  });
});

describe('noteEssentielle', () => {
  it('garde le corps sans l’en-tête', () => {
    assert.equal(
      noteEssentielle('[12/09 — Simon]\nGardien : travaux prévus cet hiver.'),
      'Gardien : travaux prévus cet hiver.',
    );
  });

  it('reste muette s’il n’y a rien', () => {
    assert.equal(noteEssentielle(null), null);
    assert.equal(noteEssentielle('[12/09 — Simon]'), null);
  });
});

describe('nomProprietaireAffiche', () => {
  it('remet le nom en casse lisible', () => {
    assert.equal(nomProprietaireAffiche({ ownerName: 'DUPONT JEAN' }), 'Dupont Jean');
  });

  it('prend la société s’il n’y a pas de personne', () => {
    assert.equal(
      nomProprietaireAffiche({ ownerCompany: 'SCI DU PARC' }),
      'Sci Du Parc',
    );
  });

  it('reste muet si on ne sait rien', () => {
    assert.equal(nomProprietaireAffiche({}), null);
  });
});
