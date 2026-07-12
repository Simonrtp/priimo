const SESSION_KEY = 'priimo-welcome-msg';

const MONDAY: string[] = [
  'Bon lundi {name}. Votre liste de prospects pour la semaine est prête.',
  'Bon lundi {name}. C\'est reparti pour une semaine de prospection avec Priimo.',
  'Bon lundi {name}. Quelqu\'un dans votre secteur veut probablement vendre.',
  'Bon lundi {name}. Un café, et on attaque la prospection. ☕',
];

const TUESDAY: string[] = [
  'Bon mardi {name}. Un bon prospect vaut dix portes frappées au hasard.',
  'Bon mardi {name}. Votre secteur bouge, profitez-en avant les autres.',
  'Hey {name}, c\'est mardi. Le moment idéal pour relancer vos prospects.',
];

const WEDNESDAY: string[] = [
  'Bon mercredi {name}. On est à mi-semaine, le moment de relancer vos prospects tièdes.',
  'Bon mercredi {name}. Il reste encore deux jours avant le week-end.',
  'Hey {name}, en milieu de semaine, votre liste peut encore vous surprendre.',
];

const THURSDAY: string[] = [
  'Bon jeudi {name}. Il vous reste deux jours pour signer ce mandat.',
  'Bon jeudi {name}. Qui allez-vous appeler en premier aujourd\'hui ?',
  'Hey {name}, presque vendredi. Un coup de fil avant la fin de semaine ?',
];

const FRIDAY: string[] = [
  'Bon vendredi {name}. Une dernière chance de signer avant le week-end ?',
  'Bon vendredi {name}. Finissez la semaine avec un mandat, ça fait plaisir. 😄',
  'Hey {name}, c\'est vendredi. Un mandat avant l\'apéro, ça se tente non ?',
];

const WEEKEND: string[] = [
  'Bon week-end {name}. Priimo continue de surveiller votre secteur. 😉',
  'Hey {name}, même le week-end un bon prospect reste un bon prospect.',
  'Bon week-end {name}. Votre secteur ne dort jamais tout à fait.',
];

const EARLY_MORNING: string[] = [
  'Bonjour {name}. L\'heure du café et de Priimo, non ? ☕',
  'Bonjour {name}. Votre secteur se lève tôt, et vous aussi apparemment.',
  'Bonjour {name}. Un café, et on attaque la prospection ?',
  'Bonjour {name}. Tôt debout ? Les vendeurs ne dorment pas non plus.',
];

const MORNING: string[] = [
  'Bon retour {name}. Votre secteur a des vendeurs à vous proposer.',
  'Bonne matinée {name}. Qui allez-vous appeler en premier ?',
  'Bonjour {name}. C\'est le moment idéal pour décrocher un rendez-vous.',
  'Bonne matinée {name}. Votre liste de prospects vous attend.',
];

const MIDDAY: string[] = [
  'Hey {name}, un petit creux ?',
  'Bonjour {name}. Pause déjeuner ou pause prospection ? Les deux si vous êtes motivé.',
  'Hey {name}, on mange vite et on rappelle ce prospect chaud ?',
  'Bon midi {name}. Vos prospects n\'attendent pas la fin du déjeuner.',
];

const AFTERNOON: string[] = [
  'Bon après-midi {name}. C\'est souvent l\'après-midi que les mandats se signent.',
  'Bon après-midi {name}. Il reste encore du temps pour un mandat aujourd\'hui.',
  'Hey {name}, relancez ce prospect tiède avant la fin de journée.',
  'Bon après-midi {name}. Vous allez faire du bon travail, j\'en suis sûr.',
];

const EVENING: string[] = [
  'Bonsoir {name}. Une dernière passe sur vos prospects avant de partir ?',
  'Bonsoir {name}. Encore un appel avant de ranger la valise ?',
  'Bonsoir {name}. Vous méritez un bon prospect avant de couper.',
  'Hey {name}, presque l\'heure de partir. Ou presque l\'heure de signer ? 😉',
];

const LATE_NIGHT: string[] = [
  'Hey {name}, encore là ? Priimo aussi visiblement. 🌙',
  'Bonsoir {name}. Tard dans la nuit, mais un bon prospect reste un bon prospect.',
  'Hey {name}, nuit blanche prospection ? Chapeau.',
  'Bonsoir {name}. Dévouement ou procrastination ? On ne juge pas.',
];

const ANYTIME: string[] = [
  'Content de vous revoir {name} !',
  'Hey {name}, vos prospects n\'attendent que vous. 👋',
  'Ravi de vous retrouver {name}.',
  'Hey {name}, on va trouver des vendeurs heureux aujourd\'hui. 😄',
  '{name}, vos prospects sont là. À vous de jouer. ⚡',
  'Hey {name}, une belle surprise vous attend dans votre liste.',
  'On se remet au boulot {name} ?',
  'Bienvenue {name}. Quelqu\'un dans votre secteur va vendre, pourquoi pas avec vous ?',
  'Hey {name}, Priimo a repéré de l\'activité dans votre secteur.',
  'Prêt {name} ? Votre prochain mandat est peut-être dans cette liste.',
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

/**
 * Message d'accueil varié, léger et un peu humoristique.
 * Mélange créneau horaire + jour de la semaine + messages génériques.
 * Stable pendant la session navigateur (sessionStorage), nouveau tirage à chaque connexion.
 */
export function pickDashboardWelcomeMessage(firstName: string): string {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
  }

  const now = new Date();
  const timePool = timePoolForHour(now.getHours());
  const dayPool = BY_DAY[now.getDay()] ?? ANYTIME;
  const pool = [...timePool, ...timePool, ...dayPool, ...ANYTIME];
  const message = applyName(pickRandom(pool), firstName);

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
