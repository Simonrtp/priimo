/**
 * Conversion unique des secteurs dessinés (contours, rues) en parcelles.
 *
 *   npx tsx --require ./scripts/hors-next.cjs --env-file=.env.local scripts/convertir-secteurs-parcelles.ts [--ecrire]
 *
 * Sans `--ecrire` : essai à blanc, secteur par secteur. Avec : sauvegarde des
 * règles dans Documents/priimo-sauvegardes, écriture des parcelles, enveloppe,
 * couleurs des titulaires, puis retrait des contours et des rues convertis.
 *
 * Une parcelle revendiquée par deux secteurs va à la règle la plus précise
 * (rue avant contour), puis au premier secteur par ordre de nom — la règle
 * d'appartenance d'avant la conversion.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { fetchZonesPourAgence } from '@/lib/queries/zones';
import { numerosDeLaVoie } from '@/lib/geo/ban-voie';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { pointDansPolygone } from '@/lib/zones/appartenance';
import { bbox } from '@/lib/zones/geometrie';
import { parcellesDansEmprise, ecrireParcelles } from '@/lib/zones/parcelles-serveur';
import { assurerCouleursMembres } from '@/lib/zones/couleurs-membres-serveur';
import { SPECIFICITE_REGLE, type RegleZone, type Zone } from '@/lib/zones/types';

type Revendication = { zone: Zone; specificite: number; rang: number };

async function parcellesDeLaRegle(admin: SupabaseClient, regle: RegleZone): Promise<string[]> {
  if (regle.type === 'polygone') {
    const boite = bbox(regle.valeur);
    if (!boite) return [];
    const candidates = await parcellesDansEmprise(admin, boite, 20000);
    return candidates.filter((p) => pointDansPolygone(p, regle.valeur)).map((p) => p.id);
  }
  if (regle.type === 'voie') {
    const v = regle.valeur;
    const numeros = await numerosDeLaVoie({ nom: v.nom_voie, codePostal: v.code_postal });
    const ids = new Set<string>();
    for (const n of numeros) {
      if (v.parite === 'paires' && n.numero % 2 !== 0) continue;
      if (v.parite === 'impaires' && n.numero % 2 === 0) continue;
      if (v.numero_min != null && n.numero < v.numero_min) continue;
      if (v.numero_max != null && n.numero > v.numero_max) continue;
      for (const p of n.parcelles) {
        const id = normalizeParcelleId(p);
        if (id) ids.add(id);
      }
    }
    return [...ids];
  }
  return [];
}

async function main() {
  const ecrire = process.argv.includes('--ecrire');
  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { data: agences, error } = await admin.from('agencies').select('id, name');
  if (error) throw new Error(error.message);

  const sauvegarde: unknown[] = [];
  const dossier = join(homedir(), 'Documents', 'priimo-sauvegardes', '2026-10-26-secteurs-avant-parcelles');
  for (const agence of (agences ?? []) as { id: string; name: string }[]) {
    const zones = await fetchZonesPourAgence(admin as never, agence.id);
    const aConvertir = zones.filter((z) => z.regles.some((r) => r.inclusion && (r.type === 'polygone' || r.type === 'voie')));
    if (aConvertir.length === 0) continue;
    console.log(`\n== ${agence.name} : ${aConvertir.length} secteur(s) à convertir`);

    // Qui revendique chaque parcelle, et avec quelle précision.
    const revendications = new Map<string, Revendication[]>();
    const exclues = new Map<string, Set<string>>();
    for (const [rang, zone] of zones.entries()) {
      for (const regle of zone.regles) {
        if (regle.type !== 'polygone' && regle.type !== 'voie') continue;
        const ids = await parcellesDeLaRegle(admin, regle);
        if (!regle.inclusion) {
          const set = exclues.get(zone.id) ?? new Set<string>();
          for (const id of ids) set.add(id);
          exclues.set(zone.id, set);
          continue;
        }
        for (const id of ids) {
          const liste = revendications.get(id) ?? [];
          liste.push({ zone, specificite: SPECIFICITE_REGLE[regle.type], rang });
          revendications.set(id, liste);
        }
      }
    }

    const parZone = new Map<string, string[]>();
    let conflits = 0;
    for (const [id, liste] of revendications) {
      const valables = liste.filter((r) => !exclues.get(r.zone.id)?.has(id) && r.zone.actif);
      if (valables.length === 0) continue;
      const zonesDistinctes = new Set(valables.map((r) => r.zone.id));
      if (zonesDistinctes.size > 1) conflits += 1;
      valables.sort((a, b) => b.specificite - a.specificite || a.rang - b.rang);
      const gagnant = valables[0]!.zone.id;
      const ids = parZone.get(gagnant) ?? [];
      ids.push(id);
      parZone.set(gagnant, ids);
    }

    for (const zone of aConvertir) {
      const regles = zone.regles.filter((r) => r.type === 'polygone' || r.type === 'voie');
      console.log(
        `  ${zone.nom} (${zone.actif ? 'actif' : 'éteint'}) : ${regles.map((r) => r.type).join(', ')} → ${
          parZone.get(zone.id)?.length ?? 0
        } parcelles`,
      );
    }
    console.log(`  parcelles revendiquées par plusieurs secteurs : ${conflits}`);

    if (!ecrire) continue;
    // Sauvegardé avant la moindre écriture : les règles retirées doivent pouvoir revenir.
    sauvegarde.push({ agence, zones: aConvertir.map((z) => ({ id: z.id, nom: z.nom, regles: z.regles })) });
    mkdirSync(dossier, { recursive: true });
    writeFileSync(join(dossier, 'regles.json'), JSON.stringify(sauvegarde, null, 2));
    const titulaires = [...new Set(zones.map((z) => z.assignedTo).filter((id): id is string => !!id))];
    await assurerCouleursMembres(admin, agence.id, titulaires);
    for (const zone of aConvertir) {
      const ids = parZone.get(zone.id) ?? [];
      const r = await ecrireParcelles(admin, { zoneId: zone.id, agencyId: agence.id, ajouter: ids, retirer: [] });
      if (r.refusees.length > 0) console.log(`  ${zone.nom} : ${r.refusees.length} refusée(s)`);
      const anciennes = zone.regles.filter((x) => x.type === 'polygone' || x.type === 'voie').map((x) => x.id);
      if (anciennes.length > 0) {
        const { error: e } = await admin.from('zone_regles').delete().in('id', anciennes);
        if (e) throw new Error(`${zone.nom} : ${e.message}`);
      }
      console.log(`  ${zone.nom} : ${r.ajoutees.length} parcelles écrites, ${anciennes.length} règle(s) retirée(s)`);
    }
  }

  if (ecrire) {
    console.log(`\nSauvegarde : ${dossier}`);
  } else {
    console.log('\nEssai à blanc : rien n’a été écrit. Ajouter --ecrire pour convertir.');
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
