export type ProspectionVue = 'liste' | 'pipeline';

export function parseProspectionVue(raw: string | undefined | null): ProspectionVue {
  if (raw === 'pipeline') return 'pipeline';
  return 'liste';
}

export function prospectionHref(current: URLSearchParams, vue: ProspectionVue): string {
  const params = new URLSearchParams(current.toString());
  if (vue === 'liste') params.delete('vue');
  else params.set('vue', vue);
  const q = params.toString();
  return q ? `/dashboard/prospection?${q}` : '/dashboard/prospection';
}
