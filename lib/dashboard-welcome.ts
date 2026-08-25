const SESSION_KEY = 'priimo-welcome-msg-v4';

const MONDAY: string[] = [
  'Bon lundi {name}. Votre semaine commence ici — on voit ce qui vous attend.',
  'Bon lundi {name}. La pile est prête pour la semaine.',
  'Bon lundi {name}. Un écran, une journée. Le reste peut attendre.',
  'Bon lundi {name}. Café, puis la première action de la liste.',
];

const TUESDAY: string[] = [
  'Bon mardi {name}. Une relance bien placée vaut dix rappels au hasard.',
  'Bon mardi {name}. Hier c\'était la découverte, aujourd\'hui c\'est l\'action.',
  'Bon mardi {name}. Vos contacts et vos adresses sont au même endroit maintenant.',
];

const WEDNESDAY: string[] = [
  'Bon mercredi {name}. Mi-semaine : le bon moment pour relancer ceux qu\'on a laissés en suspens.',
  'Bon mercredi {name}. La pile est là pour vous éviter de tout garder en tête.',
  'Bon mercredi {name}. Moitié de semaine passée. Et vous, où en êtes-vous ?',
];

const THURSDAY: string[] = [
  'Bon jeudi {name}. Encore deux jours pour vider la pile.',
  'Bon jeudi {name}. Par quelle carte commencez-vous ?',
  'Bon jeudi {name}. Presque vendredi — une action de plus ne fera pas de mal.',
];

const FRIDAY: string[] = [
  'Bon vendredi {name}. Un dernier coup de fil avant le week-end ?',
  'Bon vendredi {name}. Finir la journée à jour, ça change un week-end.',
  'Bon vendredi {name}. Une relance de plus, puis vous pourrez fermer l\'écran.',
];

const WEEKEND: string[] = [
  'Bon week-end {name}. Samedi, jour des visites — notez ce que vous croisez.',
  'Bon week-end {name}. Rien ne presse. La pile sera là lundi.',
  'Bon week-end {name}. Une dictée après une visite, et c\'est rangé.',
];

const EARLY_MORNING: string[] = [
  'Bonjour {name}. Debout tôt : la journée est déjà préparée pour vous.',
  'Bonjour {name}. Premier café, première carte.',
  'Bonjour {name}. À cette heure, votre pile n\'a pas encore bougé.',
  'Bonjour {name}. Il est tôt. Vos actions du jour, elles, sont prêtes.',
];

const MORNING: string[] = [
  'Bonjour {name}. La matinée est faite pour traiter ce qui compte.',
  'Bonne matinée {name}. Voici ce qui vous attend — sans rien oublier.',
  'Bonjour {name}. On commence par laquelle ?',
  'Bonne matinée {name}. Une carte, une action, et la pile diminue.',
];

const MIDDAY: string[] = [
  'Bon appétit {name}. Vos relances ne s\'envolent pas pendant le déjeuner.',
  'Bonjour {name}. Pause déjeuner. La pile attendra une heure.',
  'Bon midi {name}. Personne n\'a jamais signé un mandat le ventre vide.',
  'Bon midi {name}. Reposez-vous — le travail est déjà rangé ici.',
];

const AFTERNOON: string[] = [
  'Bon après-midi {name}. C\'est souvent l\'après-midi que les choses avancent.',
  'Bon après-midi {name}. Il reste du temps. Il reste des cartes.',
  'Bon après-midi {name}. Les relances en attente ne partent pas toutes seules.',
  'Bon après-midi {name}. Une action de plus avant ce soir ?',
];

const EVENING: string[] = [
  'Bonsoir {name}. Un dernier coup d\'œil sur la pile avant de fermer ?',
  'Bonsoir {name}. Journée finie. Demain, elle repartira propre.',
  'Bonsoir {name}. Vous avez bien avancé. Le reste attendra demain.',
  'Bonsoir {name}. Encore là ? Une carte, et c\'est peut-être fini.',
];

const LATE_NIGHT: string[] = [
  'Bonsoir {name}. Il est tard. Rien ne presse cette nuit.',
  'Bonsoir {name}. À cette heure, même vos contacts dorment.',
  'Bonsoir {name}. Insomnie ou inspiration ? Dans les deux cas, bienvenue.',
  'Bonsoir {name}. Les meilleures idées viennent la nuit. Les actions, plutôt en journée.',
];

const ANYTIME: string[] = [
  'Content de vous revoir, {name}.',
  'Bon retour {name}. Voici ce qui vous attend aujourd\'hui.',
  'Ravi de vous retrouver, {name}.',
  'Bonjour {name}. Une pile claire, une journée plus simple.',
  'Bonjour {name}. Votre prochaine action est peut-être la première carte.',
  'Bienvenue {name}. Le travail est déjà préparé — il reste à le faire.',
  'Bon retour {name}. On reprend là où vous vous étiez arrêté.',
  'Bonjour {name}. Une carte à la fois, et la journée avance.',
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

function buildWelcomeMessage(firstName: string): string {
  const now = new Date();
  const timePool = timePoolForHour(now.getHours());
  const dayPool = BY_DAY[now.getDay()] ?? ANYTIME;
  const pool = [...timePool, ...timePool, ...dayPool, ...ANYTIME];
  return applyName(pickRandom(pool), firstName);
}

/**
 * Message d'accueil varié, léger et un peu humoristique.
 * Stable pendant la session navigateur (sessionStorage), nouveau tirage à chaque connexion.
 */
export function pickDashboardWelcomeMessage(firstName: string): string {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('priimo-welcome-msg');
    sessionStorage.removeItem('priimo-welcome-msg-v2');
    sessionStorage.removeItem('priimo-welcome-msg-v3');
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
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
  if (char === ':') return base + 100;
  if (nextChar === ' ' && (char === ',' || char === '.')) return base + 60;
  return base;
}
