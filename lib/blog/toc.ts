import { parseBlogBlocks } from './markdown';
import { slugifyHeading, stripMarkdownInline } from './slugify';

export type TocItem = {
  id: string;
  title: string;
};

/** Extrait les titres H2 du Markdown pour le sommaire (hors encadrés :::). */
export function extractH2Headings(source: string): TocItem[] {
  const blocks = parseBlogBlocks(source);
  const items: TocItem[] = [];
  const idCounts = new Map<string, number>();

  for (const block of blocks) {
    if (block.type !== 'markdown') continue;

    for (const line of block.content.split('\n')) {
      const match = /^##\s+(.+)$/.exec(line.trim());
      if (!match?.[1]) continue;

      const title = stripMarkdownInline(match[1]);
      let id = slugifyHeading(title);

      const count = idCounts.get(id) ?? 0;
      if (count > 0) id = `${id}-${count + 1}`;
      idCounts.set(slugifyHeading(title), count + 1);

      items.push({ id, title });
    }
  }

  return items;
}

/** Compte les H2 d'un bloc Markdown. */
export function countH2InMarkdown(content: string): number {
  return content.split('\n').filter((line) => /^##\s+/.test(line.trim())).length;
}
