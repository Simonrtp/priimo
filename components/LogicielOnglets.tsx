"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import CtaButton from "./CtaButton";
import FonctionnaliteVisuelCarte from "@/components/landing/FonctionnaliteVisuelCarte";
import {
  FONCTIONNALITES,
  mediasFonctionnalitesAPrecharger,
} from "@/lib/landing/fonctionnalites";
import LogicielCarteTitre from "@/components/landing/LogicielCarteTitre";
import { ParagrapheRiche } from "@/lib/landing/paragraphe-riche";

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
                    <LogicielCarteTitre titre={carte.titre} />
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
                  <FonctionnaliteVisuelCarte slug={carte.slug} actif={selected} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
