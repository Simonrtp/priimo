export type EstimationVue = 'outil' | 'widget';

export function parseEstimationVue(raw: string | undefined | null): EstimationVue {
  if (raw === 'widget') return 'widget';
  return 'outil';
}

export function estimationHref(current: URLSearchParams, vue: EstimationVue): string {
  if (vue === 'widget') {
    return '/dashboard/estimation?vue=widget';
  }
  const params = new URLSearchParams(current.toString());
  params.delete('vue');
  const q = params.toString();
  return q ? `/dashboard/estimation?${q}` : '/dashboard/estimation';
}

/** Met à jour l’URL sans navigation Next (évite un rechargement RSC). */
export function replaceEstimationVueUrl(vue: EstimationVue): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (vue === 'widget') url.searchParams.set('vue', 'widget');
  else url.searchParams.delete('vue');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', next);
}
