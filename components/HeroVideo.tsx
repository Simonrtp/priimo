"use client";

import { useEffect, useRef, useState } from "react";

const VIDEO_SRC = "/Priimo Video2.mp4";

/** Vidéo hero : source chargée uniquement à l'approche du viewport, lecture au scroll. */
export default function HeroVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [srcLoaded, setSrcLoaded] = useState(false);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        setSrcLoaded((loaded) => loaded || true);

        if (hasPlayedRef.current) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const video = videoRef.current;
        if (!video || !video.src) return;

        hasPlayedRef.current = true;
        void video.play().catch(() => {
          hasPlayedRef.current = false;
        });
      },
      { threshold: 0.2, rootMargin: "160px" },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!srcLoaded) return;

    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      if (hasPlayedRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inView) return;

      hasPlayedRef.current = true;
      void video.play().catch(() => {
        hasPlayedRef.current = false;
      });
    };

    video.addEventListener("loadeddata", tryPlay, { once: true });
    tryPlay();
    return () => video.removeEventListener("loadeddata", tryPlay);
  }, [srcLoaded]);

  return (
    <div ref={containerRef} className="w-full">
      <video
        ref={videoRef}
        className="block h-auto w-full"
        loop
        muted
        playsInline
        preload="none"
        aria-label="Démonstration du tableau de bord Priimo"
      >
        {srcLoaded ? <source src={VIDEO_SRC} type="video/mp4" /> : null}
      </video>
    </div>
  );
}
