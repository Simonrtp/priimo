import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";
import CtaButton from "@/components/CtaButton";
import FonctionnaliteOngletsBar from "@/components/features/FonctionnaliteOngletsBar";
import FonctionnalitePageTitre from "@/components/features/FonctionnalitePageTitre";
import FonctionnaliteVisuelCarte from "@/components/landing/FonctionnaliteVisuelCarte";
import {
  carteFonctionnaliteParSegment,
  type SegmentFonctionnalite,
} from "@/lib/landing/fonctionnalite-par-chemin";
import { ParagrapheRiche } from "@/lib/landing/paragraphe-riche";

const REASSURANCE = [
  "1 mois gratuit sans carte bancaire",
  "Sans engagement",
  "Conçu pour les agences immobilières",
] as const;

type Props = {
  segment: SegmentFonctionnalite;
};

export default function FonctionnaliteTiimePage({ segment }: Props) {
  const carte = carteFonctionnaliteParSegment(segment);
  if (!carte) {
    return null;
  }

  return (
    <>
      <SiteHeader />
      <main className="feature-tiime-page min-w-0 overflow-x-clip">
        <section className="feature-tiime-shell" aria-labelledby="feature-tiime-title">
          <div className="logiciel-onglets feature-tiime-onglets">
            <FonctionnaliteOngletsBar activeSlug={carte.slug} />
            <div className="logiciel-onglet-panel is-active feature-tiime-panel-wrap">
              <div className="logiciel-onglet-panel-inner feature-tiime-panel">
                <div className="logiciel-carte">
                  <div className="logiciel-carte-copy feature-tiime-copy">
                    <FonctionnalitePageTitre
                      slug={carte.slug}
                      titreFallback={carte.titre}
                      couleurIcone={carte.couleurIcone}
                    />

                    {carte.sousTitre || carte.sousTitreLogo ? (
                      carte.sousTitreHref ? (
                        <a
                          href={carte.sousTitreHref}
                          className="logiciel-carte-subtitle"
                          target="_blank"
                          rel="noopener noreferrer"
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
                            />
                          ) : null}
                        </a>
                      ) : (
                        <p className="logiciel-carte-subtitle">
                          {carte.sousTitre ? <span>{carte.sousTitre}</span> : null}
                          {carte.sousTitreLogo ? (
                            <Image
                              src={carte.sousTitreLogo.src}
                              alt={carte.sousTitreLogo.alt}
                              width={carte.sousTitreLogo.width}
                              height={carte.sousTitreLogo.height}
                              className="logiciel-carte-subtitle-logo"
                            />
                          ) : null}
                        </p>
                      )
                    ) : null}

                    <div className="logiciel-carte-body feature-tiime-body">
                      {carte.paragraphes.map((p) => (
                        <ParagrapheRiche key={p.slice(0, 40)} texte={p} />
                      ))}
                    </div>

                    <div className="logiciel-carte-cta feature-tiime-cta-row">
                      <CtaButton size="lg" className="feature-tiime-cta">
                        Réserver une démo
                        <span data-arrow aria-hidden>
                          →
                        </span>
                      </CtaButton>
                    </div>

                    <ul className="feature-tiime-reassurance" aria-label="Garanties">
                      {REASSURANCE.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>

                  <FonctionnaliteVisuelCarte slug={carte.slug} actif />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
