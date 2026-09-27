"use client";

import { useId, useState, type ComponentType, type CSSProperties } from "react";
import {
  BarChart3,
  FileText,
  Megaphone,
  Mic,
  Radar,
  type LucideProps,
} from "lucide-react";

type Onglet = {
  id: string;
  label: string;
  Icon: ComponentType<LucideProps>;
  /** Couleur active de l’icône (unique, pep) */
  couleur: string;
  badge?: string;
  titre: string;
  texte: string;
  accroche: string;
};

const ONGLETS: Onglet[] = [
  {
    id: "prospection",
    label: "Prospection intelligente",
    Icon: Radar,
    couleur: "#FFD400",
    badge: "Le cœur",
    titre: "Prospection intelligente",
    texte:
      "Ta carte de secteur découpée en zones, avec l’historique public de chaque immeuble (ventes passées, prix au m², copropriétés), les relances qui remontent toutes seules le bon jour, et le pipeline où l’agent prend ses prospects d’un geste.",
    accroche: "Sachez où frapper avant de sortir.",
  },
  {
    id: "dictee",
    label: "Dictée terrain",
    Icon: Mic,
    couleur: "#FF2D6B",
    titre: "Dictée terrain",
    texte:
      "L’agent parle en marchant, la note est rangée et rattachée au bon immeuble ou contact. Plus de compte rendu à 18h30.",
    accroche: "Vous parlez, c’est rangé.",
  },
  {
    id: "estimations",
    label: "Estimations et avis de valeur",
    Icon: FileText,
    couleur: "#8B5CF6",
    titre: "Estimations et avis de valeur",
    texte:
      "Formulaire rapide, résultat partageable au propriétaire, widget à poser sur le site de l’agence.",
    accroche: "De la visite à l’avis de valeur, sans quitter l’appli.",
  },
  {
    id: "diffusion",
    label: "Diffusion des mandats",
    Icon: Megaphone,
    couleur: "#FF6A00",
    titre: "Diffusion des mandats",
    texte:
      "Un mandat saisi une fois, publié sur les portails.",
    accroche: "Un mandat, tous les portails.",
  },
  {
    id: "pilotage",
    label: "Pilotage commercial",
    Icon: BarChart3,
    couleur: "#12B76A",
    titre: "Pilotage commercial",
    texte:
      "L’entonnoir contacts → estimations → mandats → ventes, avec les objectifs de chaque négociateur et leur progression en temps réel.",
    accroche: "Vos objectifs, transformés en actions du jour.",
  },
];

export default function LogicielOnglets() {
  const baseId = useId();
  const [actif, setActif] = useState(ONGLETS[0].id);

  const focusTab = (id: string) => {
    setActif(id);
    document.getElementById(`${baseId}-tab-${id}`)?.focus();
  };

  return (
    <div className="logiciel-onglets">
      <div
        className="logiciel-onglets-bar"
        role="tablist"
        aria-label="Fonctionnalités du logiciel"
      >
        {ONGLETS.map((onglet) => {
          const selected = onglet.id === actif;
          const tabId = `${baseId}-tab-${onglet.id}`;
          const panelId = `${baseId}-panel-${onglet.id}`;
          const { Icon } = onglet;
          return (
            <button
              key={onglet.id}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              className={`logiciel-onglet${selected ? " is-active" : ""}`}
              style={{ "--onglet-accent": onglet.couleur } as CSSProperties}
              onClick={() => setActif(onglet.id)}
              onKeyDown={(e) => {
                const i = ONGLETS.findIndex((o) => o.id === actif);
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  focusTab(ONGLETS[(i + 1) % ONGLETS.length].id);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  focusTab(ONGLETS[(i - 1 + ONGLETS.length) % ONGLETS.length].id);
                } else if (e.key === "Home") {
                  e.preventDefault();
                  focusTab(ONGLETS[0].id);
                } else if (e.key === "End") {
                  e.preventDefault();
                  focusTab(ONGLETS[ONGLETS.length - 1].id);
                }
              }}
            >
              <span className="logiciel-onglet-icon" aria-hidden>
                <Icon strokeWidth={2.25} absoluteStrokeWidth={false} />
              </span>
              <span className="logiciel-onglet-label">{onglet.label}</span>
              {onglet.badge ? (
                <span className="logiciel-onglet-badge">{onglet.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {ONGLETS.map((onglet) => {
        const selected = onglet.id === actif;
        const tabId = `${baseId}-tab-${onglet.id}`;
        const panelId = `${baseId}-panel-${onglet.id}`;
        return (
          <div
            key={onglet.id}
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId}
            hidden={!selected}
            className="logiciel-onglet-panel"
          >
            {selected ? (
              <div
                className="logiciel-onglet-panel-inner"
                style={{ "--onglet-accent": onglet.couleur } as CSSProperties}
              >
                <h3 className="logiciel-onglet-panel-title">{onglet.titre}</h3>
                <p className="logiciel-onglet-panel-text">{onglet.texte}</p>
                <p className="logiciel-onglet-panel-accroche">{onglet.accroche}</p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
