import { readFileSync } from 'fs';
import path from 'path';
import { MarkdownDocument } from '@/components/legal/MarkdownDocument';

export function LegalArticleContent({
  filename,
  lastUpdated,
}: {
  filename: string;
  lastUpdated: string;
}) {
  const mdPath = path.join(process.cwd(), 'lib/legal', filename);
  const source = readFileSync(mdPath, 'utf8');

  return (
    <article>
      <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : {lastUpdated}</p>
      <MarkdownDocument source={source} />
    </article>
  );
}
