import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { ecrireNotification, notificationDejaEmise } from '@/lib/notifications/ecrire';
import { lienNotification } from '@/lib/notifications/liens';
import type { Zone } from '@/lib/zones/types';
import { zoneDeLAnnonce } from './secteur';
import { baisseAvantSuivi } from './presenter';
import { LIEN_ANNONCES_NOUVELLES, titreNouvelles } from './phrase';
import type { Annonce, EvenementAnnonce } from './types';

type Admin = SupabaseClient<Database>;

export const TYPES_NOTIF_ANNONCES = ['annonce_baisse_prix', 'annonce_retiree', 'annonces_nouvelles'] as const;

export function jourParis(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(date);
}

export type DestinataireAnnonce = { agencyId: string; profileId: string };

/** Titulaire de la zone, sinon les directeurs de cette agence. */
export function destinatairesAnnonce(
  annonce: Annonce,
  agencyId: string,
  zones: readonly Zone[],
  directeurs: readonly string[],
): DestinataireAnnonce[] {
  const zone = zoneDeLAnnonce(annonce, zones);
  if (zone?.assignedTo) return [{ agencyId, profileId: zone.assignedTo }];
  return directeurs.map((profileId) => ({ agencyId, profileId }));
}

export function evenementsATraiter(
  evenements: readonly EvenementAnnonce[],
  curseurIso: string | null,
): EvenementAnnonce[] {
  if (!curseurIso) return [...evenements];
  return evenements.filter((e) => e.createdAt > curseurIso);
}

export type AgenceCouvrante = {
  agencyId: string;
  codesPostaux: readonly string[];
  zones: Zone[];
  directeurs: string[];
};

function agenceConcernee(annonce: Annonce, agence: AgenceCouvrante): boolean {
  if (!annonce.codePostal) return false;
  return agence.codesPostaux.includes(annonce.codePostal);
}

export async function notifierAnnonces(
  admin: Admin,
  input: {
    maintenant?: Date;
    curseurIso: string | null;
    annonces: Annonce[];
    evenements: EvenementAnnonce[];
    agences: AgenceCouvrante[];
  },
): Promise<{ ecrites: number }> {
  const jour = jourParis(input.maintenant ?? new Date());
  const frais = evenementsATraiter(input.evenements, input.curseurIso);
  const parId = new Map(input.annonces.map((a) => [a.id, a]));
  let ecrites = 0;
  const nouvellesParDest = new Map<string, { dest: DestinataireAnnonce; n: number }>();

  for (const evt of frais) {
    const annonce = parId.get(evt.annonceId);
    if (!annonce) continue;
    for (const agence of input.agences) {
      if (!agenceConcernee(annonce, agence)) continue;
      const dests = destinatairesAnnonce(annonce, agence.agencyId, agence.zones, agence.directeurs);
      if (evt.type === 'nouvelle') {
        if (annonce.typeVendeur !== 'particulier') continue;
        for (const dest of dests) {
          const key = `${dest.agencyId}:${dest.profileId}`;
          const cur = nouvellesParDest.get(key) ?? { dest, n: 0 };
          cur.n += 1;
          nouvellesParDest.set(key, cur);
        }
        continue;
      }
      if (evt.type === 'baisse_prix' && baisseAvantSuivi(evt, annonce.premiereVueLe)) continue;
      if (evt.type !== 'baisse_prix' && evt.type !== 'retiree') continue;
      const type = evt.type === 'baisse_prix' ? 'annonce_baisse_prix' : 'annonce_retiree';
      const groupeCle = `annonce-evt:${evt.id}`;
      for (const dest of dests) {
        const deja = await notificationDejaEmise(admin, {
          agencyId: dest.agencyId,
          profileId: dest.profileId,
          groupeCle,
          depuisIso: '1970-01-01T00:00:00.000Z',
        });
        if (deja) continue;
        const ok = await ecrireNotification(admin, {
          agencyId: dest.agencyId,
          profileId: dest.profileId,
          type,
          titre: evt.type === 'baisse_prix' ? 'Prix en baisse dans mon secteur' : 'Annonce retirée dans mon secteur',
          corps: annonce.adresse ?? annonce.quartier ?? annonce.ville ?? 'Une annonce du secteur',
          lien: lienNotification(type, annonce.id),
          entiteType: 'annonce',
          entiteId: annonce.id,
          groupeCle,
        });
        if (ok) ecrites += 1;
      }
    }
  }

  for (const { dest, n } of nouvellesParDest.values()) {
    if (n <= 0) continue;
    const groupeCle = `annonces-nouvelles:${jour}:${dest.profileId}`;
    const deja = await notificationDejaEmise(admin, {
      agencyId: dest.agencyId,
      profileId: dest.profileId,
      groupeCle,
      depuisIso: '1970-01-01T00:00:00.000Z',
    });
    if (deja) continue;
    const ok = await ecrireNotification(admin, {
      agencyId: dest.agencyId,
      profileId: dest.profileId,
      type: 'annonces_nouvelles',
      titre: titreNouvelles(n),
      corps: 'Parues depuis le dernier passage.',
      lien: LIEN_ANNONCES_NOUVELLES,
      groupeCle,
    });
    if (ok) ecrites += 1;
  }

  return { ecrites };
}
