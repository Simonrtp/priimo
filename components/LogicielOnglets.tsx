"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import CtaButton from "./CtaButton";
import DiffusionPortailsOrbit from "./DiffusionPortailsOrbit";
import {
  FONCTIONNALITES,
  imageFonctionnalite,
  mediasFonctionnalitesAPrecharger,
  type FonctionnaliteCarte,
} from "@/lib/landing/fonctionnalites";

/** Rend un paragraphe : **gras** et [libellé](/url). */
function ParagrapheRiche({ texte }: { texte: string }) {
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

function VisuelCarte({
  carte,
  actif,
}: {
  carte: FonctionnaliteCarte;
  actif: boolean;
}) {
  const [ok, setOk] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = imageFonctionnalite(carte);
  const videoSrcs = carte.videoSrcs;
  const custom =
    carte.visuel === "diffusion-orbit" ? (
      <DiffusionPortailsOrbit />
    ) : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (actif) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [actif]);

  return (
    <div
      className={`logiciel-carte-media${carte.imageFit === "contain" ? " is-mockup" : ""}${videoSrcs?.length ? " is-video" : ""}${custom ? " is-custom" : ""}`}
      style={{ background: carte.degrade }}
    >
      {custom ? (
        custom
      ) : videoSrcs?.length ? (
        <video
          ref={videoRef}
          className="logiciel-carte-video"
          muted
          loop
          playsInline
          preload="auto"
          aria-label={carte.imageAlt}
        >
          {videoSrcs.map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
        </video>
      ) : ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={carte.imageAlt}
          width={carte.imageFit === "contain" ? 599 : 1100}
          height={carte.imageFit === "contain" ? 900 : 733}
          loading="eager"
          decoding="sync"
          fetchPriority="high"
          className={`logiciel-carte-img${carte.imageFit === "contain" ? " is-contain" : ""}`}
          onError={() => setOk(false)}
        />
      ) : (
        <span className="sr-only">{carte.imageAlt}</span>
      )}
    </div>
  );
}

/** Charge et décode tous les médias dès le montage — zéro latence au clic. */
function PrefetchMediasOnglets() {
  useEffect(() => {
    const urls = mediasFonctionnalitesAPrecharger();
    const links: HTMLLinkElement[] = [];
    const videos: HTMLVideoElement[] = [];

    for (const url of urls) {
      if (/\.(webm|mp4)(\?|$)/i.test(url)) {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "video";
        link.href = url;
        document.head.appendChild(link);
        links.push(link);

        const video = document.createElement("video");
        video.preload = "auto";
        video.muted = true;
        video.playsInline = true;
        video.src = url;
        video.load();
        videos.push(video);
        continue;
      }

      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      document.head.appendChild(link);
      links.push(link);

      const img = new Image();
      img.decoding = "sync";
      img.src = url;
      void img.decode?.().catch(() => {});
    }

    return () => {
      for (const link of links) link.remove();
      for (const video of videos) {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, []);
  return null;
}

export default function LogicielOnglets() {
  const baseId = useId();
  const [actif, setActif] = useState(FONCTIONNALITES[0].slug);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    function relayerMolette(e: WheelEvent) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const cible = e.currentTarget;
      if (!(cible instanceof Element)) return;
      const overflowX = getComputedStyle(cible).overflowX;
      if (overflowX === "visible" || overflowX === "clip") return;
      e.preventDefault();
      window.scrollBy(0, e.deltaY);
    }

    bar.addEventListener("wheel", relayerMolette, { passive: false });
    return () => bar.removeEventListener("wheel", relayerMolette);
  }, []);

  const focusTab = (slug: string) => {
    setActif(slug);
    document.getElementById(`${baseId}-tab-${slug}`)?.focus();
  };

  return (
    <div className="logiciel-onglets">
      <PrefetchMediasOnglets />
      <div
        ref={barRef}
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

      <div className="logiciel-onglets-panels">
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
              aria-hidden={!selected}
              inert={!selected ? true : undefined}
              className={`logiciel-onglet-panel${selected ? " is-active" : ""}`}
            >
              <div className="logiciel-onglet-panel-inner">
                <div className="logiciel-carte">
                  <div className="logiciel-carte-copy">
                    <h3 className="logiciel-carte-title">{carte.titre}</h3>
                    {carte.sousTitre || carte.sousTitreLogo ? (
                      carte.sousTitreHref ? (
                        <a
                          href={carte.sousTitreHref}
                          className="logiciel-carte-subtitle"
                          target="_blank"
                          rel="noopener noreferrer"
                          tabIndex={selected ? 0 : -1}
                        >
                          {carte.sousTitre ? <span>{carte.sousTitre}</span> : null}
                          {carte.sousTitreLogo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={carte.sousTitreLogo.src}
                              alt={carte.sousTitreLogo.alt}
                              width={carte.sousTitreLogo.width}
                              height={carte.sousTitreLogo.height}
                              className="logiciel-carte-subtitle-logo"
                              loading="eager"
                              decoding="sync"
                              fetchPriority="high"
                            />
                          ) : null}
                        </a>
                      ) : (
                        <p className="logiciel-carte-subtitle">
                          {carte.sousTitre ? <span>{carte.sousTitre}</span> : null}
                          {carte.sousTitreLogo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={carte.sousTitreLogo.src}
                              alt={carte.sousTitreLogo.alt}
                              width={carte.sousTitreLogo.width}
                              height={carte.sousTitreLogo.height}
                              className="logiciel-carte-subtitle-logo"
                              loading="eager"
                              decoding="sync"
                              fetchPriority="high"
                            />
                          ) : null}
                        </p>
                      )
                    ) : null}
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
                        tabIndex={selected ? 0 : -1}
                      >
                        En savoir plus
                      </Link>
                    </div>
                  </div>
                  <VisuelCarte carte={carte} actif={selected} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
