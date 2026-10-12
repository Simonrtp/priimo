import Link from "next/link";
import type { ReactNode } from "react";

/** Découpe **gras** et [lien](/url) — réutilisable en paragraphe ou liste. */
export function noeudsTexteRiche(
  texte: string,
  linkClassName = "logiciel-carte-inline-link",
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  const pushTexte = (chunk: string) => {
    if (!chunk) return;
    nodes.push(chunk);
  };

  while ((m = re.exec(texte)) !== null) {
    if (m.index > last) {
      pushTexte(texte.slice(last, m.index));
    }
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        nodes.push(
          <Link key={key++} href={linkMatch[2]} className={linkClassName}>
            {linkMatch[1]}
          </Link>,
        );
      }
    }
    last = m.index + token.length;
  }
  if (last < texte.length) {
    pushTexte(texte.slice(last));
  }
  return nodes;
}

export function ParagrapheRiche({
  texte,
  linkClassName,
}: {
  texte: string;
  linkClassName?: string;
}) {
  return (
    <p className="logiciel-carte-p">
      {noeudsTexteRiche(texte, linkClassName ?? "logiciel-carte-inline-link")}
    </p>
  );
}
