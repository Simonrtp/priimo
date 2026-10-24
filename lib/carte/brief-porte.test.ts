import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BatimentParcelle } from './bdnb';
import {
  appliquerRedaction,
  briefARediger,
  collecterBrief,
  ligneRedigeeAcceptable,
  notesVisibles,
  promptBrief,
  sourceEmpreinte,
  texteAEcouter,
  type FicheBrief,
  type LigneBrief,
  type NoteBrief,
} from './brief-porte';
import { passeFiltresPorte } from '@/lib/script-approche-filtres';

const MAINTENANT = new Date('2026-10-02T12:00:00Z');
const plat = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

const ALICE = { id: 'alice', role: 'collaborateur' as const };
const BRUNO = { id: 'bruno', role: 'collaborateur' as const };
const DIRECTRICE = { id: 'claire', role: 'directeur' as const };

function batiment(partiel: Partial<BatimentParcelle> = {}): BatimentParcelle {
  return {
    nbBatiments: 1,
    empriseM2: 300,
    usage: 'Résidentiel collectif',
    anneeConstruction: 1930,
    niveaux: 6,
    logements: 24,
    materiaux: null,
    proprietaires: [],
    dpeRecents: 0,
    dpeRecentsFG: 0,
    dpeAnciens: 0,
    dpeAnciensFG: 0,
    dpeTertiaire: null,
    monumentHistorique: null,
    quartierPrioritaire: null,
    adressesBan: [],
    adressePrincipale: null,
    ...partiel,
  };
}

function fiche(partiel: Partial<FicheBrief> = {}): FicheBrief {
  return {
    horsSecteur: false,
    batiment: batiment(),
    coproprietes: [{ lots: 32, periodeConstruction: '1919-1945', procedureEnCours: false, numeroImmatriculation: 'AB1' }],
    ventes: [
      { date: '2025-03-01', prix: 380_000, surface: 50, prixM2: 7600, typeLocal: 'Appartement', nombrePieces: 2, banId: null },
      { date: '2025-09-01', prix: 300_000, surface: 42, prixM2: 7143, typeLocal: 'Appartement', nombrePieces: 2, banId: null },
      { date: '2026-01-10', prix: 520_000, surface: 70, prixM2: 7429, typeLocal: 'Appartement', nombrePieces: 3, banId: null },
    ],
    passages: [{ jour: '2026-09-02', kind: 'rencontre', auteur: 'Bruno' }],
    contacts: [{ id: 'c1', href: '/c/1', nom: 'Marie Dupont', type: 'gardien', telephone: '0600000000' }],
    entreprises: [
      { nom: 'BOULANGERIE DES LILAS', telephone: '0100000000', activite: 'Boulangerie', categorie: 'commerce', leadId: 'l1' },
    ],
    proprietaires: [{ nom: 'SCI LES TILLEULS', siren: '123456789', genre: 'sci' }],
    prospects: [],
    ...partiel,
  };
}

const FICHE_VIDE: FicheBrief = {
  horsSecteur: false,
  batiment: null,
  coproprietes: [],
  ventes: [],
  passages: [],
  contacts: [],
  entreprises: [],
  proprietaires: [],
  prospects: [],
};

const NOTE_PRIVEE_BRUNO: NoteBrief = {
  id: 'n-privee',
  date: '2026-09-20',
  texte: 'Mon contact personnel Zébulon au 4e veut vendre à 610 000 euros, secret.',
  createdBy: 'bruno',
  visibilite: 'privee',
};

const NOTE_AGENCE: NoteBrief = {
  id: 'n-agence',
  date: '2026-09-12',
  texte: 'La gardienne dit qu’un T3 au 2e se libère en novembre.',
  createdBy: 'bruno',
  visibilite: 'agence',
};

function texteComplet(lignes: readonly LigneBrief[]): string {
  return lignes.map((l) => l.texte).join('\n');
}

