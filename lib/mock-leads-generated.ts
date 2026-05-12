import type {
  Agent,
  Lead,
  LeadStatus,
  LeadZoneId,
  LegalForm,
  LifeEvent,
  SignalType,
} from '@/types/lead';

export const MOCK_ZONES: { id: LeadZoneId; label: string }[] = [
  { id: 'paris-13', label: 'Paris 13e' },
  { id: 'paris-14', label: 'Paris 14e' },
  { id: 'paris-15', label: 'Paris 15e' },
];

export const mockAgents: Agent[] = [
  { id: 'agent-1', firstName: 'Marie', lastName: 'Dupont', initials: 'MD', name: 'Marie Dupont' },
  { id: 'agent-2', firstName: 'Thomas', lastName: 'Bernard', initials: 'TB', name: 'Thomas Bernard' },
  { id: 'agent-3', firstName: 'Léa', lastName: 'Martin', initials: 'LM', name: 'Léa Martin' },
  { id: 'agent-4', firstName: 'Julien', lastName: 'Petit', initials: 'JP', name: 'Julien Petit' },
];

const Z: LeadZoneId[] = ['paris-13', 'paris-14', 'paris-15'];

const BASE: Record<LeadZoneId, { lat: number; lng: number; streets: string[] }> = {
  'paris-13': {
    lat: 48.8322,
    lng: 2.3561,
    streets: [
      '12 rue des Acacias',
      '23 rue de Tolbiac',
      '34 rue de la Glacière',
      '5 rue des Cinq-Diamants',
      '18 rue Broca',
      '45 avenue d\'Italie',
      '8 rue Bobillot',
      '71 boulevard de l\'Hôpital',
      '16 avenue de Choisy',
      '44 avenue d\'Ivry',
      '3 rue Jeanne d\'Arc',
      '27 rue de la Butte-aux-Cailles',
    ],
  },
  'paris-14': {
    lat: 48.8331,
    lng: 2.3264,
    streets: [
      '14 rue Raymond Losserand',
      '62 avenue du Général Leclerc',
      '9 rue Delambre',
      '30 rue Daguerre',
      '5 place Ferdinand-Brunot',
      '22 rue d\'Alésia',
      '11 rue Hallé',
      '40 rue du Cherche-Midi',
    ],
  },
  'paris-15': {
    lat: 48.8422,
    lng: 2.2995,
    streets: [
      '10 rue de la Convention',
      '55 rue de Lourmel',
      '28 rue Olivier de Serres',
      '7 rue du Commerce',
      '102 rue de la Croix-Nivert',
      '15 rue Mademoiselle',
      '33 rue de Vouillé',
      '48 rue des Entrepreneurs',
    ],
  },
};

