/**
 * Préchargement pour lancer hors de Next.js un script qui importe du code serveur :
 *   npx tsx --require ./scripts/hors-next.cjs --env-file=.env.local scripts/….ts
 *
 * - « server-only » est fourni par Next.js à la compilation : ici, un module vide ;
 * - React (canal stable) n'expose `cache` qu'aux composants serveur : ici, l'identité.
 */
const Module = require('module');
const path = require('path');

const vide = path.join(__dirname, 'hors-next-vide.cjs');
const resoudre = Module._resolveFilename;
Module._resolveFilename = function (requete, ...reste) {
  if (requete === 'server-only') return vide;
  return resoudre.call(this, requete, ...reste);
};

const React = require(require.resolve('react', { paths: [process.cwd()] }));
if (typeof React.cache !== 'function') React.cache = (fn) => fn;
