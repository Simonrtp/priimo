"use client";

import { useEffect, useRef, useState } from "react";
import DiffusionPortailsOrbit from "@/components/DiffusionPortailsOrbit";
import {
  FONCTIONNALITES,
  imageFonctionnalite,
} from "@/lib/landing/fonctionnalites";

type Props = {
  /** Slug carte accueil (`prospection`, `dictee`, …) — résolu côté client pour éviter de sérialiser `Icon`. */
  slug: string;
  /** Lecture vidéo (onglets accueil) ; sur page dédiée, laisser true. */
  actif?: boolean;
};

export default function FonctionnaliteVisuelCarte({ slug, actif = true }: Props) {
  const carte = FONCTIONNALITES.find((c) => c.slug === slug);
  if (!carte) {
    return null;
  }
  const [ok, setOk] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = imageFonctionnalite(carte);
  const videoSrcs = carte.videoSrcs;
  const custom =
    carte.visuel === "diffusion-orbit" ? <DiffusionPortailsOrbit /> : null;

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
