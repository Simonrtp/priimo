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