describe('brief de porte — visibilité', () => {
  it('la note privée d’un autre agent n’apparaît pas dans le brief d’un collaborateur', () => {
    const notes = [NOTE_PRIVEE_BRUNO, NOTE_AGENCE];
    const { lignes, notes: visibles } = collecterBrief(fiche(), notes, ALICE, MAINTENANT);
    const tout = [
      texteComplet(lignes),
      promptBrief(lignes, visibles),
      sourceEmpreinte('75120000AB0001', lignes, visibles),
      texteAEcouter(lignes),
    ].join('\n');
    assert.ok(!tout.includes('Zébulon'));
    assert.ok(!tout.includes('610'));
    assert.ok(!tout.includes('n-privee'));
    assert.deepEqual(visibles.map((n) => n.id), ['n-agence']);
  });

  it('le directeur voit la note privée dans le brief', () => {
    const { lignes, notes: visibles } = collecterBrief(
      fiche(),
      [NOTE_PRIVEE_BRUNO, NOTE_AGENCE],
      DIRECTRICE,
      MAINTENANT,
    );
    assert.match(texteComplet(lignes), /Zébulon/);
    assert.deepEqual(visibles.map((n) => n.id), ['n-privee', 'n-agence']);
  });

  it('une rédaction qui recopierait la note privée est refusée', () => {
    const { lignes, notes: visibles } = collecterBrief(fiche(), [NOTE_PRIVEE_BRUNO, NOTE_AGENCE], ALICE, MAINTENANT);
    const brief = appliquerRedaction(
      lignes,
      visibles,
      JSON.stringify({ notes: 'Zébulon au 4e veut vendre à 610 000 euros.' }),
    );
    assert.ok(!texteComplet(brief.lignes).includes('Zébulon'));
    assert.ok(!texteComplet(brief.lignes).includes('610'));
  });

  it('l’auteur de la note privée la retrouve dans son propre brief', () => {
    const { lignes } = collecterBrief(fiche(), [NOTE_PRIVEE_BRUNO, NOTE_AGENCE], BRUNO, MAINTENANT);
    const notes = lignes.find((l) => l.cle === 'notes')!;
    assert.match(notes.texte, /Zébulon/);
    assert.match(notes.texte, /\+1 autre note/);
  });

  it('deux lecteurs qui voient la même chose partagent l’empreinte, pas les autres', () => {
    const notes = [NOTE_PRIVEE_BRUNO, NOTE_AGENCE];
    const pour = (v: typeof ALICE | typeof DIRECTRICE | typeof BRUNO) => {
      const r = collecterBrief(fiche({ passages: [] }), notes, v, MAINTENANT);
      return sourceEmpreinte('p', r.lignes, r.notes);
    };
    assert.equal(pour(DIRECTRICE), pour(BRUNO));
    assert.notEqual(pour(ALICE), pour(BRUNO));
  });

  it('l’empreinte change avec une note, un contact ou une vente', () => {
    const base = collecterBrief(fiche(), [NOTE_AGENCE], ALICE, MAINTENANT);
    const e0 = sourceEmpreinte('p', base.lignes, base.notes);
    const avecNote = collecterBrief(fiche(), [NOTE_AGENCE, { ...NOTE_AGENCE, id: 'n2', date: '2026-09-30' }], ALICE, MAINTENANT);
    const avecContact = collecterBrief(
      fiche({ contacts: [...fiche().contacts, { id: 'c2', href: '/c/2', nom: 'Paul Martin', type: 'vendeur', telephone: null }] }),
      [NOTE_AGENCE],
      ALICE,
      MAINTENANT,
    );
    const avecVente = collecterBrief(
      fiche({ ventes: [...fiche().ventes, { date: '2026-06-01', prix: 400_000, surface: 40, prixM2: 10_000, typeLocal: 'Appartement', nombrePieces: 2, banId: null }] }),
      [NOTE_AGENCE],
      ALICE,
      MAINTENANT,
    );
    for (const autre of [avecNote, avecContact, avecVente]) {
      assert.notEqual(sourceEmpreinte('p', autre.lignes, autre.notes), e0);
    }
    const encore = collecterBrief(fiche(), [NOTE_AGENCE], ALICE, MAINTENANT);
    assert.equal(sourceEmpreinte('p', encore.lignes, encore.notes), e0);
  });

  it('notesVisibles montre une note privée au directeur et à son auteur', () => {
    assert.deepEqual(notesVisibles([NOTE_PRIVEE_BRUNO], DIRECTRICE).map((n) => n.id), ['n-privee']);
    assert.deepEqual(notesVisibles([NOTE_PRIVEE_BRUNO], BRUNO).map((n) => n.id), ['n-privee']);
    assert.deepEqual(notesVisibles([NOTE_PRIVEE_BRUNO], ALICE), []);
  });
});

