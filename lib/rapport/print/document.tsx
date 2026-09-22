import { renderToStaticMarkup } from 'react-dom/server';
import PageGenereeHtml from '@/components/rapport/print/PageGenereeHtml';
import type { KindGeneree } from '@/lib/rapport/modele-defaut';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import { cssPolicesInterEmbeddees } from './fonts';
import { AVIS_LAYOUT_CSS } from './styles';

export function htmlPagesGenerees(
  kinds: readonly KindGeneree[],
  dossier: DossierRapport,
  accent: string,
): string {
  const pages = kinds
    .map((kind) => renderToStaticMarkup(<PageGenereeHtml kind={kind} dossier={dossier} accent={accent} />))
    .join('');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><style>${cssPolicesInterEmbeddees()}${AVIS_LAYOUT_CSS}</style></head><body class="avis-print">${pages}</body></html>`;
}
