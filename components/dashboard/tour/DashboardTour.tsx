'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { HelpCircle } from 'lucide-react';
import type { EventData, Step, TooltipRenderProps } from 'react-joyride';
import ClayButton from '@/components/ui/ClayButton';

const Joyride = dynamic(() => import('react-joyride').then((m) => m.Joyride), { ssr: false });

/**
 * Visite guidée du dashboard prospects (8 étapes).
 *
 * Étapes drawer : bulle centrée (jamais coupée) + spotlight custom via un
 * proxy `position: fixed` sur body (Joyride v2 mal positionne le spotlight
 * dans un panneau fixed/transform → bandeau blanc).
 */

type TourStepDef = {
  /** Ancres data-tour candidates (desktop d'abord) — null : bulle centrée. */
  anchors: string[] | null;
  body: ReactNode;
  placement?: Step['placement'];
  /** Nécessite le panneau de détail ouvert. */
  inDrawer?: boolean;
};

const TOUR_PROXY_ID = 'priimo-tour-spotlight-proxy';
const OVERLAY = 'rgba(21, 32, 47, 0.38)';

/** Même icône que le bouton « Revoir le guide » dans la TopBar. */
function GuideRelaunchIcon({ className = '' }: { className?: string }) {
  return (
    <HelpCircle
      size={20}
      strokeWidth={2}
      className={`inline-block shrink-0 align-[-0.25em] text-mute ${className}`}
      aria-hidden
    />
  );
}

const FINALE_BODY = (
  <>
    C&apos;est parti 🚀 Clique sur le bouton <GuideRelaunchIcon /> en haut pour revoir
    l&apos;onboarding.
  </>
);

