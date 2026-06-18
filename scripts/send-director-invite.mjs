#!/usr/bin/env node
/**
 * Envoie l'email d'invitation directeur (même design que collaborateur).
 *
 * Usage — invitation déjà en base (après INSERT SQL) :
 *   node scripts/send-director-invite.mjs --token priimo-century-a7f3
 *
 * Usage — création + envoi :
 *   node scripts/send-director-invite.mjs --email directeur@agence.fr --agency "Century 21"
 *
 * Variables : INVITATION_ADMIN_SECRET, NEXT_PUBLIC_SITE_URL (défaut http://localhost:3000)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i === -1) continue;
      const key = line.slice(0, i);
      const val = line.slice(i + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--token') out.token = argv[++i];
    else if (a === '--email') out.email = argv[++i];
    else if (a === '--agency') out.agency = argv[++i];
  }
  return out;
}

loadEnvLocal();

const { token, email, agency } = parseArgs(process.argv.slice(2));
const secret = process.env.INVITATION_ADMIN_SECRET?.trim();
const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

if (!secret) {
  console.error('INVITATION_ADMIN_SECRET manquant dans .env.local');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${secret}`,
};

let url;
let body;

if (token) {
  url = `${baseUrl}/api/invitations/directeur/send`;
  body = JSON.stringify({ token });
} else if (email && agency) {
  url = `${baseUrl}/api/invitations/directeur`;
  body = JSON.stringify({ email, agencyName: agency });
} else {
  console.error('Usage: --token <token>  OU  --email <email> --agency <nom>');
  process.exit(1);
}

const res = await fetch(url, { method: 'POST', headers, body });
const data = await res.json();

if (!res.ok) {
  console.error('Erreur:', data.error ?? res.statusText);
  process.exit(1);
}

console.log('Email envoyé à', data.email);
console.log('Lien:', data.inviteUrl);
