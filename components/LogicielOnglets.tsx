"use client";

import Link from "next/link";
import {
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import CtaButton from "./CtaButton";
import {
  FONCTIONNALITES,
  imageFonctionnalite,
  type FonctionnaliteCarte,
} from "@/lib/landing/fonctionnalites";

/** Rend un paragraphe : **gras** et [libellé](/url). */
function ParagrapheRiche({ texte }: { texte: string }) {
  const nodes: ReactNode[] = [];
  // Liens d’abord, puis gras dans chaque segment texte
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
          <Link key={key++} href={linkMatch[2]} className="logiciel-carte-inline-link">
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
  return <p className="logiciel-carte-p">{nodes}</p>;
}

function VisuelCarte({ carte }: { carte: FonctionnaliteCarte }) {
  const [ok, setOk] = useState(true);
  const src = imageFonctionnalite(carte);

  return (
    <div
      className={`logiciel-carte-media${carte.imageFit === "contain" ? " is-mockup" : ""}`}
      style={{ background: carte.degrade }}
    >
      {ok ? (
        // img natif : si le .webp n’existe pas encore → onError, fond dégradé seul
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={carte.imageAlt}
          width={1024}
          height={1536}
          loading="lazy"
          decoding="async"
          className={`logiciel-carte-img${carte.imageFit === "contain" ? " is-contain" : ""}`}
          onError={() => setOk(false)}
        />
      ) : (
        <span className="sr-only">{carte.imageAlt}</span>
      )}
    </div>
  );
}

export default function LogicielOnglets() {
  const baseId = useId();
  const [actif, setActif] = useState(FONCTIONNALITES[0].slug);

  const focusTab = (slug: string) => {
    setActif(slug);
    document.getElementById(`${baseId}-tab-${slug}`)?.focus();
  };

  return (
    <div className="logiciel-onglets">
      <div
        className="logiciel-onglets-bar"
        role="tablist"
        aria-label="Fonctionnalités du logiciel"
      >
        {FONCTIONNALITES.map((carte) => {
          const selected = carte.slug === actif;
          const tabId = `${baseId}-tab-${carte.slug}`;
          const panelId = `${baseId}-panel-${carte.slug}`;
          const { Icon } = carte;
          return (
            <button
              key={carte.slug}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              className={`logiciel-onglet${selected ? " is-active" : ""}`}
              style={
                { "--onglet-accent": carte.couleurIcone } as CSSProperties
              }
              onClick={() => setActif(carte.slug)}
              onKeyDown={(e) => {
                const i = FONCTIONNALITES.findIndex((c) => c.slug === actif);
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  focusTab(
                    FONCTIONNALITES[(i + 1) % FONCTIONNALITES.length].slug,
                  );
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  focusTab(
                    FONCTIONNALITES[
                      (i - 1 + FONCTIONNALITES.length) % FONCTIONNALITES.length
                    ].slug,
                  );
                } else if (e.key === "Home") {
                  e.preventDefault();
                  focusTab(FONCTIONNALITES[0].slug);
                } else if (e.key === "End") {
                  e.preventDefault();
                  focusTab(FONCTIONNALITES[FONCTIONNALITES.length - 1].slug);
                }
              }}
            >
              <span className="logiciel-onglet-icon" aria-hidden>
                <Icon strokeWidth={2.25} absoluteStrokeWidth={false} />
              </span>
              <span className="logiciel-onglet-label">{carte.onglet}</span>
              {carte.badge ? (
                <span className="logiciel-onglet-badge">{carte.badge}</span>
              ) : null}
              {carte.bientot ? (
                <span className="logiciel-onglet-badge is-bientot">
                  Bientôt
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {FONCTIONNALITES.map((carte) => {
        const selected = carte.slug === actif;
        const tabId = `${baseId}-tab-${carte.slug}`;
        const panelId = `${baseId}-panel-${carte.slug}`;
        return (
          <div
            key={carte.slug}
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId}
            hidden={!selected}
            className="logiciel-onglet-panel"
          >
            {selected ? (
              <div className="logiciel-onglet-panel-inner">
                <div className="logiciel-carte">
                  <div className="logiciel-carte-copy">
                    <h3 className="logiciel-carte-title">{carte.titre}</h3>
                    <div className="logiciel-carte-body">
                      {carte.paragraphes.map((p) => (
                        <ParagrapheRiche key={p.slice(0, 40)} texte={p} />
                      ))}
                    </div>
                    <div className="logiciel-carte-cta">
                      <CtaButton>Essai gratuit 1 mois</CtaButton>
                      <Link
                        href={carte.enSavoirPlusHref}
                        className="btn btn-ghost logiciel-carte-cta-secondary"
                      >
                        En savoir plus
                      </Link>
                    </div>
                  </div>
                  <VisuelCarte carte={carte} />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
