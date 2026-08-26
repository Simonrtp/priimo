/**
 * Empêche le tap qui ferme un calque d'atteindre ce qui est dessous.
 *
 * Sur iOS / Chrome mobile, pointerdown sur un overlay qui se démonte
 * déclenche ensuite un `click` sur l'élément désormais sous le doigt
 * (lien de nav, carte, bouton). Ce module est la garde unique :
 * 1. capture en phase capture + preventDefault
 * 2. bouclier transparent ~450 ms au-dessus de tout
 */

const SHIELD_MS = 450;
const SHIELD_Z = '2147483000';

let shieldEl: HTMLDivElement | null = null;
let shieldTimer: number | null = null;

export function armPointerShield(ms: number = SHIELD_MS): void {
  if (typeof document === 'undefined') return;
  if (!shieldEl) {
    shieldEl = document.createElement('div');
    shieldEl.setAttribute('aria-hidden', 'true');
    shieldEl.setAttribute('data-pointer-shield', 'true');
    shieldEl.style.cssText = [
      'position:fixed',
      'inset:0',
      `z-index:${SHIELD_Z}`,
      'touch-action:none',
      'cursor:none',
    ].join(';');
  }
  document.body.appendChild(shieldEl);
  if (shieldTimer != null) window.clearTimeout(shieldTimer);
  shieldTimer = window.setTimeout(() => {
    shieldEl?.remove();
    shieldTimer = null;
  }, ms);
}

export function shouldDismissOutside(root: Node | null, target: EventTarget | null): boolean {
  if (!root) return false;
  if (!(target instanceof Node)) return true;
  return !root.contains(target);
}

export function listenOutsideDismiss(getRoot: () => Node | null, onClose: () => void): () => void {
  function onPointer(e: PointerEvent) {
    if (!shouldDismissOutside(getRoot(), e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    onClose();
    armPointerShield();
  }

  document.addEventListener('pointerdown', onPointer, true);
  return () => document.removeEventListener('pointerdown', onPointer, true);
}