describe('brief de porte — contenu', () => {
  it('six lignes dans l’ordre, chacune avec son bloc source', () => {
    const { lignes } = collecterBrief(fiche(), [NOTE_AGENCE], ALICE, MAINTENANT);
    assert.deepEqual(lignes.map((l) => l.cle), ['immeuble', 'activite', 'qui', 'notes', 'ouverture', 'question']);
    assert.deepEqual(lignes.map((l) => l.bloc), ['copropriete', 'ventes', 'contacts', 'ici', 'ventes', 'contacts']);
    const [immeuble, activite, qui, , ouverture, question] = lignes.map((l) => plat(l.texte));
    assert.equal(immeuble, 'Immeuble collectif · construit en 1930 · 24 logements · copropriété de 32 lots');
    assert.match(activite!, /^Médiane 7 429 €\/m² sur 3 ventes · dernier passage le 2 sept\. 2026 \(personne rencontrée, Bruno\)$/);
    const noms = qui!.split(' · ');
    assert.equal(noms.length, 3);
    assert.equal(noms[0], 'Marie Dupont (gardien)');
    assert.match(noms[1]!, /\(boulangerie\)$/);
    assert.match(noms[2]!, /\(propriétaire\)$/);
    assert.match(ouverture!, /autour de 7 429 € le m²/);
    assert.match(question!, /^Au gardien :/);
  });

  it('dit ce qui manque au lieu de l’inventer', () => {
    const { lignes } = collecterBrief(FICHE_VIDE, [], ALICE, MAINTENANT);
    const t = Object.fromEntries(lignes.map((l) => [l.cle, l]));
    assert.equal(t.immeuble!.texte, 'Aucune description publique de l’immeuble');
    assert.equal(t.activite!.texte, 'Aucune vente publiée · aucun passage enregistré');
    assert.equal(t.qui!.texte, 'Aucun nom connu ici');
    assert.equal(t.notes!.texte, 'Aucune note terrain');
    assert.ok(t.immeuble!.manque && t.activite!.manque && t.qui!.manque && t.notes!.manque);
    assert.match(t.ouverture!.texte, /^Bonjour/);
    assert.match(t.question!.texte, /^Au propriétaire :/);
  });

  it('sans lecture des notes, renvoie au bloc au lieu d’affirmer qu’il n’y en a pas', () => {
    const { lignes } = collecterBrief(fiche(), null, ALICE, MAINTENANT);
    assert.equal(lignes.find((l) => l.cle === 'notes')!.texte, 'Mes notes terrain sont plus bas');
  });

  it('hors secteur : rien de public', () => {
    const { lignes } = collecterBrief(fiche({ horsSecteur: true, ventes: [] }), [], ALICE, MAINTENANT);
    assert.match(lignes[0]!.texte, /^Hors de nos codes postaux/);
    assert.doesNotMatch(lignes.find((l) => l.cle === 'ouverture')!.texte, /€/);
  });

  it('ne cite jamais de DPE, même quand la fiche en a', () => {
    const avecDpe = fiche({
      prospects: [
        {
          id: 'p1',
          href: '/l/1',
          adresse: '10 rue des Lilas',
          score: 90,
          dpe: 'G',
          etage: 2,
          surface: 30,
          pieces: 1,
          signaux: ['DPE G récent', 'Passoire thermique'],
          entreprise: null,
          etape: null,
          stageId: null,
          contactabilite: null,
        },
      ],
    });
    const { lignes, notes } = collecterBrief(avecDpe, [], ALICE, MAINTENANT);
    const tout = `${texteComplet(lignes)}\n${promptBrief(lignes, notes)}`;
    assert.doesNotMatch(tout, /\bDPE\b|passoire|classe [A-G]\b/i);
  });

  it('la phrase d’ouverture et la question passent les filtres des scripts d’approche', () => {
    for (const f of [fiche(), FICHE_VIDE, fiche({ ventes: fiche().ventes.map((v) => ({ ...v, prixM2: null })) })]) {
      const { lignes } = collecterBrief(f, [], ALICE, MAINTENANT);
      for (const l of lignes.filter((x) => x.cle === 'ouverture' || x.cle === 'question')) {
        assert.ok(passeFiltresPorte(l.texte), l.texte);
      }
    }
  });

  it('jamais « IA » dans le texte affiché ni lu', () => {
    const { lignes } = collecterBrief(fiche(), [NOTE_AGENCE], ALICE, MAINTENANT);
    assert.doesNotMatch(`${texteComplet(lignes)} ${texteAEcouter(lignes)}`, /\bIA\b/);
  });

  it('se lit à voix haute sans symboles', () => {
    const { lignes } = collecterBrief(fiche(), [], ALICE, MAINTENANT);
    const lu = texteAEcouter(lignes);
    assert.match(lu, /euros le mètre carré/);
    assert.doesNotMatch(lu, /€|·|«/);
  });
});

