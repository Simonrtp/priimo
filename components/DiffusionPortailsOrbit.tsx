import type { CSSProperties } from "react";

/** Logos portails en orbite autour du chiffre « 400 ». */

type PortailLogo = {
  id: string;
  label: string;
  src: string;
};

const PORTAILS: PortailLogo[] = [
  { id: "seloger", label: "SeLoger", src: "/landing/portails/seloger.svg" },
  { id: "leboncoin", label: "Leboncoin", src: "/landing/portails/leboncoin.svg" },
  { id: "logicimmo", label: "Logic-Immo", src: "/landing/portails/logicimmo.png" },
  { id: "bienici", label: "Bien'ici", src: "/landing/portails/bienici.png" },
  { id: "ouestfrance", label: "Ouest-France", src: "/landing/portails/ouestfrance.png" },
  { id: "figaro", label: "Figaro Immo", src: "/landing/portails/figaro.png" },
  { id: "greenacres", label: "Green-Acres", src: "/landing/portails/greenacres.png" },
  { id: "bellesdemeures", label: "Belles Demeures", src: "/landing/portails/bellesdemeures.png" },
];

export default function DiffusionPortailsOrbit() {
  const n = PORTAILS.length;

  return (
    <div
      className="diffusion-orbit"
      role="img"
      aria-label="400 portails de vente : SeLoger, Leboncoin, Logic-Immo, Bien'ici et d'autres"
    >
      <div className="diffusion-orbit-scene">
        <div className="diffusion-orbit-ring" aria-hidden="true">
          {PORTAILS.map((p, i) => (
            <div
              key={p.id}
              className="diffusion-orbit-slot"
              style={
                {
                  "--orbit-i": String(i),
                  "--orbit-n": String(n),
                } as CSSProperties
              }
            >
              <div className="diffusion-orbit-logo" title={p.label}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={p.label}
                  width={48}
                  height={48}
                  className="diffusion-orbit-img"
                  decoding="async"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="diffusion-orbit-center" aria-hidden="true">
          <span className="diffusion-orbit-count">400</span>
          <span className="diffusion-orbit-label">portails ventes</span>
        </div>
      </div>
    </div>
  );
}
