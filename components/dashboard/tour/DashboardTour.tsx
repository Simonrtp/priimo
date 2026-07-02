'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { CallBackProps, Step, TooltipRenderProps } from 'react-joyride';
import ClayButton from '@/components/ui/ClayButton';

const Joyride = dynamic(() => import('react-joyride'), { ssr: false });

/**
 * Visite guidée du dashboard prospects — PRIIMO_DESIGN_SYSTEM.md :
 * bulles = surface clay arrondie (rounded-clay-lg + shadow-clay-lg),
 * « Suivant » = ClayButton primaire, « Passer » discret, overlay léger.
 *
 * Les cibles sont des attributs data-tour posés sur les vrais éléments.
 * Desktop et mobile ayant des blocs séparés (hidden md:/lg:), chaque étape
 * accepte plusieurs ancres et on retient la première réellement visible.
 *
 * L'étape « signal » pointe la section « Signaux détectés » du panneau de
 * détail : la visite est pilotée (stepIndex contrôlé) pour ouvrir le panneau
 * du premier lead avant cette étape et le refermer après.
 */

type TourStepDef = {
  /** Ancres data-tour candidates (desktop d'abord) — null : bulle centrée. */
  anchors: string[] | null;
  body: string;
  placement?: Step['placement'];
  /** Nécessite le panneau de détail ouvert (cible résolue à l'activation). */
  inDrawer?: boolean;
};

const STEP_DEFS: TourStepDef[] = [
  {
    anchors: null,
    body: 'Bienvenue sur Priimo 👋 En 30 secondes, voici comment transformer cette page en rendez-vous vendeur.',
  },
  {
    anchors: ['lead-card'],
    body: 'Voici tes leads, classés par priorité. Priimo a passé au crible les biens de ton secteur et fait remonter ceux où il se passe quelque chose.',
    placement: 'bottom',
  },
  {
    anchors: ['lead-score', 'lead-score-mobile'],
    body: 'Ce score, c\u2019est la « probabilité » qu\u2019un bien soit sur le point de bouger. Plus il est haut, plus le signal est fort. Commence par le haut de la liste.',
    placement: 'right',
  },
  {
    anchors: ['drawer-signals', 'drawer-signals-mobile'],
    body: 'Ici, LE signal : pourquoi ce bien remonte (DPE tout récent, succession probable, copropriété en mouvement, cascade de vente…). C\u2019est ton angle d\u2019approche.',
    placement: 'left',
    inDrawer: true,
  },
  {
    anchors: ['view-toggle', 'view-toggle-mobile'],
    body: 'Sur la carte, chaque point est un lead géolocalisé. Idéal pour organiser ta tournée ou ton boîtage par rue.',
    placement: 'bottom',
  },
  {
    anchors: null,
    body: 'Ce que Priimo te dit, c\u2019est LESQUELS des biens de ton secteur bougent vraiment en ce moment. À partir de là, c\u2019est du boîtage ciblé — au lieu de tracter 400 boîtes au hasard, tu cibles les immeubles où il se passe quelque chose. C\u2019est ça qui change tout.',
  },
  {
    anchors: ['lead-feedback', 'lead-feedback-mobile'],
    body: 'Après avoir travaillé un lead, dis à Priimo ce que ça a donné (mandat signé, pas vendeur, injoignable…). Plus tu donnes ton retour, plus tes prochains leads sont précis.',
    placement: 'left',
  },
  {
    anchors: ['whatsapp', 'whatsapp-mobile'],
    body: 'Une question, un retour, une remarque ? Envoie un message WhatsApp directement au fondateur de Priimo — il répond vite.',
    placement: 'right',
  },
  {
    anchors: null,
    body: 'C\u2019est parti 🚀 Tu peux relancer ce guide à tout moment via le bouton Aide, en haut.',
  },
];