describe('brief de porte — rédaction', () => {
  const base = collecterBrief(fiche(), [NOTE_AGENCE], ALICE, MAINTENANT);

  it('garde une reformulation fidèle des notes, jamais des lignes de faits', () => {
    const brief = appliquerRedaction(
      base.lignes,
      base.notes,
      JSON.stringify({
        immeuble: 'Immeuble collectif de 1930, 24 logements, copropriété de 32 lots',
        notes: 'Le 12 sept., la gardienne annonce un T3 au 2e libre en novembre.',
        question: 'Au gardien : le T3 du 2e est-il déjà en vente ?',
      }),
    );
    assert.equal(brief.redige, true);
    assert.equal(brief.lignes[0]!.texte, base.lignes[0]!.texte);
    assert.match(brief.lignes[3]!.texte, /T3 au 2e/);
    assert.equal(brief.lignes[5]!.texte, 'Au gardien : le T3 du 2e est-il déjà en vente ?');
  });

  it('retire les phrases qui disent ce que les notes ne disent pas', () => {
    const brief = appliquerRedaction(
      base.lignes,
      base.notes,
      JSON.stringify({ notes: 'La gardienne annonce un T3 au 2e en novembre. Aucune autre information sur elle.' }),
    );
    assert.equal(brief.lignes[3]!.texte, 'La gardienne annonce un T3 au 2e en novembre.');
  });

  it('ne change pas à qui s’adresse la question', () => {
    const brief = appliquerRedaction(
      base.lignes,
      base.notes,
      JSON.stringify({ question: 'Au propriétaire : vendez-vous ?' }),
    );
    assert.equal(brief.lignes[5]!.texte, base.lignes[5]!.texte);
  });

  it('sans note visible, rien à rédiger', () => {
    assert.equal(briefARediger(collecterBrief(fiche(), [], ALICE, MAINTENANT).lignes), false);
    assert.equal(briefARediger(collecterBrief(fiche(), [NOTE_PRIVEE_BRUNO], ALICE, MAINTENANT).lignes), false);
    assert.equal(briefARediger(collecterBrief(fiche(), [NOTE_AGENCE], ALICE, MAINTENANT).lignes), true);
  });

  it('refuse un chiffre ou un nom absent de la fiche', () => {
    assert.equal(ligneRedigeeAcceptable('activite', 'Médiane 9 100 €/m² sur 3 ventes', texteComplet(base.lignes)), false);
    assert.equal(
      ligneRedigeeAcceptable('qui', 'Marie Dupont, gardienne, et Jean Moreau, voisin', texteComplet(base.lignes)),
      false,
    );
    assert.equal(ligneRedigeeAcceptable('qui', 'Marie Dupont, gardienne', texteComplet(base.lignes)), true);
  });

  it('refuse une ouverture qui trahit la source ou parle d’IA', () => {
    const sources = texteComplet(base.lignes);
    assert.equal(ligneRedigeeAcceptable('ouverture', 'D’après les données DVF, le m² est à 7 429 €.', sources), false);
    assert.equal(ligneRedigeeAcceptable('ouverture', 'Bonjour, notre IA a vu 3 ventes ici.', sources), false);
    assert.equal(ligneRedigeeAcceptable('ouverture', 'Bonjour, votre DPE expire bientôt ?', sources), false);
    assert.equal(
      ligneRedigeeAcceptable('ouverture', 'Bonjour, les appartements de l’immeuble se vendent autour de 7 429 € le m² : un projet ?', sources),
      true,
    );
  });

  it('une médiane reste « autour de », jamais un prix de vente', () => {
    const brief = appliquerRedaction(
      base.lignes,
      base.notes,
      JSON.stringify({ ouverture: 'Bonjour, les appartements ici se sont vendus à 7 429 € le m² : un projet ?' }),
    );
    assert.match(brief.lignes.find((l) => l.cle === 'ouverture')!.texte, /autour de 7.429 € le m²/);
  });

  it('une réponse illisible ou vide rend la fiche brute', () => {
    for (const brut of ['pas du json', '[]', '{}', JSON.stringify({ immeuble: 42 })]) {
      const brief = appliquerRedaction(base.lignes, base.notes, brut);
      assert.equal(brief.redige, false);
      assert.deepEqual(brief.lignes, base.lignes);
    }
  });

  it('ne réécrit jamais une ligne « donnée manquante »', () => {
    const vide = collecterBrief(FICHE_VIDE, [], ALICE, MAINTENANT);
    const brief = appliquerRedaction(vide.lignes, vide.notes, JSON.stringify({ qui: 'Le gardien' }));
    assert.equal(brief.lignes.find((l) => l.cle === 'qui')!.texte, 'Aucun nom connu ici');
    assert.doesNotMatch(promptBrief(vide.lignes, vide.notes), /- qui :/);
  });
});
