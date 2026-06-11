import { LegalArticleContent } from '@/components/legal/LegalArticleContent';
import { CGU_LAST_UPDATED } from '@/lib/legal/contact';

export function CguContent() {
  return <LegalArticleContent filename="cgu.md" lastUpdated={CGU_LAST_UPDATED} />;
}
