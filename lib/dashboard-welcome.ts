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

/** 5h–9h — réveil, café, mise en route. */
const EARLY_MORNING: string[] = [
  'L\'heure du café et de Priimo, {name} ? ☕',
  'Bonjour {name} — le secteur se lève, et vous ?',
  'Premier café, premier lead ? Bonne matinée {name}.',
  'Tôt le matin {name} ? Les mandats n\'attendent pas le réveil de tout le monde 😄',
  'Belle matinée {name} — on attaque la journée ?',
];

/** 9h–12h — matinée active. */
const MORNING: string[] = [
  'Belle matinée {name} — votre secteur a des choses à vous dire.',
  'Bon retour {name} — prêt pour une matinée efficace ?',
  'Hey {name}, c\'est le moment idéal pour décrocher un rendez-vous.',
  'Matinée en vue {name} — qui est votre prochain appel ?',
  'Bonjour {name} ! La prospection, c\'est maintenant ou jamais (enfin, surtout maintenant).',
];

/** 12h–14h — pause déjeuner. */
const MIDDAY: string[] = [
  'Un petit creux, {name} ?',
  'Pause déjeuner {name} — ou pause mandat ? Les deux se cumulent mal 😄',
  'Midi {name} : sandwich ou signature ? (On ne juge pas.)',
  'Hey {name}, on mange vite et on rappelle ce lead chaud ?',
  'L\'heure du déjeuner {name} — votre pipeline, lui, ne fait pas de pause.',
];

/** 14h–18h — après-midi. */
const AFTERNOON: string[] = [
  'Bel après-midi {name} — encore de la marge pour un mandat.',
  'Après-midi {name} : parfait pour relancer vos prospects tièdes.',
  'Hey {name}, l\'après-midi est souvent là que ça se signe.',
  'Bon retour {name} — votre secteur a des choses à vous dire.',
  'Après-midi productif {name} ? On en parie oui 💪',
];

/** 18h–22h — fin de journée. */
const EVENING: string[] = [
  'Fin de journée {name} — une dernière passe sur vos leads ?',
  'Bonsoir {name} — demain est un autre jour (mais ce soir compte aussi).',
  'Hey {name}, encore un appel avant de ranger la valise ?',
  'Soirée {name} — vous méritez un bon lead avant de couper.',
  'Presque l\'heure de partir {name}… ou presque l\'heure de signer ? 😉',
];

/** 22h–5h — tard le soir / nuit. */
const LATE_NIGHT: string[] = [
  'Encore là {name} ? Priimo aussi, visiblement 🌙',
  'Tard le soir {name} — dévouement ou procrastination ? On ne dit rien.',
  'Hey {name}, même à cette heure, un bon lead reste un bon lead.',
  'Nuit blanche prospection {name} ? Respect.',
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
  'Tiens {name}, une bonne surprise vous attend dans votre liste.',
  'On se remet au boulot {name} ?',
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
  // Le créneau horaire est doublé pour favoriser les messages du moment.
  const pool = [...timePool, ...timePool, ...dayPool, ...ANYTIME];
  const message = applyName(pickRandom(pool), firstName);

  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, message);
  }

  return message;
}