const ENT_NAMES: { form: LegalForm; company: string; line: string; rcs: string }[] = [
  { form: 'sci', company: 'SCI Les Cèdres', line: 'SCI LES CÈDRES · M. MARTIN', rcs: 'RCS Paris 519 223 441' },
  { form: 'sci', company: 'SCI Berbey Patrimoine', line: 'SCI BERBEY PATRIMOINE · Mme BERBEY', rcs: 'RCS Paris 834 112 902' },
  { form: 'sarl', company: 'SARL Immobilière du Centre', line: 'SARL IMMOBILIÈRE DU CENTRE · M. ROUSSEAU', rcs: 'RCS Paris 501 992 118' },
  { form: 'sci', company: 'SCI Montsouris View', line: 'SCI MONTSOURIS VIEW · M. & Mme LACROIX', rcs: 'RCS Paris 812 003 667' },
  { form: 'sarl', company: 'SARL Capitole Patrimoine', line: 'SARL CAPITOLE PATRIMOINE · Mme FONTAINE', rcs: 'RCS Paris 990 221 445' },
  { form: 'sci', company: 'SCI Rivoli Invest', line: 'SCI RIVOLI INVEST · M. NGUYEN', rcs: 'RCS Paris 448 901 223' },
  { form: 'sarl', company: 'SARL Seine Patrimoine', line: 'SARL SEINE PATRIMOINE · M. BERNARD', rcs: 'RCS Paris 223 771 009' },
  { form: 'sci', company: 'SCI Butte-aux-Cailles', line: 'SCI BUTTE-AUX-CAILLES · Mme DURAND', rcs: 'RCS Paris 661 334 880' },
  { form: 'sci', company: 'SCI Glacière Log', line: 'SCI GLACIÈRE LOG · M. PETIT', rcs: 'RCS Paris 771 009 112' },
  { form: 'sarl', company: 'SARL Tolbiac Holding', line: 'SARL TOLBIAC HOLDING · M. LEFÈVRE', rcs: 'RCS Paris 332 889 001' },
  { form: 'sci', company: 'SCI Alesia Square', line: 'SCI ALESIA SQUARE · Mme ROUX', rcs: 'RCS Paris 556 120 334' },
  { form: 'sarl', company: 'SARL Convention Asset', line: 'SARL CONVENTION ASSET · M. GIRARD', rcs: 'RCS Paris 119 445 778' },
  { form: 'sci', company: 'SCI Commerce & Co', line: 'SCI COMMERCE & CO · M. & Mme HENRY', rcs: 'RCS Paris 887 334 221' },
  { form: 'sci', company: 'SCI Vouillé Patrimoine', line: 'SCI VOUILLÉ PATRIMOINE · Mme SIMON', rcs: 'RCS Paris 445 009 667' },
  { form: 'sarl', company: 'SARL Entrepreneurs 15', line: 'SARL ENTREPRENEURS 15 · M. MARTINEZ', rcs: 'RCS Paris 223 998 441' },
  { form: 'sci', company: 'SCI Italie Sud', line: 'SCI ITALIE SUD · M. LAMBERT', rcs: 'RCS Paris 334 556 990' },
  { form: 'sarl', company: 'SARL Bobillot Invest', line: 'SARL BOBILLOT INVEST · Mme CARON', rcs: 'RCS Paris 667 112 003' },
  { form: 'sci', company: 'SCI Choisy Est', line: 'SCI CHOISY EST · M. FOURNIER', rcs: 'RCS Paris 778 223 114' },
  { form: 'sci', company: 'SCI Moulin des Prés', line: 'SCI MOULIN DES PRÉS · Mme BLANC', rcs: 'RCS Paris 889 334 225' },
  { form: 'sarl', company: 'SARL Auriol Capital', line: 'SARL AURIOL CAPITAL · M. CHEVALIER', rcs: 'RCS Paris 990 445 336' },
];

const DIR_FIRST = ['Édouard', 'Claire', 'Antoine', 'Paul', 'Camille', 'Julien', 'Sarah', 'Nicolas', 'Hélène', 'Marc', 'Laura', 'David', 'Emma', 'Pierre', 'Julie', 'Alexandre', 'Chloé', 'Vincent', 'Isabelle', 'Thomas'];
const DIR_LAST = ['Martin', 'Bernard', 'Lefort', 'Durand', 'Petit', 'Roux', 'Simon', 'Laurent', 'Michel', 'Garcia', 'David', 'Bertrand', 'Moreau', 'Fournier', 'Girard', 'Bonnet', 'Dupuis', 'Lambert', 'Fontaine', 'Rousseau'];

function zipSuffix(z: LeadZoneId): string {
  if (z === 'paris-13') return '75013 Paris';
  if (z === 'paris-14') return '75014 Paris';
  return '75015 Paris';
}

function scoreFor(i: number, kind: 'ent' | 'ind'): number {
  const pat = kind === 'ent'
    ? [92, 88, 85, 83, 81, 76, 74, 71, 68, 65, 62, 58, 55, 52, 48, 44, 41, 38, 35, 32]
    : [78, 72, 69, 66, 63, 59, 56, 54, 51, 48, 46, 43, 40, 37, 34, 31, 28, 25, 22, 19, 73, 67, 64, 60, 57, 53, 49, 45, 42, 39];
  return pat[i % pat.length];
}

