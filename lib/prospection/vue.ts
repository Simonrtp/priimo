export type ProspectionVue = 'carte' | 'liste' | 'pipeline';

export function parseProspectionVue(raw: string | undefined | null): ProspectionVue {
  if (raw === 'liste') return 'liste';
  if (raw === 'pipeline') return 'pipeline';
  return 'carte';
}

/** Vue réelle : la carte est le défaut, sauf lien vers une liste (lead, filtre…). */
export function resoudreProspectionVue(params: {
  vue?: string | null;
  lead?: string | null;
  filtre?: string | null;
  fraicheur?: string | null;
}): ProspectionVue {
  if (params.filtre === 'non-pris' || params.filtre === 'estimations') return 'liste';
  if (!params.vue) {
    if (params.lead) return 'liste';
    if (params.filtre) return 'liste';
    if (params.fraicheur) return 'liste';
    return 'carte';
  }
  return parseProspectionVue(params.vue);
}

export function prospectionHref(current: URLSearchParams, vue: ProspectionVue): string {
  const params = new URLSearchParams(current.toString());
  // La carte a ses propres query (immeuble, itineraire…) — on repart propre depuis liste/pipeline.
  if (vue !== 'carte') {
    params.delete('immeuble');
    params.delete('itineraire');
    params.delete('tournee');
  }
  if (vue === 'carte') params.delete('vue');
  else params.set('vue', vue);
  const q = params.toString();
  return q ? `/dashboard/prospection?${q}` : '/dashboard/prospection';
}

/** Ancienne URL `/dashboard/carte` → prospection carte. */
export function carteVersProspectionHref(search: string | URLSearchParams = ''): string {
  const params = new URLSearchParams(typeof search === 'string' ? search : search.toString());
  params.delete('vue');
  const q = params.toString();
  return q ? `/dashboard/prospection?${q}` : '/dashboard/prospection';
}