/** Première ancre visible parmi les candidates (blocs desktop/mobile séparés). */
function findVisibleAnchor(names: string[]): HTMLElement | null {
  for (const name of names) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

function buildSteps(): { steps: Step[]; drawerStepIndex: number } {
  const steps: Step[] = [];
  let drawerStepIndex = -1;

  const hasFirstCard = Boolean(document.querySelector('[data-tour="lead-card"]'));
  // Le panneau s'affiche en drawer (md+) ou plein écran mobile (<md).
  const isDesktopDrawer = window.matchMedia('(min-width: 768px)').matches;

  for (const def of STEP_DEFS) {
    if (def.anchors === null) {
      steps.push({
        target: 'body',
        placement: 'center',
        content: def.body,
        disableBeacon: true,
      });
      continue;
    }

    if (def.inDrawer) {
      // Panneau fermé au lancement : cible en sélecteur CSS, résolue par
      // joyride au moment où l'étape s'active (panneau alors ouvert).
      if (!hasFirstCard) continue;
      drawerStepIndex = steps.length;
      steps.push({
        target: `[data-tour="${isDesktopDrawer ? def.anchors[0] : def.anchors[1] ?? def.anchors[0]}"]`,
        placement: def.placement ?? 'auto',
        content: def.body,
        disableBeacon: true,
      });
      continue;
    }

    const el = findVisibleAnchor(def.anchors);
    if (!el) continue; // élément absent (ex. pas de lead) : étape sautée
    steps.push({
      target: el,
      placement: def.placement ?? 'auto',
      content: def.body,
      disableBeacon: true,
    });
  }

  return { steps, drawerStepIndex };
}

/** Bulle clay custom : progression « 2/9 », Passer discret, Suivant primaire. */
function ClayTooltip({
  index,
  size,
  step,
  isLastStep,
  primaryProps,
  skipProps,
  backProps,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      className="w-[min(360px,calc(100vw-32px))] rounded-clay-lg bg-surface p-5 shadow-clay-lg"
    >
      <p className="font-semibold tabular-nums text-text-subtle" style={{ fontSize: 11.5 }}>
        {index + 1}/{size}
      </p>

      <p className="mt-2 text-pretty leading-relaxed text-text" style={{ fontSize: 14 }}>
        {step.content}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        {!isLastStep ? (
          <button
            {...skipProps}
            title=""
            aria-label="Passer le guide"
            type="button"
            className="rounded-lg px-1 py-1 font-medium text-text-muted underline-offset-2 transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
            style={{ fontSize: 12.5 }}
          >
            Passer
          </button>
        ) : (
          <span aria-hidden />
        )}

        <div className="flex items-center gap-2">
          {index > 0 && (
            <button
              {...backProps}
              title=""
              aria-label="Étape précédente"
              type="button"
              className="rounded-clay px-3 py-2 font-semibold text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
              style={{ fontSize: 13 }}
            >
              Retour
            </button>
          )}
          <ClayButton
            {...primaryProps}
            title=""
            aria-label={isLastStep ? 'Terminer le guide' : 'Étape suivante'}
            variant="primary"
            className="!px-4 !py-2 text-[13px]"
          >
            {isLastStep ? 'Terminer' : 'Suivant'}
          </ClayButton>
        </div>
      </div>
    </div>
  );
}

/** Délai d'ouverture du panneau (animation 225 ms + rendu). */
const DRAWER_OPEN_DELAY = 450;
const DRAWER_CLOSE_DELAY = 250;

interface DashboardTourProps {
  /** Fin de visite (terminée ou passée). */
  onEnd: () => void;
}

export default function DashboardTour({ onEnd }: DashboardTourProps) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const drawerStepIndex = useRef(-1);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // Laisse la page se peindre (cartes lead en fade-in) avant de mesurer les cibles.
    const t = setTimeout(() => {
      const built = buildSteps();
      drawerStepIndex.current = built.drawerStepIndex;
      setSteps(built.steps);
    }, 500);
    return () => {
      clearTimeout(t);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, []);

  if (!steps || steps.length === 0) return null;

  const goTo = (nextIndex: number, fromIndex: number) => {
    const entersDrawer = nextIndex === drawerStepIndex.current;
    const leavesDrawer = fromIndex === drawerStepIndex.current;

    if (entersDrawer) {
      window.dispatchEvent(new Event('priimo-tour:open-lead'));
      transitionTimer.current = setTimeout(() => setStepIndex(nextIndex), DRAWER_OPEN_DELAY);
      return;
    }
    if (leavesDrawer) {
      window.dispatchEvent(new Event('priimo-tour:close-lead'));
      transitionTimer.current = setTimeout(() => setStepIndex(nextIndex), DRAWER_CLOSE_DELAY);
      return;
    }
    setStepIndex(nextIndex);
  };

  const handleCallback = (data: CallBackProps) => {
    const { status, type, action, index } = data;

    if (status === 'finished' || status === 'skipped') {
      // Referme le panneau si la visite se termine pendant l'étape signal.
      window.dispatchEvent(new Event('priimo-tour:close-lead'));
      onEnd();
      return;
    }

    if (type === 'step:after') {
      goTo(action === 'prev' ? index - 1 : index + 1, index);
    } else if (type === 'error:target_not_found') {
      // Cible introuvable (cas limite) : on avance sans bloquer la visite.
      goTo(index + 1, index);
    }
  };

  return (
    <Joyride
      steps={steps}
      stepIndex={stepIndex}
      run
      continuous
      disableOverlayClose
      scrollToFirstStep
      scrollOffset={140}
      spotlightPadding={8}
      floaterProps={{ disableAnimation: reducedMotion }}
      tooltipComponent={ClayTooltip}
      callback={handleCallback}
      styles={{
        options: {
          arrowColor: '#ffffff',
          overlayColor: 'rgba(21, 32, 47, 0.38)',
          zIndex: 90,
        },
        spotlight: {
          borderRadius: 16,
        },
      }}
    />
  );
}
