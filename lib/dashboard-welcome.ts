const SESSION_KEY = 'priimo-welcome-msg';

/** Messages du lundi — livraison hebdo, énergie de début de semaine. */
const MONDAY: string[] = [
  'Quoi de mieux que de commencer à prospecter avec Priimo 😉, {name} ?',
  'Bon lundi {name} — votre liste de la semaine est prête.',
  'Lundi = jour de chasse aux mandats. Bon courage {name} !',
  'Nouvelle semaine, nouveaux leads. C\'est parti {name} 🚀',
];

const TUESDAY: string[] = [
  'Mardi productif {name} — qui allez-vous appeler en premier ?',
  'Bon mardi {name} ! Votre secteur bouge, profitez-en.',
  'Hey {name}, la prospection attend personne… sauf vous 😄',
];

const WEDNESDAY: string[] = [
  'Mercredi {name} — mi-semaine, mi-mandats (on espère).',
  'Bon mercredi {name} ! Un lead bien travaillé vaut dix portes frappées.',
  'Milieu de semaine {name} : parfait pour relancer vos prospects chauds.',
];

const THURSDAY: string[] = [
  'Jeudi {name} — encore deux jours pour signer ce mandat 💪',
  'Bon jeudi {name} ! Votre pipeline vous dit bonjour.',
  'Presque vendredi {name}, mais les mandats ne signent pas tout seuls 😉',
];

const FRIDAY: string[] = [
  'Vendredi {name} — une dernière passe sur vos leads avant le week-end ?',
  'Bon vendredi {name} ! Finissez la semaine en beauté.',
  'Friday mood {name} : un mandat avant l\'apéro, ça se tente non ? 😄',
];

const WEEKEND: string[] = [
  'Bon week-end {name} — Priimo veille sur votre secteur 😉',
  'Hey {name}, même le week-end on peut jeter un œil à un bon lead…',
  'Bienvenue {name} — votre agence ne dort jamais (enfin, presque).',
];

const ANYTIME: string[] = [
  'Content de vous revoir, {name} !',
  'Bienvenue {name} — prêt à transformer des adresses en mandats ?',
  'Hey {name}, vos prospects n\'attendent que vous 👋',
  'Ravi de vous retrouver {name} !',
  'Bon retour {name} — votre secteur a des choses à vous dire.',
  'Allez {name}, on va faire des heureux (des vendeurs, pas des acheteurs) 😄',
  'Bienvenue {name} — aujourd\'hui est un bon jour pour prospecter.',
  '{name}, vos leads sont là. À vous de jouer ⚡',
];

const BY_DAY: Record<number, string[]> = {
  0: WEEKEND,
  1: MONDAY,
  2: TUESDAY,
  3: WEDNESDAY,
  4: THURSDAY,
  5: FRIDAY,
  6: WEEKEND,
};

function formatName(firstName: string): string {
  const trimmed = firstName.trim();
  if (!trimmed) return 'vous';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function applyName(template: string, firstName: string): string {
  return template.replace(/\{name\}/g, formatName(firstName));
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/**
 * Message d'accueil varié, léger et un peu humoristique.
 * Stable pendant la session navigateur (sessionStorage), nouveau tirage à chaque connexion.
 */
export function pickDashboardWelcomeMessage(firstName: string): string {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
  }

  const dayPool = BY_DAY[new Date().getDay()] ?? ANYTIME;
  const pool = [...dayPool, ...ANYTIME];
  const message = applyName(pickRandom(pool), firstName);

  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, message);
  }

  return message;
}
