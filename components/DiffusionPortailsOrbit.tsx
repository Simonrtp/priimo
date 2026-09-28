"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

/** 4 rangées de logos portails qui défilent derrière « +400 ». */

export type PortailMarqueeLogo = {
  id: string;
  label: string;
  src: string;
};

export const PORTAILS_MARQUEE: PortailMarqueeLogo[] = [
  { id: "bienici", label: "Bien'ici", src: "/landing/portails/marquee/bienici.webp" },
  { id: "jinka", label: "Jinka", src: "/landing/portails/marquee/jinka.webp" },
  { id: "greenacres", label: "Green-Acres", src: "/landing/portails/marquee/greenacres.webp" },
  { id: "logicimmo", label: "Logic-Immo", src: "/landing/portails/marquee/logicimmo.webp" },
  { id: "meilleursagents", label: "Meilleurs Agents", src: "/landing/portails/marquee/meilleursagents.webp" },
  { id: "paruvendu", label: "ParuVendu", src: "/landing/portails/marquee/paruvendu.webp" },
  { id: "superimmo", label: "Superimmo", src: "/landing/portails/marquee/superimmo.webp" },
  { id: "superneuf", label: "SuperNeuf", src: "/landing/portails/marquee/superneuf.webp" },
  { id: "etreproprio", label: "Être proprio", src: "/landing/portails/marquee/etreproprio.webp" },
  { id: "luxresidence", label: "Lux Residence", src: "/landing/portails/marquee/luxresidence.webp" },
  { id: "bellesdemeures", label: "Belles Demeures", src: "/landing/portails/marquee/bellesdemeures.webp" },
  { id: "proprietesfigaro", label: "Propriétés Le Figaro", src: "/landing/portails/marquee/proprietesfigaro.webp" },
  { id: "properstar", label: "Properstar", src: "/landing/portails/marquee/properstar.webp" },
  { id: "seloger", label: "SeLoger", src: "/landing/portails/marquee/seloger.webp" },
  { id: "leboncoin", label: "Leboncoin", src: "/landing/portails/marquee/leboncoin.webp" },
  { id: "figaroimmobilier", label: "Figaro Immobilier", src: "/landing/portails/marquee/figaroimmobilier.webp" },
];

/** Chaque logo n’appartient qu’à une seule rangée → jamais 2× le même à l’écran. */
const RANGEES: {
  logos: PortailMarqueeLogo[];
  sens: "gauche" | "droite";
  duree: string;
}[] = [
  { logos: PORTAILS_MARQUEE.slice(0, 4), sens: "gauche", duree: "48s" },
  { logos: PORTAILS_MARQUEE.slice(4, 8), sens: "droite", duree: "54s" },
  { logos: PORTAILS_MARQUEE.slice(8, 12), sens: "gauche", duree: "52s" },
  { logos: PORTAILS_MARQUEE.slice(12, 16), sens: "droite", duree: "58s" },
];

function GroupeLogos({ logos }: { logos: PortailMarqueeLogo[] }) {
  return (
    <>
      {logos.map((logo) => (
        <div key={logo.id} className="diffusion-marquee-item">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo.src}
            alt=""
            width={140}
            height={40}
            className="diffusion-marquee-img"
            loading="eager"
            decoding="async"
            draggable={false}
          />
        </div>
      ))}
    </>
  );
}

function Rangée({
  logos,
  sens,
  duree,
}: {
  logos: PortailMarqueeLogo[];
  sens: "gauche" | "droite";
  duree: string;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [shiftPx, setShiftPx] = useState(0);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = group.getBoundingClientRect().width;
        if (w > 0) setShiftPx(Math.round(w * 1000) / 1000);
      });
    };

    const imgs = Array.from(group.querySelectorAll("img"));
    void Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
      ),
    ).then(measure);

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(group);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [logos]);

  const ready = shiftPx > 0;

  return (
    <div
      className={`diffusion-marquee-row is-${sens}${ready ? " is-ready" : ""}`}
      style={
        {
          "--marquee-duree": duree,
          "--marquee-shift": `${shiftPx}px`,
        } as CSSProperties
      }
    >
      <div className="diffusion-marquee-track" aria-hidden="true">
        <div className="diffusion-marquee-group" ref={groupRef}>
          <GroupeLogos logos={logos} />
        </div>
        <div className="diffusion-marquee-group">
          <GroupeLogos logos={logos} />
        </div>
      </div>
    </div>
  );
}

export default function DiffusionPortailsOrbit() {
  return (
    <div
      className="diffusion-marquee"
      role="img"
      aria-label="+400 portails de vente"
    >
      <div className="diffusion-marquee-stack" aria-hidden="true">
        {RANGEES.map((r, i) => (
          <Rangée key={i} logos={r.logos} sens={r.sens} duree={r.duree} />
        ))}
      </div>

      <div className="diffusion-marquee-center">
        <span className="diffusion-marquee-count">+400</span>
        <span className="diffusion-marquee-label">portails ventes</span>
      </div>
    </div>
  );
}
