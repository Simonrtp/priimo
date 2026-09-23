import { createRequire } from 'node:module';
import { createElement, type ReactElement } from 'react';
import PageGenereeHtml from '@/components/rapport/print/PageGenereeHtml';
import type { KindGeneree } from '@/lib/rapport/modele-defaut';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import { cssPolicesInterEmbeddees } from './fonts';
import { AVIS_LAYOUT_CSS } from './styles';

/**
 * Turbopack refuse `import … from 'react-dom/server'` dans le graphe App Router
 * et n’accepte que `import.meta.url` comme argument de `createRequire`.
 */
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/' + 'server') as {
  renderToStaticMarkup: (el: ReactElement) => string;
};

function markup(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

export function htmlPagesGenerees(
  kinds: readonly KindGeneree[],
  dossier: DossierRapport,
  accent: string,
): string {
  const pages = kinds
    .map((kind) => markup(createElement(PageGenereeHtml, { kind, dossier, accent })))
    .join('');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><style>${cssPolicesInterEmbeddees()}${AVIS_LAYOUT_CSS}</style></head><body class="avis-print">${pages}</body></html>`;
}
