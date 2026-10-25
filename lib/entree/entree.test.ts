import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CLE_CONNEXION, CLE_JOUR, connexionRecente, deciderEntree, jourParis, nouveautesDepuis, SCRIPT_ENTREE } from './entree';

describe('entrée dans l’outil', () => {
  it('grande entrée à la connexion et à la première ouverture du jour, jamais deux fois le même jour', () => {
    const jour = '2026-10-24';
    assert.equal(deciderEntree({ connexion: true, dernierJour: jour, aujourdhui: jour, mouvementReduit: false }), 'grande');
    assert.equal(deciderEntree({ connexion: false, dernierJour: '2026-10-23', aujourdhui: jour, mouvementReduit: false }), 'grande');
    assert.equal(deciderEntree({ connexion: false, dernierJour: null, aujourdhui: jour, mouvementReduit: false }), 'grande');
    assert.equal(deciderEntree({ connexion: false, dernierJour: jour, aujourdhui: jour, mouvementReduit: false }), null);
  });

  it('rien si l’appareil demande moins d’animations, même à la connexion', () => {
    assert.equal(deciderEntree({ connexion: true, dernierJour: null, aujourdhui: '2026-10-24', mouvementReduit: true }), null);
  });

  it('une connexion ne se prolonge que dans la minute qui suit l’envoi', () => {
    const t = 1_800_000_000_000;
    assert.equal(connexionRecente(String(t), t + 4_000), true);
    assert.equal(connexionRecente(String(t), t + 61_000), false);
    assert.equal(connexionRecente(String(t), t - 1_000), false);
    assert.equal(connexionRecente(null, t), false);
    assert.equal(connexionRecente('1', t), false);
    assert.equal(connexionRecente('abc', t), false);
  });

  it('le jour se lit à l’heure de Paris', () => {
    // 23 h 30 UTC le 23 : déjà le 24 à Paris (heure d’été).
    assert.equal(jourParis(new Date('2026-10-23T23:30:00Z')), '2026-10-24');
  });

  it('compte les adresses arrivées depuis la dernière visite, aucune la première fois', () => {
    assert.equal(nouveautesDepuis(null, ['a', 'b']), 0);
    assert.equal(nouveautesDepuis(['a'], ['a', 'b', 'c']), 2);
    assert.equal(nouveautesDepuis(['a', 'b'], ['b']), 0);
  });

  it('le script d’ouverture est du JavaScript valide, protégé par try/catch', () => {
    assert.doesNotThrow(() => new Function(SCRIPT_ENTREE));
    assert.match(SCRIPT_ENTREE, /try\{/);
    assert.match(SCRIPT_ENTREE, /prefers-reduced-motion/);
  });

  it('le script d’ouverture pose le marqueur dans les mêmes cas que deciderEntree', () => {
    const jouer = (o: { connexion: string | null; jour: string | null; reduit?: boolean }) => {
      const attributs: Record<string, string> = {};
      const racine = { setAttribute: (k: string, v: string) => (attributs[k] = v) };
      const stock = (v: Record<string, string | null>) => ({ getItem: (k: string) => v[k] ?? null });
      new Function('document', 'window', 'sessionStorage', 'localStorage', SCRIPT_ENTREE)(
        { currentScript: { parentElement: racine } },
        { matchMedia: () => ({ matches: o.reduit === true }) },
        stock({ [CLE_CONNEXION]: o.connexion }),
        stock({ [CLE_JOUR]: o.jour }),
      );
      return attributs['data-entree'] ?? null;
    };
    const aujourdhui = jourParis();
    assert.equal(jouer({ connexion: String(Date.now() - 3_000), jour: aujourdhui }), 'grande');
    assert.equal(jouer({ connexion: String(Date.now() - 120_000), jour: aujourdhui }), null);
    assert.equal(jouer({ connexion: null, jour: '2020-01-01' }), 'grande');
    assert.equal(jouer({ connexion: null, jour: aujourdhui }), null);
    assert.equal(jouer({ connexion: String(Date.now()), jour: null, reduit: true }), null);
  });
});
