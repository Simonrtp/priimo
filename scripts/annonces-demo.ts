/**
 * Annonces fictives du 75020. id_portail préfixé demo-.
 * La purge du script principal les retire.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const LIGNES = [
  { id: 'demo-orfila-12', portail: 'pap', cle: 'demo-log-orfila-12', prix: 820000, initial: 850000, statut: 'active', confiance: 'certaine', precision: 'immeuble', adresse: '12 rue Orfila', numero: '12', voie: 'rue Orfila', quartier: 'Père-Lachaise', lat: 48.8642, lng: 2.3948, refus: true, pieces: 3, surface: 52, dpe: 'D', etage: '3' },
  { id: 'demo-orfila-12-lbc', portail: 'leboncoin', cle: 'demo-log-orfila-12', prix: 820000, initial: 850000, statut: 'active', confiance: 'probable', precision: 'immeuble', adresse: '12 rue Orfila', numero: '12', voie: 'rue Orfila', quartier: 'Père-Lachaise', lat: 48.8642, lng: 2.3948, refus: false, pieces: 3, surface: 52, dpe: 'D', etage: '3' },
  { id: 'demo-menil-8', portail: 'seloger', cle: 'demo-log-menil', prix: 640000, initial: 690000, statut: 'active', confiance: 'probable', precision: 'immeuble', adresse: '8 rue de Ménilmontant', numero: '8', voie: 'rue de Ménilmontant', quartier: 'Belleville', lat: 48.868, lng: 2.383, refus: true, pieces: 2, surface: 38, dpe: 'E', etage: '2' },
  { id: 'demo-pyrenees', portail: 'pap', cle: 'demo-log-pyrenees', prix: 915000, initial: 915000, statut: 'active', confiance: 'adresse_publiee', precision: 'logement', adresse: '24 rue des Pyrénées', numero: '24', voie: 'rue des Pyrénées', quartier: 'Jourdain', lat: 48.872, lng: 2.392, refus: false, pieces: 4, surface: 78, dpe: 'C', etage: '5' },
  { id: 'demo-gambetta', portail: 'bienici', cle: 'demo-log-gambetta', prix: 540000, initial: 575000, statut: 'active', confiance: 'incertaine', precision: 'quartier', adresse: null, numero: null, voie: null, quartier: 'Gambetta', lat: 48.864, lng: 2.398, refus: true, pieces: 2, surface: 34, dpe: 'F', etage: null },
  { id: 'demo-bagnolet', portail: 'pap', cle: 'demo-log-bagnolet', prix: 480000, initial: 480000, statut: 'retiree', confiance: 'certaine', precision: 'immeuble', adresse: '140 rue de Bagnolet', numero: '140', voie: 'rue de Bagnolet', quartier: 'Porte de Bagnolet', lat: 48.861, lng: 2.408, refus: true, pieces: 2, surface: 31, dpe: 'G', etage: '1' },
  { id: 'demo-avron', portail: 'leboncoin', cle: 'demo-log-avron', prix: 710000, initial: 710000, statut: 'active', confiance: 'probable', precision: 'code_postal', adresse: null, numero: null, voie: 'rue d’Avron', quartier: 'Avron', lat: 48.851, lng: 2.406, refus: false, pieces: 3, surface: 55, dpe: 'D', etage: '4' },
  { id: 'demo-telegraphe', portail: 'pap', cle: 'demo-log-telegraphe', prix: 399000, initial: 430000, statut: 'active', confiance: 'incertaine', precision: 'code_postal', adresse: null, numero: null, voie: null, quartier: 'Télégraphe', lat: 48.875, lng: 2.399, refus: true, pieces: 1, surface: 22, dpe: 'E', etage: '6' },
  { id: 'demo-pelleport', portail: 'logicimmo', cle: 'demo-log-pelleport', prix: 1020000, initial: 1100000, statut: 'active', confiance: 'certaine', precision: 'immeuble', adresse: '5 rue de Pelleport', numero: '5', voie: 'rue de Pelleport', quartier: 'Pelleport', lat: 48.870, lng: 2.401, refus: false, pieces: 5, surface: 92, dpe: 'C', etage: '2' },
  { id: 'demo-couronnes', portail: 'pap', cle: 'demo-log-couronnes', prix: 455000, initial: 455000, statut: 'active', confiance: 'probable', precision: 'immeuble', adresse: '18 rue des Couronnes', numero: '18', voie: 'rue des Couronnes', quartier: 'Couronnes', lat: 48.8685, lng: 2.3805, refus: true, pieces: 2, surface: 33, dpe: 'D', etage: '3' },
  { id: 'demo-buzenval', portail: 'seloger', cle: 'demo-log-buzenval', prix: 630000, initial: 650000, statut: 'active', confiance: 'adresse_publiee', precision: 'logement', adresse: '9 rue de Buzenval', numero: '9', voie: 'rue de Buzenval', quartier: 'Buzenval', lat: 48.852, lng: 2.401, refus: false, pieces: 3, surface: 48, dpe: 'B', etage: '1' },
  { id: 'demo-maraichers', portail: 'pap', cle: 'demo-log-maraichers', prix: 375000, initial: 375000, statut: 'active', confiance: 'incertaine', precision: 'quartier', adresse: null, numero: null, voie: null, quartier: 'Maraîchers', lat: 48.8515, lng: 2.405, refus: true, pieces: 1, surface: 18, dpe: 'E', etage: '7' },
  { id: 'demo-vincennes', portail: 'leboncoin', cle: 'demo-log-vincennes', prix: 890000, initial: 940000, statut: 'active', confiance: 'certaine', precision: 'immeuble', adresse: '42 cours de Vincennes', numero: '42', voie: 'cours de Vincennes', quartier: 'Nation', lat: 48.847, lng: 2.401, refus: false, pieces: 4, surface: 71, dpe: 'D', etage: '4' },
  { id: 'demo-republique', portail: 'bienici', cle: 'demo-log-republique', prix: 760000, initial: 760000, statut: 'active', confiance: 'probable', precision: 'immeuble', adresse: '3 rue de la République', numero: '3', voie: 'rue de la République', quartier: 'Charonne', lat: 48.855, lng: 2.395, refus: true, pieces: 3, surface: 58, dpe: 'C', etage: '2' },
  { id: 'demo-pixerecourt', portail: 'pap', cle: 'demo-log-pix', prix: 510000, initial: 545000, statut: 'active', confiance: 'certaine', precision: 'logement', adresse: '15 rue Pixérécourt', numero: '15', voie: 'rue Pixérécourt', quartier: 'Jourdain', lat: 48.873, lng: 2.39, refus: true, pieces: 2, surface: 36, dpe: 'F', etage: '0' },
] as const;

export async function purgeAnnoncesDemo(admin: SupabaseClient) {
  const db = admin as unknown as SupabaseClient;
  const { data, error } = await db.from('annonces').select('id').like('id_portail', 'demo-%');
  if (error) {
    console.warn('  annonces démo : table absente ou illisible', error.message);
    return;
  }
  const ids = (data ?? []).map((r: { id: string }) => r.id);
  if (ids.length) {
    const ev = await db.from('annonce_evenements').delete().in('annonce_id', ids);
    if (ev.error) console.warn('  événements démo :', ev.error.message);
  }
  const del = await db.from('annonces').delete().like('id_portail', 'demo-%');
  if (del.error) console.warn('  purge annonces :', del.error.message);
  else console.log(`  annonces démo : ${ids.length} supprimées`);
}

export async function seedAnnoncesDemo(admin: SupabaseClient) {
  const db = admin as unknown as SupabaseClient;
  await purgeAnnoncesDemo(admin);
  const maintenant = new Date().toISOString();
  const rows = LIGNES.map((l) => ({
    id_portail: l.id,
    portail: l.portail,
    url: `https://example.test/annonces/${l.id}`,
    type_vendeur: 'particulier',
    refus_demarchage: l.refus,
    statut: l.statut,
    publiee_le: maintenant,
    premiere_vue_le: maintenant,
    derniere_vue_le: maintenant,
    retiree_le: l.statut === 'retiree' ? maintenant : null,
    type_bien: 'appartement',
    prix_initial: l.initial,
    prix: l.prix,
    surface: l.surface,
    pieces: l.pieces,
    etage: l.etage,
    dpe: l.dpe,
    code_postal: '75020',
    ville: 'Paris',
    quartier: l.quartier,
    confiance: l.confiance,
    localisation_precision: l.precision,
    adresse: l.adresse,
    adresse_numero: l.numero,
    adresse_voie: l.voie,
    parcelle_ids: [] as string[],
    latitude: l.lat,
    longitude: l.lng,
    logement_cle: l.cle,
    raisons_localisation: l.confiance === 'incertaine' ? [] : ['+35 démo Priimo'],
  }));
  const { data, error } = await db.from('annonces').insert(rows).select('id, id_portail, prix, prix_initial, statut');
  if (error) {
    console.warn('  annonces démo non insérées :', error.message);
    return;
  }
  const inserees = (data ?? []) as {
    id: string;
    id_portail: string;
    prix: number;
    prix_initial: number;
    statut: string;
  }[];
  const evenements = inserees.flatMap((a) => {
    const base = {
      annonce_id: a.id,
      survenu_le: maintenant,
      created_at: maintenant,
    };
    const lignes = [
      {
        ...base,
        type: 'nouvelle',
        avant: null,
        apres: { prix: a.prix_initial },
      },
    ];
    if (a.prix < a.prix_initial) {
      lignes.push({
        ...base,
        type: 'baisse_prix',
        avant: { prix: a.prix_initial },
        apres: { prix: a.prix },
      });
    }
    if (a.statut === 'retiree') {
      lignes.push({ ...base, type: 'retiree', avant: null, apres: null });
    }
    return lignes;
  });
  if (evenements.length) {
    const ev = await db.from('annonce_evenements').insert(evenements);
    if (ev.error) console.warn('  événements démo :', ev.error.message);
  }
  console.log(`  annonces démo : ${inserees.length} insérées`);
}
