export const ACCUEIL_VUE_COOKIE = 'priimo_accueil_vue';

export type AccueilVue = 'directeur' | 'agent';

export function parseAccueilVue(raw: string | undefined | null): AccueilVue {
  return raw === 'agent' ? 'agent' : 'directeur';
}

export function phraseEquipe(personnes: number): string {
  if (personnes <= 0) return 'Rien à signaler cette semaine';
  if (personnes === 1) return '1 personne a un point à regarder cette semaine';
  return `${personnes} personnes ont un point à regarder cette semaine`;
}
