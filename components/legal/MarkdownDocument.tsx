import { LEGAL_CONTACT } from '@/lib/legal/contact';

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function enrichContactLinks(text: string): React.ReactNode {
  if (text.includes('contact@priimo.fr')) {
    return (
      <>
        {text.split('contact@priimo.fr')[0]}
        <a href={`mailto:${LEGAL_CONTACT.email}`} className="text-accent-dark hover:underline">
          {LEGAL_CONTACT.email}
        </a>
        {text.split('contact@priimo.fr')[1]}
      </>
    );
  }
  if (text.includes('**WhatsApp**')) {
    return (
      <>
        <strong>WhatsApp</strong>
        {' : '}
        <a
          href={LEGAL_CONTACT.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-dark hover:underline"
        >
          {LEGAL_CONTACT.phoneDisplay}
        </a>
      </>
    );
  }
  if (text.includes(LEGAL_CONTACT.phoneDisplay)) {
    const [before, after] = text.split(LEGAL_CONTACT.phoneDisplay);
    return (
      <>
        {before}
        <a href={`tel:${LEGAL_CONTACT.phoneTel}`} className="text-accent-dark hover:underline">
          {LEGAL_CONTACT.phoneDisplay}
        </a>
        {after}
      </>
    );
  }
  return inlineFormat(text);
}

/** Rendu léger du markdown CGU (titres, listes, paragraphes). */
export function MarkdownDocument({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={key++} className="list-disc pl-5 space-y-2 text-sm text-gray-700">
        {listItems.map((item) => (
          <li key={item} className="text-pretty">
            {enrichContactLinks(item.replace(/^-\s+/, ''))}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    if (trimmed === '---') {
      flushList();
      nodes.push(<hr key={key++} className="my-10 border-black/10" />);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      nodes.push(
        <h2
          key={key++}
          id={trimmed
            .slice(3)
            .replace(/^\d+\.\s*/, '')
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')}
          className="font-sans text-xl font-semibold text-gray-900 mt-10 mb-4 text-balance scroll-mt-24"
        >
          {trimmed.slice(3)}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      nodes.push(
        <h3 key={key++} className="font-medium text-gray-900 mt-6 mb-2 text-base">
          {trimmed.slice(4)}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('- ')) {
      listItems.push(trimmed);
      continue;
    }
    flushList();
    if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**')) {
      nodes.push(
        <p key={key++} className="text-sm text-gray-700 text-pretty leading-relaxed font-medium text-gray-900">
          {trimmed.slice(2, -2)}
        </p>
      );
    } else {
      nodes.push(
        <p key={key++} className="text-sm text-gray-700 text-pretty leading-relaxed">
          {enrichContactLinks(trimmed)}
        </p>
      );
    }
  }
  flushList();

  return <div className="space-y-4">{nodes}</div>;
}