const STEP_DEFS: TourStepDef[] = [
  {
    anchors: null,
    body: "Chaque lundi, une petite liste sur ton secteur — pas 200 fiches à trier. Des adresses où ça bouge vraiment, et que personne n'a encore travaillées.",
  },
  {
    anchors: ['lead-card'],
    body: "Chaque ligne = une adresse. Le score (0 à 100), c'est à quel point une vente a l'air de se préparer. Tu commences par le haut, tout simplement ;)",
    placement: 'bottom',
  },
  {
    anchors: ['drawer-market', 'drawer-market-mobile'],
    body: "Avant de te la livrer, on vérifie qu'elle n'est sur aucun portail d'annonces. Ce badge = aucune agence ne l'affiche en vente. Terrain libre.",
    inDrawer: true,
  },
  {
    anchors: ['drawer-signals', 'drawer-signals-mobile'],
    body: "Le pourquoi de l'adresse : DPE refait, cascade de ventes dans l'immeuble, société en dissolution… C'est ton angle quand tu sonnes.",
    inDrawer: true,
  },
  {
    anchors: ['drawer-contacts', 'drawer-contacts-mobile'],
    body: "Et voilà le plus utile : le propriétaire (quand c'est une société) + les numéros pros des voisins dans l'immeuble. Eux, tu peux encore les appeler après le 11 août 2026 — contrairement aux particuliers.",
    inDrawer: true,
  },
  {
    anchors: ['drawer-status', 'drawer-status-mobile'],
    body: "Après chaque contact, dis-nous ce que ça a donné : mandat, pas vendeur, injoignable… C'est tout ce qu'on te demande — et ça affine le score sur ton secteur.",
    inDrawer: true,
  },
  {
    anchors: ['whatsapp', 'whatsapp-mobile'],
    body: 'Une question, un retour, une remarque ? Envoie un message WhatsApp directement au fondateur de Priimo — il répond vite.',
    placement: 'right',
  },
  {
    anchors: null,
    body: FINALE_BODY,
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

function ensureTourProxy(): HTMLElement {
  let el = document.getElementById(TOUR_PROXY_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TOUR_PROXY_ID;
    el.setAttribute('data-tour', 'tour-proxy');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:0;margin:0;padding:0;border:0;';
    document.body.appendChild(el);
  }
  return el;
}

function clearTourProxySpotlight() {
  const el = document.getElementById(TOUR_PROXY_ID);
  if (!el) return;
  el.style.boxShadow = 'none';
  el.style.zIndex = '0';
  el.style.width = '0';
  el.style.height = '0';
}

function removeTourProxy() {
  document.getElementById(TOUR_PROXY_ID)?.remove();
}

type MeasureMode = 'auto' | 'contain';

/**
 * Mesure serrée : si le wrapper est un block pleine largeur mais le contenu
 * utile est plus étroit (ex. badge marché), on cadre le contenu.
 * `contain` : garde toute la hauteur visible (étape contacts), sans crop.
 */
function measureTourTarget(root: HTMLElement, mode: MeasureMode = 'auto'): DOMRect {
  const rootRect = root.getBoundingClientRect();
  const display = window.getComputedStyle(root).display;

  // Badge / inline : déjà la bonne boîte.
  if (display === 'inline' || display === 'inline-flex' || display === 'inline-block') {
    return rootRect;
  }

  if (mode === 'contain') {
    // Cadre depuis le haut du bloc jusqu'à la limite viewport (pas de coupe au milieu).
    const available = Math.max(48, window.innerHeight - rootRect.top - 12);
    const height = Math.min(rootRect.height, available);
    return new DOMRect(rootRect.left, rootRect.top, rootRect.width, height);
  }

  // Cherche le plus grand enfant « dense » nettement plus étroit que le wrapper.
  let best: DOMRect | null = null;
  const children = root.querySelectorAll<HTMLElement>(':scope > *');
  for (const child of children) {
    const r = child.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (rootRect.width > r.width + 40 && r.width / rootRect.width < 0.72) {
      if (!best || r.width * r.height > best.width * best.height) best = r;
    }
  }
  if (best) return best;

  // Sections moyennes : limite douce pour éviter un bandeau vertical énorme.
  const maxH = Math.min(rootRect.height, Math.round(window.innerHeight * 0.4));
  if (maxH < rootRect.height - 1) {
    const top = rootRect.top + (rootRect.height - maxH) / 2;
    return new DOMRect(rootRect.left, top, rootRect.width, maxH);
  }
  return rootRect;
}

/**
 * Aligne le proxy sur la vraie cible + halo spotlight (box-shadow).
 * Padding + radius pour un encadrement propre, collé au contenu.
 */
function syncTourProxy(selector: string, withSpotlight: boolean): boolean {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target || target.offsetParent === null) return false;

  // Contacts : on aligne en haut pour tout le bloc (proprio + numéros) entre dans le cadre.
  const isContacts = selector.includes('drawer-contacts');
  target.scrollIntoView({
    block: isContacts ? 'start' : 'center',
    inline: 'nearest',
  });

  const rect = measureTourTarget(target, isContacts ? 'contain' : 'auto');
  if (rect.width < 2 || rect.height < 2) return false;

  const pad = isContacts ? 12 : 10;
  const top = Math.max(8, Math.round(rect.top) - pad);
  const left = Math.max(8, Math.round(rect.left) - pad);
  const width = Math.min(
    Math.round(rect.width) + pad * 2,
    window.innerWidth - left - 8,
  );
  const height = Math.min(
    Math.round(rect.height) + pad * 2,
    window.innerHeight - top - 8,
  );
  const radius = isContacts
    ? 16
    : Math.min(16, Math.round(Math.min(width, height) / 3));

  const proxy = ensureTourProxy();
  proxy.style.top = `${top}px`;
  proxy.style.left = `${left}px`;
  proxy.style.width = `${width}px`;
  proxy.style.height = `${height}px`;
  proxy.style.borderRadius = `${radius}px`;
  proxy.style.background = 'transparent';
  proxy.style.outline = 'none';

  if (withSpotlight) {
    proxy.style.zIndex = '89';
    proxy.style.boxShadow = `0 0 0 2px rgba(255,255,255,0.55), 0 0 0 9999px ${OVERLAY}`;
  } else {
    proxy.style.zIndex = '0';
    proxy.style.boxShadow = 'none';
  }
  return true;
}

type BuiltSteps = {
  steps: Step[];
  drawerStepIndices: Set<number>;
  drawerSelectors: Map<number, string>;
};

function buildSteps(): BuiltSteps {
  const steps: Step[] = [];
  const drawerStepIndices = new Set<number>();
  const drawerSelectors = new Map<number, string>();

  const hasLeads = Boolean(document.querySelector('[data-tour="lead-card"]'));
  const isDesktopDrawer = window.matchMedia('(min-width: 768px)').matches;

  for (const def of STEP_DEFS) {
    if (def.anchors === null) {
      steps.push({
        target: 'body',
        placement: 'center',
        content: def.body,
        skipBeacon: true,
      });
      continue;
    }

    if (def.inDrawer) {
      if (!hasLeads) continue;
      const index = steps.length;
      drawerStepIndices.add(index);
      const anchor = isDesktopDrawer ? def.anchors[0]! : (def.anchors[1] ?? def.anchors[0]!);
      // Marché : le data-tour est sur le libellé Vérifié (en-tête).
      const selector = `[data-tour="${anchor}"]`;
      drawerSelectors.set(index, selector);
      // Bulle centrée = jamais coupée. Overlay Joyride off : spotlight = proxy.
      steps.push({
        target: 'body',
        placement: 'center',
        content: def.body,
        skipBeacon: true,
        skipScroll: true,
        hideOverlay: true,
        arrowColor: 'transparent',
        zIndex: 100,
      });
      continue;
    }

    const el = findVisibleAnchor(def.anchors);
    if (!el) continue;
    steps.push({
      target: el,
      placement: def.placement ?? 'auto',
      content: def.body,
      skipBeacon: true,
    });
  }

  return { steps, drawerStepIndices, drawerSelectors };
}

/** Bulle clay custom : progression « 2/8 », Passer discret, Suivant primaire. */
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
      className="w-[min(360px,calc(100vw-32px))] max-h-[min(70dvh,480px)] overflow-y-auto rounded-clay-lg bg-surface p-5 shadow-clay-lg"
    >
      <p className="font-semibold tabular-nums text-text-subtle" style={{ fontSize: 11.5 }}>
        {index + 1}/{size}
      </p>

      <div className="mt-2 text-pretty leading-relaxed text-text" style={{ fontSize: 14 }}>
        {step.content}
      </div>

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

const DRAWER_OPEN_DELAY = 520;
const DRAWER_CLOSE_DELAY = 250;

interface DashboardTourProps {
  onEnd: () => void;
}

export default function DashboardTour({ onEnd }: DashboardTourProps) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const drawerStepIndices = useRef<Set<number>>(new Set());
  const drawerSelectors = useRef<Map<number, string>>(new Map());
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    ensureTourProxy();
    const t = setTimeout(() => {
      const built = buildSteps();
      drawerStepIndices.current = built.drawerStepIndices;
      drawerSelectors.current = built.drawerSelectors;
      setSteps(built.steps);
    }, 500);
    return () => {
      clearTimeout(t);
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      removeTourProxy();
    };
  }, []);

  // Spotlight proxy pendant les étapes drawer + resync au scroll.
  useEffect(() => {
    if (!steps) return;
    const selector = drawerSelectors.current.get(stepIndex);
    if (!selector) {
      clearTourProxySpotlight();
      return;
    }

    const sync = () => {
      syncTourProxy(selector, true);
    };
    sync();
    window.addEventListener('resize', sync);
    document.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      document.removeEventListener('scroll', sync, true);
    };
  }, [stepIndex, steps]);

  if (!steps || steps.length === 0) return null;

  const needsDrawer = (index: number) => drawerStepIndices.current.has(index);

  const prepareDrawerStep = (index: number): boolean => {
    const selector = drawerSelectors.current.get(index);
    if (!selector) return true;
    return syncTourProxy(selector, true);
  };

  const goTo = (nextIndex: number, fromIndex: number) => {
    const entersDrawer = needsDrawer(nextIndex) && !needsDrawer(fromIndex);
    const leavesDrawer = !needsDrawer(nextIndex) && needsDrawer(fromIndex);
    const staysInDrawer = needsDrawer(nextIndex) && needsDrawer(fromIndex);

    if (entersDrawer) {
      window.dispatchEvent(new Event('priimo-tour:open-lead'));
      transitionTimer.current = setTimeout(() => {
        if (!prepareDrawerStep(nextIndex)) {
          goTo(nextIndex > fromIndex ? nextIndex + 1 : nextIndex - 1, fromIndex);
          return;
        }
        setStepIndex(nextIndex);
      }, DRAWER_OPEN_DELAY);
      return;
    }

    if (leavesDrawer) {
      clearTourProxySpotlight();
      window.dispatchEvent(new Event('priimo-tour:close-lead'));
      transitionTimer.current = setTimeout(() => setStepIndex(nextIndex), DRAWER_CLOSE_DELAY);
      return;
    }

    if (staysInDrawer) {
      if (!prepareDrawerStep(nextIndex)) {
        goTo(nextIndex > fromIndex ? nextIndex + 1 : nextIndex - 1, fromIndex);
        return;
      }
      transitionTimer.current = setTimeout(() => setStepIndex(nextIndex), 40);
      return;
    }

    clearTourProxySpotlight();
    setStepIndex(nextIndex);
  };

  const handleEvent = (data: EventData) => {
    const { status, type, action, index } = data;

    if (status === 'finished' || status === 'skipped') {
      clearTourProxySpotlight();
      window.dispatchEvent(new Event('priimo-tour:close-lead'));
      removeTourProxy();
      onEnd();
      return;
    }

    if (type === 'step:after') {
      goTo(action === 'prev' ? index - 1 : index + 1, index);
    } else if (type === 'error:target_not_found') {
      goTo(index + 1, index);
    }
  };

  return (
    <Joyride
      steps={steps}
      stepIndex={stepIndex}
      run
      continuous
      scrollToFirstStep
      tooltipComponent={ClayTooltip}
      onEvent={handleEvent}
      options={{
        overlayClickAction: false,
        arrowColor: '#ffffff',
        overlayColor: OVERLAY,
        zIndex: 90,
        spotlightPadding: 8,
        spotlightRadius: 16,
        scrollOffset: 140,
        skipBeacon: true,
        scrollDuration: reducedMotion ? 0 : 300,
      }}
    />
  );
}
