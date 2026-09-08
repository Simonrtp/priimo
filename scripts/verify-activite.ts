/**
 * Vérifie à la main les compteurs d'activité d'une semaine.
 *
 *   npx tsx scripts/verify-activite.ts                      → agence unique, semaine en cours
 *   npx tsx scripts/verify-activite.ts --agence "Nom"       → une agence précise
 *   npx tsx scripts/verify-activite.ts --semaine 2026-09-02 → la semaine contenant ce jour
 *
 * Le script lit avec la clé service_role, qui contourne la RLS : il passe donc
 * agencyId explicitement à fetchJournalActivite. Dans l'application, ce
 * paramètre reste indéfini et current_user_agency_id() fait le tri.
 *
 * Il affiche les compteurs ET les pièces qui les fabriquent, pour qu'on puisse
 * recompter soi-même. Un compteur qu'on ne peut pas recompter ne vaut rien.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { bilanSemaine, valeursDe } from '../lib/activite/bilan';
import { phrasePilotage } from '../lib/activite/phrase';
import { compteursSemaine } from '../lib/activite/derive';
import { FENETRE_SEMAINES, LIBELLE_NIVEAU } from '../lib/activite/ratios';
import { fenetreSemaines, semaineDe } from '../lib/activite/semaines';
import { dateKeyParis } from '../lib/today/calendar';
import { ACTIVITES, LIBELLE_ACTIVITE, SOURCE_PAR_ACTIVITE } from '../lib/activite/types';
import { fetchJournalActivite, fetchObjectifs, fetchReferenceMetier } from '../lib/queries/activite';
import { mapLeadStage } from '../lib/queries/lead-stages';
import type { Database, LeadStageRow } from '../types/database';

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    if (!process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1);
  }
}

function arg(nom: string): string | null {
  const i = process.argv.indexOf(`--${nom}`);
  return i !== -1 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  loadEnvLocal();
  const sb = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: agences, error: agErr } = await sb.from('agencies').select('id, name').order('name');
  if (agErr || !agences?.length) {
    console.error('Aucune agence lisible :', agErr?.message ?? 'liste vide');
    process.exit(1);
  }

  const filtre = arg('agence');
  const agence = filtre
    ? agences.find((a) => a.name.toLowerCase().includes(filtre.toLowerCase()))
    : agences[0];
  if (!agence) {
    console.error(`Aucune agence ne correspond à « ${filtre} ». Disponibles :`);
    for (const a of agences) console.error(`  - ${a.name}`);
    process.exit(1);
  }

  // Par défaut les lignes de démonstration sont écartées : c'est ce mode qui
  // doit redonner exactement le recomptage manuel de l'agence de test.
  const avecDemo = process.argv.includes('--avec-demo');
  const jour = arg('semaine');
  const semaine = semaineDe(jour ? new Date(`${jour}T12:00:00Z`) : new Date());
  const fenetre = fenetreSemaines(semaine, FENETRE_SEMAINES);

  console.log(`\nAgence  : ${agence.name}`);
  console.log(`Semaine : ${semaine.debut} → ${semaine.fin}`);
  console.log(`Fenêtre ratios : ${fenetre.debut} → ${fenetre.fin} (${FENETRE_SEMAINES} semaines)\n`);

  const { data: stagesRows, error: stErr } = await sb
    .from('lead_stages')
    .select('id, agency_id, cle, libelle, ordre, accent_color, type, created_at')
    .eq('agency_id', agence.id)
    .order('ordre');
  if (stErr) {
    console.error('lead_stages illisible :', stErr.message);
    process.exit(1);
  }
  const stages = (stagesRows ?? []).map((r) => mapLeadStage(r as LeadStageRow));
  console.log(`Étapes : ${stages.map((s) => s.cle).join(' → ')}`);
  if (!stages.some((s) => s.cle === 'estimation')) {
    console.log(
      '  ⚠  L’étape « estimation » manque. Appliquer supabase/migrations/20260909_activite_terrain.sql,\n' +
        '     sinon le compteur Estimations restera à zéro par construction.',
    );
  }

  const { data: membres, error: mbErr } = await sb
    .from('profile_agencies')
    .select('profile_id, role, profiles(first_name, last_name)')
    .eq('agency_id', agence.id);
  if (mbErr) {
    console.error('profile_agencies illisible :', mbErr.message);
    process.exit(1);
  }
  const equipe = (membres ?? []) as unknown as {
    profile_id: string;
    role: string;
    profiles: { first_name: string; last_name: string } | null;
  }[];
  const profileIds = equipe.map((m) => m.profile_id);

  const journal = await fetchJournalActivite({
    supabase: sb,
    intervalle: fenetre,
    stages,
    agencyId: agence.id,
    inclureDemo: avecDemo,
  });
  const { reference, fournie } = await fetchReferenceMetier({ supabase: sb, agencyId: agence.id });

  console.log(
    `\nJournal chargé : ${journal.transitions.length} transitions · ` +
      `${journal.notes.length} notes · ${journal.contactsPhysiques.length} contacts déclarés`,
  );
  console.log(
    `Référence métier : ${fournie ? 'fournie par le réseau' : 'PROVISOIRE (chiffres Swixim attendus)'}\n`,
  );

  for (const membre of equipe) {
    const nom = membre.profiles
      ? `${membre.profiles.first_name} ${membre.profiles.last_name}`
      : membre.profile_id;
    const objectifs = await fetchObjectifs({ supabase: sb, profileId: membre.profile_id });
    const b = bilanSemaine({
      journal,
      profileId: membre.profile_id,
      profileIdsAgence: profileIds,
      semaine,
      objectifs,
      reference,
      referenceFournie: fournie,
    });

    console.log('─'.repeat(72));
    console.log(`${nom}  (${membre.role})`);
    console.log(
      `  Progression semaine : ${b.progressionHebdo} %` +
        `${b.semaine1 ? '   [état SEMAINE 1 : aucun historique]' : ''}` +
        `${b.objectifsParDefaut ? '   [objectifs par défaut]' : ''}`,
    );

    for (const activite of ACTIVITES) {
      const c = b.compteurs.find((x) => x.activite === activite)!;
      const ecart =
        c.ecartSemainePrecedente === null
          ? '   —'
          : `${c.ecartSemainePrecedente >= 0 ? '+' : ''}${c.ecartSemainePrecedente}`;
      console.log(
        `    ${LIBELLE_ACTIVITE[activite].padEnd(22)} ` +
          `${String(c.valeur).padStart(4)} / ${String(c.objectif).padEnd(4)} ` +
          `${ecart.padStart(5)}   [${SOURCE_PAR_ACTIVITE[activite]}]`,
      );
    }

    console.log(
      `    Mandats du mois        ${String(b.mandatsDuMois.valeur).padStart(4)} / ` +
        `${b.mandatsDuMois.objectif}   (${b.mandatsDuMois.mois.debut} → ${b.mandatsDuMois.mois.fin})`,
    );
    console.log(
      `  Ratios — ${LIBELLE_NIVEAU[b.ratios.niveau]}` +
        `${b.ratios.provisoire ? ' [PROVISOIRE]' : ''} · ${b.ratios.mandatsRetenus} mandat(s) retenus`,
    );
    console.log(
      `    physiques → qualifié : ${b.ratios.physiquesParQualifie ?? '—'} · ` +
        `qualifiés → estimation : ${b.ratios.qualifiesParEstimation ?? '—'} · ` +
        `estimations → mandat : ${b.ratios.estimationsParMandat ?? '—'}`,
    );

    // La phrase du haut et l'entonnoir du bas, côte à côte : c'est leur
    // cohérence qu'on vérifie ici, pas seulement leur existence.
    const phrase = phrasePilotage({
      compteurs: valeursDe(b),
      objectifMandatsMois: b.mandatsDuMois.objectif,
      ratios: b.ratios,
      periode: 'semaine',
      intervalle: b.intervalle,
      semaine1: b.semaine1,
      etatsSource: b.etatsSource,
      jourCourant: dateKeyParis(new Date()),
    });
    console.log(`  Phrase — « ${phrase.texte} »`);
    console.log(`    ton=${phrase.ton} levier=${phrase.levier ?? '—'} manque=${phrase.manque}`);
    console.log(
      `  Entonnoir cohorte (${b.fenetreRatios.debut} -> ${b.fenetreRatios.fin}) : ` +
        b.entonnoir
          .map(
            (e) =>
              `${e.libelle} ${e.valeur}` +
              (e.conversion === null ? '' : ` (${e.conversion} %)`),
          )
          .join('  →  '),
    );
    console.log(
      '  États de source     : ' +
        b.compteurs.map((c) => `${c.activite}=${c.etatSource}`).join(' · '),
    );

    // Les pièces justificatives : de quoi recompter à la main.
    const brut = compteursSemaine({ journal, profileId: membre.profile_id, semaine });
    if (ACTIVITES.some((a) => brut[a] > 0)) {
      const transitions = journal.transitions.filter(
        (t) => t.profileId === membre.profile_id && t.versCle,
      );
      const parEtape = new Map<string, number>();
      for (const t of transitions) {
        parEtape.set(t.versCle!, (parEtape.get(t.versCle!) ?? 0) + 1);
      }
      console.log(
        `  Sur ${FENETRE_SEMAINES} semaines : ` +
          [...parEtape.entries()].map(([cle, n]) => `${cle} ×${n}`).join(' · '),
      );
    }
  }
  console.log('─'.repeat(72));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
