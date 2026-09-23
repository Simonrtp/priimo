import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createElement, type ReactElement } from 'react';
import PageGenereeHtml from '@/components/rapport/print/PageGenereeHtml';
import type { KindGeneree } from '@/lib/rapport/modele-defaut';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import { cssPolicesInterEmbeddees } from './fonts';
import { AVIS_LAYOUT_CSS } from './styles';

/**
 * Turbopack refuse `import … from 'react-dom/server'` dans le graphe App Router.
 * Chargement Node au moment de l’appel uniquement.
 */
function markup(node: ReactElement): string {
  const req = createRequire(join(process.cwd(), 'package.json'));
  const { renderToStaticMarkup } = req('react-dom/' + 'server') as {
    renderToStaticMarkup: (el: ReactElement) => string;
  };
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
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap"/><style>${cssPolicesInterEmbeddees()}${AVIS_LAYOUT_CSS}</style></head><body class="avis-print">${pages}</body></html>`;
}
