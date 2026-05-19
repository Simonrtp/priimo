type LeafletHost = HTMLElement & { _leaflet_id?: number };

/** Retire l’id Leaflet du conteneur pour permettre une réinit (Strict Mode / remontages). */
export function cleanupLeafletContainer(element: HTMLElement | null | undefined): void {
  if (!element) return;

  const nodes: LeafletHost[] = [element as LeafletHost];
  element.querySelectorAll<LeafletHost>('.leaflet-container').forEach((node) => nodes.push(node));

  for (const el of nodes) {
    delete el._leaflet_id;
  }
}
