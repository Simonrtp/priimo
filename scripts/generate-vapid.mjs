/**
 * Genere une paire de cles VAPID pour les notifications Web Push.
 *
 *   node scripts/generate-vapid.mjs
 *
 * A faire UNE FOIS. Changer de cles invalide tous les abonnements existants :
 * chaque agent devrait reactiver les notifications sur chaque appareil.
 */

import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('\nA coller dans .env.local (et dans les variables Vercel) :\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:hello@priimo.fr\n');
console.log('La cle privee ne doit jamais etre commitee ni exposee au client.\n');
