export type CadastreSourceDates = {
  diagnosticsAt: string | null;
  ventesAt: string | null;
};

function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t) : null;
}

export function formatDiagnosticsAJour(iso: string, now: Date = new Date()): string {
  const d = parseIso(iso);
  if (!d) return '';
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(d);
  return `Diagnostics à jour au ${date}`;
}

export function formatVentesSemestre(iso: string): string {
  const d = parseIso(iso);
  if (!d) return '';
  const semestre = d.getMonth() < 6 ? '1er' : '2e';
  return `Ventes au ${semestre} semestre ${d.getFullYear()}`;
}

export function formatCadastreFreshness(
  sources: CadastreSourceDates,
  now: Date = new Date(),
): string | null {
  const parts: string[] = [];
  if (sources.diagnosticsAt) parts.push(formatDiagnosticsAJour(sources.diagnosticsAt, now));
  if (sources.ventesAt) parts.push(formatVentesSemestre(sources.ventesAt));
  return parts.length > 0 ? parts.join(' · ') : null;
}
