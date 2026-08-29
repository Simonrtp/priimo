export type ProspectionVue = 'liste' | 'pipeline' | 'carte';

export function parseProspectionVue(raw: string | undefined | null): ProspectionVue {
  if (raw === 'pipeline') return 'pipeline';
  if (raw === 'carte') return 'carte';
  return 'liste';
}

export function prospectionHref(current: URLSearchParams, vue: ProspectionVue): string {
  const params = new URLSearchParams(current.toString());
  // La carte a ses propres query (immeuble, itineraire…) — on repart propre depuis liste/pipeline.
  if (vue !== 'carte') {
    params.delete('immeuble');
    params.delete('itineraire');
    params.delete('tournee');
  }
  if (vue === 'liste') params.delete('vue');
  else params.set('vue', vue);
  const q = params.toString();
  return q ? `/dashboard/prospection?${q}` : '/dashboard/prospection';
}

/** Ancienne URL `/dashboard/carte` → prospection carte. */
export function carteVersProspectionHref(search: string | URLSearchParams = ''): string {
  const params = new URLSearchParams(typeof search === 'string' ? search : search.toString());
  params.set('vue', 'carte');
  const q = params.toString();
  return `/dashboard/prospection?${q}`;
}
