'use client';

/** Crée un avis pré-rempli depuis une fiche, puis renvoie son id. */
export async function creerAvisDepuis(source: {
  leadId?: string;
  bienId?: string;
}): Promise<{ id: string } | { error: string }> {
  const res = await fetch('/api/dashboard/estimation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(source),
  });
  const data = (await res.json()) as { estimation?: { id: string }; error?: string };
  if (!res.ok || !data.estimation) {
    return { error: data.error ?? 'Création impossible' };
  }
  return { id: data.estimation.id };
}