function signalsForEnt(i: number, score: number): { types: SignalType[]; life: LifeEvent; sources: string[] } {
  if (i < 5) {
    const bundles: { life: LifeEvent; types: SignalType[]; sources: string[] }[] = [
      { life: 'liquidation_pro', types: ['liquidation_pro', 'detention_longue', 'plus_value'], sources: ['BODACC du 02/05/2026', 'DVF consolidée', 'Estimation marché Q2 2026'] },
      { life: 'dissolution_sci', types: ['dissolution_sci', 'plus_value', 'zone_rotation'], sources: ['Greffe Paris du 18/04/2026', 'DVF 2018', 'Indice rotation quartier'] },
      { life: 'cession_entreprise', types: ['cession_entreprise', 'dpe_recent', 'detention_longue'], sources: ['BODACC du 03/04/2026', 'ADEME DPE', 'DVF 2016'] },
      { life: 'liquidation_pro', types: ['liquidation_pro', 'plus_value'], sources: ['BODACC du 28/04/2026', 'DVF 2015'] },
      { life: 'dissolution_sci', types: ['dissolution_sci', 'detention_longue'], sources: ['Greffe Paris du 22/04/2026', 'DVF 2017'] },
    ];
    return bundles[i];
  }
  return signalsFor(score, false);
}

function signalsFor(score: number, hasLife: boolean): { types: SignalType[]; life: LifeEvent; sources: string[] } {
  if (hasLife) {
    const types: SignalType[] = ['liquidation_pro', 'detention_longue', 'plus_value'];
    return {
      types,
      life: 'liquidation_pro',
      sources: ['BODACC du 02/05/2026', 'DVF consolidée', 'Estimation marché Q2 2026'],
    };
  }
  if (score >= 70) {
    return {
      types: ['dpe_recent', 'detention_longue', 'plus_value'],
      life: null,
      sources: ['ADEME DPE', 'DVF historique', 'Indice plus-value'],
    };
  }
  if (score >= 50) {
    return {
      types: ['detention_longue', 'plus_value'],
      life: null,
      sources: ['DVF 2015-2019', 'Projection valeur'],
    };
  }
  return {
    types: ['detention_longue'],
    life: null,
    sources: ['DVF cadastrale'],
  };
}

/** Indices entreprise (0–19) avec statut avancé + agent pour la démo. */
const ENT_ACTIVE: Record<number, { status: LeadStatus; agent: string | null }> = {
  0: { status: 'contacté', agent: 'agent-1' },
  1: { status: 'intéressé', agent: 'agent-2' },
  2: { status: 'rdv_pris', agent: 'agent-3' },
  4: { status: 'contacté', agent: 'agent-4' },
  5: { status: 'pas_intéressé', agent: 'agent-1' },
  7: { status: 'intéressé', agent: 'agent-2' },
  9: { status: 'contacté', agent: 'agent-3' },
  11: { status: 'rdv_pris', agent: 'agent-1' },
  13: { status: 'contacté', agent: 'agent-4' },
  15: { status: 'intéressé', agent: 'agent-2' },
  17: { status: 'contacté', agent: 'agent-3' },
};

const IND_ACTIVE: Record<number, { status: LeadStatus; agent: string | null }> = {
  1: { status: 'contacté', agent: 'agent-2' },
  3: { status: 'intéressé', agent: 'agent-1' },
  5: { status: 'rdv_pris', agent: 'agent-4' },
  7: { status: 'contacté', agent: 'agent-3' },
  10: { status: 'pas_intéressé', agent: 'agent-2' },
  12: { status: 'intéressé', agent: 'agent-1' },
  14: { status: 'contacté', agent: 'agent-4' },
  18: { status: 'rdv_pris', agent: 'agent-3' },
  22: { status: 'contacté', agent: 'agent-2' },
  25: { status: 'intéressé', agent: 'agent-1' },
  28: { status: 'contacté', agent: 'agent-4' },
};

function mkSignals(types: SignalType[], life: LifeEvent) {
  const years = 6 + (types.length * 2) % 9;
  return {
    years_owned: years,
    days_since_dpe: 30 + (types.length * 17) % 400,
    estimated_gain_pct: 8 + (types.length * 5) % 32,
    life_event: life,
    zone_rotation_rate: 0.03 + (types.length % 7) * 0.01,
  };
}

