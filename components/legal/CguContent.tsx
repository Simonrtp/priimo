import { readFileSync } from 'fs';
import path from 'path';
import { MarkdownDocument } from '@/components/legal/MarkdownDocument';
import { CGU_LAST_UPDATED } from '@/lib/legal/contact';

export function CguContent() {
  const mdPath = path.join(process.cwd(), 'lib/legal/cgu.md');
  const source = readFileSync(mdPath, 'utf8');

  return (
    <article>
      <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : {CGU_LAST_UPDATED}</p>
      <MarkdownDocument source={source} />
    </article>
  );
}
