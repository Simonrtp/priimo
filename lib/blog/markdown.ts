import type { MarkdownBlock } from './types';

const BLOCK_RE = /:::(priimo|note)\n([\s\S]*?):::/g;

/** Découpe le markdown en blocs standard + encadrés Priimo / notes. */
export function parseBlogBlocks(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(BLOCK_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const chunk = source.slice(lastIndex, index).trim();
      if (chunk) blocks.push({ type: 'markdown', content: chunk });
    }
    blocks.push({
      type: match[1] as 'priimo' | 'note',
      content: match[2]?.trim() ?? '',
    });
    lastIndex = index + match[0].length;
  }

  const tail = source.slice(lastIndex).trim();
  if (tail) blocks.push({ type: 'markdown', content: tail });

  return blocks.length > 0 ? blocks : [{ type: 'markdown', content: source.trim() }];
}
