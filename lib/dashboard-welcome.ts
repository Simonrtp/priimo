const SESSION_KEY = 'priimo-welcome-msg-v2';

const MONDAY: string[] = [
  'Bon lundi {name}. Votre liste de prospects pour la semaine est prête.',
  'Bon lundi {name}. C\'est reparti pour une semaine de prospection avec Priimo.',
  'Bon lundi {name}. Quelqu\'un dans votre secteur veut probablement vendre bientôt.',
  'Bon lundi {name}. Un café, et on attaque la prospection. ☕',
];

const TUESDAY: string[] = [
  'Bon mardi {name}. Un bon prospect vaut dix portes frappées au hasard.',
  'Bon mardi {name}. Votre secteur bouge. Profitez-en avant les autres.',
  'Bon mardi {name}. C\'est le moment idéal pour relancer vos prospects.',
];

const WEDNESDAY: string[] = [
  'Bon mercredi {name}. On est à mi-semaine. Relancez vos prospects en attente.',
  'Bon mercredi {name}. Il reste encore deux jours avant le week-end.',
  'Bon mercredi {name}. Votre liste peut encore vous surprendre aujourd\'hui.',
];

const THURSDAY: string[] = [
  'Bon jeudi {name}. Il vous reste deux jours pour signer un mandat cette semaine.',
  'Bon jeudi {name}. Qui allez-vous appeler en premier aujourd\'hui ?',
  'Bon jeudi {name}. Presque vendredi. Un coup de fil avant la fin de semaine ?',
];

const FRIDAY: string[] = [
  'Bon vendredi {name}. Une dernière chance de signer avant le week-end ?',
  'Bon vendredi {name}. Finissez la semaine avec un mandat. Ça fait plaisir. 😄',
  'Bon vendredi {name}. Un mandat avant l\'apéro, ça se tente non ?',
];

const WEEKEND: string[] = [
  'Bon week-end {name}. Priimo continue de surveiller votre secteur. 😉',
  'Bon week-end {name}. Un bon prospect reste un bon prospect, même le samedi.',
  'Bon week-end {name}. Votre secteur ne dort jamais tout à fait.',
];

const EARLY_MORNING: string[] = [
  'Bonjour {name}. L\'heure du café et de Priimo, non ? ☕',
  'Bonjour {name}. Votre secteur se lève tôt. Vous aussi, apparemment.',
  'Bonjour {name}. Un café, et on attaque la prospection ?',
  'Bonjour {name}. Vous êtes debout tôt. Les vendeurs ne dorment pas non plus.',
];

const MORNING: string[] = [
  'Bon retour {name}. Votre secteur a des vendeurs à vous proposer.',
  'Bonne matinée {name}. Qui allez-vous appeler en premier ?',
  'Bonjour {name}. C\'est le moment idéal pour décrocher un rendez-vous.',
  'Bonne matinée {name}. Votre liste de prospects vous attend.',
];

const MIDDAY: string[] = [
  'Bon midi {name}. Vous avez faim ? Vos prospects attendront après le déjeuner.',
  'Bonjour {name}. Profitez de votre pause déjeuner. La prospection reprendra après.',
  'Bon midi {name}. Un bon repas, et on reprend la prospection ensuite ?',
  'Bonjour {name}. C\'est l\'heure du déjeuner. Vos prospects seront toujours là après.',
];

const AFTERNOON: string[] = [
  'Bon après-midi {name}. C\'est souvent l\'après-midi que les mandats se signent.',
  'Bon après-midi {name}. Il reste encore du temps pour un mandat aujourd\'hui.',
  'Bon après-midi {name}. Pensez à relancer vos prospects en attente avant ce soir.',
  'Bon après-midi {name}. Vous allez faire du bon travail. J\'en suis sûr.',
];

const EVENING: string[] = [
  'Bonsoir {name}. Une dernière passe sur vos prospects avant de partir ?',
  'Bonsoir {name}. Encore un appel avant de ranger la valise ?',
  'Bonsoir {name}. Vous méritez un bon prospect avant de couper.',
  'Bonsoir {name}. Presque l\'heure de partir. Ou presque l\'heure de signer ? 😉',
];

const LATE_NIGHT: string[] = [
  'Bonsoir {name}. Vous êtes encore là ? Priimo aussi, visiblement. 🌙',
  'Bonsoir {name}. Il est tard, mais un bon prospect reste un bon prospect.',
  'Bonsoir {name}. Prospection tard dans la nuit ? Bravo pour votre motivation.',
  'Bonsoir {name}. Travail tard ou simple curiosité ? Dans les deux cas, bienvenue.',
];

const ANYTIME: string[] = [
  'Content de vous revoir, {name} !',
  'Bon retour {name}. Vos prospects n\'attendent que vous. 👋',
  'Ravi de vous retrouver, {name}.',
  'Bonjour {name}. On va trouver des vendeurs motivés aujourd\'hui. 😄',
  'Bonjour {name}. Vos prospects sont là. À vous de jouer. ⚡',
  'Bonjour {name}. Une belle surprise vous attend dans votre liste.',
  'Bonjour {name}. On se remet au boulot ?',
  'Bienvenue {name}. Quelqu\'un dans votre secteur va vendre. Pourquoi pas avec vous ?',
  'Bonjour {name}. Priimo a repéré de l\'activité dans votre secteur.',
  'Bonjour {name}. Votre prochain mandat est peut-être dans cette liste.',
  'Bon retour {name}. Votre secteur a des choses intéressantes à vous montrer.',
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

function timePoolForHour(hour: number): string[] {
  if (hour >= 5 && hour < 9) return EARLY_MORNING;
  if (hour >= 9 && hour < 12) return MORNING;
  if (hour >= 12 && hour < 14) return MIDDAY;
  if (hour >= 14 && hour < 18) return AFTERNOON;
  if (hour >= 18 && hour < 22) return EVENING;
  return LATE_NIGHT;
}

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

/** Rejette les anciens messages (tirets longs, formulations obsolètes). */
function isValidWelcomeMessage(message: string): boolean {
  if (!message.trim()) return false;
  if (/[—…]/.test(message)) return false;
  if (/pause mandat|prospect chaud|prospect tiède|pipeline/i.test(message)) return false;
  return true;
}

function buildWelcomeMessage(firstName: string): string {
  const now = new Date();
  const timePool = timePoolForHour(now.getHours());
  const dayPool = BY_DAY[now.getDay()] ?? ANYTIME;
  const pool = [...timePool, ...timePool, ...dayPool, ...ANYTIME];
  return applyName(pickRandom(pool), firstName);
}

/**
 * Message d'accueil varié, léger et un peu humoristique.
 * Phrases complètes, vocabulaire simple, sans tiret long (—).
 * Stable pendant la session navigateur (sessionStorage), nouveau tirage à chaque connexion.
 */
export function pickDashboardWelcomeMessage(firstName: string): string {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('priimo-welcome-msg');
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored && isValidWelcomeMessage(stored)) return stored;
    if (stored) sessionStorage.removeItem(SESSION_KEY);
  }

  const message = buildWelcomeMessage(firstName);

  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, message);
  }

  return message;
}

/** Délai entre deux caractères (ms), plus long après la ponctuation. */
export function welcomeTypeDelay(char: string, nextChar?: string): number {
  const base = 22 + Math.random() * 28;
  if (char === ' ') return base + 35;
  if (char === ',' || char === ';') return base + 90;
  if (char === '.' || char === '!' || char === '?') return base + 160;
  if (nextChar === ' ' && (char === ',' || char === '.')) return base + 60;
  return base;
}
