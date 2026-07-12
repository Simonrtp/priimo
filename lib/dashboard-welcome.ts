const SESSION_KEY = 'priimo-welcome-msg-v3';

const MONDAY: string[] = [
  'Bon lundi {name}. Votre liste de la semaine est arrivée. Avant même votre café.',
  'Bon lundi {name}. Nouvelle semaine, nouvelles adresses. Les mauvaises portes, c\'était avant.',
  'Bon lundi {name}. Pendant que vous dormiez, on a fait le tri.',
  'Bon lundi {name}. Café, liste, terrain. Dans cet ordre.',
];

const TUESDAY: string[] = [
  'Bon mardi {name}. Une bonne adresse vaut cent portes au hasard.',
  'Bon mardi {name}. Le lundi on découvre, le mardi on décroche.',
  'Bon mardi {name}. Vos concurrents lisent encore les annonces. Vous, vous avez la liste.',
];

const WEDNESDAY: string[] = [
  'Bon mercredi {name}. Mi-semaine : le bon moment pour relancer ceux qui n\'ont pas répondu.',
  'Bon mercredi {name}. Les mandats se signent rarement tout seuls. Sauf peut-être aujourd\'hui.',
  'Bon mercredi {name}. La moitié de la semaine est passée. Pas la moitié des mandats, j\'espère.',
];

const THURSDAY: string[] = [
  'Bon jeudi {name}. Encore deux jours pour transformer une adresse en mandat.',
  'Bon jeudi {name}. Qui appelez-vous en premier aujourd\'hui ?',
  'Bon jeudi {name}. Presque vendredi. Presque le week-end. Presque un mandat ?',
];

const FRIDAY: string[] = [
  'Bon vendredi {name}. Un dernier rendez-vous avant le week-end ?',
  'Bon vendredi {name}. Signer le vendredi, c\'est le meilleur début de week-end.',
  'Bon vendredi {name}. Un mandat avant l\'apéro. Ça se tente.',
];

const WEEKEND: string[] = [
  'Bon week-end {name}. Samedi, jour des visites. Et peut-être d\'un mandat.',
  'Bon week-end {name}. La liste sera toujours là lundi. Promis.',
  'Bon week-end {name}. Une bonne adresse reste une bonne adresse, même le dimanche.',
];

const EARLY_MORNING: string[] = [
  'Bonjour {name}. Debout avant le soleil. Les mandats aiment ça.',
  'Bonjour {name}. Premier café, première adresse.',
  'Bonjour {name}. À cette heure-ci, vos concurrents dorment encore.',
  'Bonjour {name}. Il est tôt. Votre liste est déjà réveillée.',
];

const MORNING: string[] = [
  'Bonjour {name}. La meilleure heure pour décrocher un rendez-vous.',
  'Bonne matinée {name}. Votre liste vous attend. Elle est patiente, mais quand même.',
  'Bonjour {name}. On commence par quelle adresse ?',
  'Bonne matinée {name}. Une adresse, un appel, un rendez-vous. La recette est simple.',
];

const MIDDAY: string[] = [
  'Bon appétit {name}. Les adresses ne s\'envolent pas pendant le déjeuner.',
  'Bonjour {name}. Pause déjeuner. Les mandats attendront une heure.',
  'Bon midi {name}. Personne n\'a jamais signé un mandat le ventre vide.',
  'Bon midi {name}. Même les meilleurs prospecteurs déjeunent.',
];

const AFTERNOON: string[] = [
  'Bon après-midi {name}. C\'est souvent l\'après-midi que les mandats se signent.',
  'Bon après-midi {name}. Il reste du temps. Il reste des adresses.',
  'Bon après-midi {name}. Les prospects en attente ne se relancent pas tout seuls.',
  'Bon après-midi {name}. Une porte de plus avant ce soir ?',
];

const EVENING: string[] = [
  'Bonsoir {name}. Un dernier coup d\'œil sur la liste avant de fermer ?',
  'Bonsoir {name}. Journée finie. Sauf si un mandat vous attend encore.',
  'Bonsoir {name}. Vous avez bien travaillé. La liste sera là demain.',
  'Bonsoir {name}. Encore là ? Le mandat n\'est peut-être pas loin.',
];

const LATE_NIGHT: string[] = [
  'Bonsoir {name}. Il est tard. La liste ne s\'enfuira pas cette nuit.',
  'Bonsoir {name}. À cette heure, même les vendeurs dorment.',
  'Bonsoir {name}. Insomnie ou inspiration ? Dans les deux cas, bienvenue.',
  'Bonsoir {name}. Les meilleures idées viennent la nuit. Les mandats, plutôt en journée.',
];

const ANYTIME: string[] = [
  'Content de vous revoir, {name}.',
  'Bon retour {name}. Vos adresses n\'attendent que vous.',
  'Ravi de vous retrouver, {name}.',
  'Bonjour {name}. Moins de portes, plus de mandats. On y va ?',
  'Bonjour {name}. Votre prochain mandat est peut-être dans cette liste.',
  'Bienvenue {name}. Quelqu\'un dans votre secteur va vendre. Autant que ce soit avec vous.',
  'Bonjour {name}. On ne frappe plus au hasard. On frappe où il faut.',
  'Bon retour {name}. On reprend là où vous vous étiez arrêté.',
  'Bonjour {name}. Une adresse bien choisie vaut mieux qu\'une journée de porte-à-porte.',
  'Bonjour {name}. Prêt à transformer une adresse en mandat ?',
  'Bonjour {name}. Bonne prospection. Et bonne chance, même si vous n\'en aurez pas besoin.',
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
