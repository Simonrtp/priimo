import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  frameAncestorsValue,
  hostFromOrigin,
  isDomainAllowed,
  normalizeDomain,
  normalizeDomainList,
} from './domains';

describe('normalizeDomain', () => {
  it('retire le schéma, le www, le port et le chemin', () => {
    assert.equal(normalizeDomain('https://www.Agence.fr:3000/estimation?a=1'), 'agence.fr');
  });

  it('accepte localhost et une IPv4', () => {
    assert.equal(normalizeDomain('http://localhost:3000'), 'localhost');
    assert.equal(normalizeDomain('192.168.1.10'), '192.168.1.10');
  });

  it('refuse ce qui n’est pas un domaine', () => {
    assert.equal(normalizeDomain(''), null);
    assert.equal(normalizeDomain('   '), null);
    assert.equal(normalizeDomain('agence'), null);
    assert.equal(normalizeDomain('-mauvais-.fr'), null);
  });
});

describe('normalizeDomainList', () => {
  it('dédoublonne et trie', () => {
    assert.deepEqual(
      normalizeDomainList(['https://www.b.fr', 'A.FR', 'a.fr/', 'pas un domaine']),
      ['a.fr', 'b.fr'],
    );
  });
});

describe('hostFromOrigin', () => {
  it('lit un Origin comme un Referer', () => {
    assert.equal(hostFromOrigin('https://www.agence.fr'), 'agence.fr');
    assert.equal(hostFromOrigin('https://immo.agence.fr/estimer'), 'immo.agence.fr');
  });

  it('ne tire rien d’une origine opaque', () => {
    assert.equal(hostFromOrigin('null'), null);
    assert.equal(hostFromOrigin(null), null);
  });
});

describe('isDomainAllowed', () => {
  const liste = ['agence.fr'];

  it('autorise le domaine et ses sous-domaines', () => {
    assert.equal(isDomainAllowed('agence.fr', liste), true);
    assert.equal(isDomainAllowed('www.agence.fr', liste), true);
    assert.equal(isDomainAllowed('immo.agence.fr', liste), true);
  });

  it('refuse un domaine qui ne fait qu’imiter le suffixe', () => {
    assert.equal(isDomainAllowed('agence.fr.pirate.com', liste), false);
    assert.equal(isDomainAllowed('monagence.fr', liste), false);
  });

  it('refuse tout quand la liste est vide', () => {
    assert.equal(isDomainAllowed('agence.fr', []), false);
    assert.equal(isDomainAllowed(null, liste), false);
  });
});

describe('frameAncestorsValue', () => {
  it('n’autorise personne sans liste blanche', () => {
    assert.equal(frameAncestorsValue([]), "'none'");
  });

  it('couvre le domaine et ses sous-domaines en https', () => {
    assert.equal(
      frameAncestorsValue(['agence.fr']),
      'https://agence.fr https://*.agence.fr',
    );
  });

  it('laisse le développement local en http', () => {
    assert.equal(
      frameAncestorsValue(['localhost']),
      'http://localhost:* https://localhost:*',
    );
  });
});