function buildEnterprises(): Lead[] {
  return ENT_NAMES.map((meta, i) => {
    const zone = Z[i % 3];
    const streets = BASE[zone].streets;
    const street = streets[i % streets.length];
    const score = scoreFor(i, 'ent');
    const { types, life, sources } = signalsForEnt(i, score);
    const active = ENT_ACTIVE[i];
    const status = active?.status ?? 'nouveau';
    const assignedAgentId = active?.agent ?? (i % 7 === 0 ? 'agent-1' : null);
    const fn = DIR_FIRST[i % DIR_FIRST.length];
    const ln = DIR_LAST[i % DIR_LAST.length];
    const phone = `+33 1 ${40 + (i % 50)} ${10 + (i % 80)} ${10 + (i % 80)}`;
    const slug = meta.company
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 14);
    const email = `contact@${slug || 'societe'}.fr`;

    return {
      id: `ent-${String(i + 1).padStart(3, '0')}`,
      address: `${street}, ${zipSuffix(zone)}`,
      lat: BASE[zone].lat + (i % 5) * 0.002 - 0.004,
      lng: BASE[zone].lng + (i % 4) * 0.002 - 0.003,
      score,
      signalType: types,
      signals: mkSignals(types, life),
      propertyType: ['Appartement T2', 'Appartement T3', 'Appartement T4', 'Studio', 'Maison'][i % 5],
      surface: 28 + (i * 7) % 75,
      purchaseDate: `201${4 + (i % 5)}-${String(1 + (i % 9)).padStart(2, '0')}-${String(5 + (i % 20)).padStart(2, '0')}`,
      purchasePrice: 220000 + (i * 31000) % 520000,
      estimatedValue: 0,
      lifeEvent: life,
      status,
      segment: 'entreprise',
      owner: 'enterprise',
      legalForm: meta.form,
      assignedAgentId,
      prospectOutcome: 'none',
      notes: active ? 'Suivi agence — démo.' : '',
      createdAt: `2026-05-${String(1 + (i % 9)).padStart(2, '0')}T08:00:00Z`,
      zoneId: zone,
      companyOwnerLine: meta.line,
      companyName: meta.company,
      rcs: meta.rcs,
      directorName: `${fn} ${ln}`,
      directorPhonePro: i % 11 === 7 ? '' : phone,
      directorEmailPro: email,
      directorPhoneProAvailable: i % 11 !== 7,
      signalSources: sources,
    } as Lead;
  }).map((l) => ({
    ...l,
    estimatedValue: Math.round(l.purchasePrice * (1.05 + (l.score % 30) / 100)),
  }));
}

function buildParticuliers(): Lead[] {
  return Array.from({ length: 30 }, (_, i) => {
    const zone = Z[(i + 1) % 3];
    const streets = BASE[zone].streets;
    const street = streets[(i + 3) % streets.length];
    const score = scoreFor(i, 'ind');
    const { types, life, sources } = signalsFor(score, false);
    const active = IND_ACTIVE[i];
    const status = active?.status ?? 'nouveau';
    const assignedAgentId = active?.agent ?? null;
    const empty = {
      companyOwnerLine: null,
      companyName: null,
      rcs: null,
      directorName: null,
      directorPhonePro: null,
      directorEmailPro: null,
      directorPhoneProAvailable: false,
      signalSources: sources,
    };
    return {
      id: `ind-${String(i + 1).padStart(3, '0')}`,
      address: `${street}, ${zipSuffix(zone)}`,
      lat: BASE[zone].lat + (i % 6) * 0.0018 - 0.004,
      lng: BASE[zone].lng + (i % 5) * 0.0018 - 0.003,
      score,
      signalType: types,
      signals: mkSignals(types, life),
      propertyType: ['Appartement T2', 'Appartement T3', 'Studio', 'Maison', 'Appartement T4'][i % 5],
      surface: 24 + (i * 5) % 82,
      purchaseDate: `201${3 + (i % 6)}-${String(1 + (i % 11)).padStart(2, '0')}-${String(3 + (i % 24)).padStart(2, '0')}`,
      purchasePrice: 180000 + (i * 27000) % 480000,
      estimatedValue: 0,
      lifeEvent: life,
      status,
      segment: 'particulier',
      owner: 'individual',
      legalForm: null,
      assignedAgentId,
      prospectOutcome: i === 10 ? 'pas_vendeur' : 'none',
      notes: active ? 'Prospect particulier — démo.' : '',
      createdAt: `2026-04-${String(10 + (i % 18)).padStart(2, '0')}T08:00:00Z`,
      zoneId: zone,
      ...empty,
    } as Lead;
  }).map((l) => ({
    ...l,
    estimatedValue: Math.round(l.purchasePrice * (1.04 + (l.score % 28) / 100)),
  }));
}

export const mockLeads: Lead[] = [...buildEnterprises(), ...buildParticuliers()];
