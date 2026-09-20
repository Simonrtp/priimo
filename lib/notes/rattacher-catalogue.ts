import type { NoteLienEntite } from '@/types/contact';

export type RattacherKind = 'contact' | 'bien' | 'lead' | 'immeuble';

export type RattacherItem = {
  id: string;
  kind: RattacherKind;
  label: string;
  subtitle: string | null;
};

export const RATTACHER_CARTES: { id: RattacherKind; label: string; entite: NoteLienEntite }[] = [
  { id: 'contact', label: 'Contact', entite: 'contact' },
  { id: 'bien', label: 'Bien', entite: 'bien' },
  { id: 'lead', label: 'Prospect', entite: 'lead' },
  { id: 'immeuble', label: 'Immeuble', entite: 'immeuble' },
];

export function normaliserRecherche(q: string): string {
  return q
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .trim();
}

export function filtrerCatalogue(items: RattacherItem[], query: string): RattacherItem[] {
  const needle = normaliserRecherche(query);
  if (!needle) return items;
  return items.filter((item) => {
    const hay = normaliserRecherche(`${item.label} ${item.subtitle ?? ''}`);
    return hay.includes(needle);
  });
}
