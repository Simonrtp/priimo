'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Cadre d’aperçu : la page 297×210 mm est réduite pour tenir entière. */
export default function CadreAvisA4({ children }: { children: ReactNode }) {
  const cadre = useRef<HTMLDivElement>(null);
  const feuille = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const box = cadre.current;
    const page = feuille.current;
    if (!box || !page) return;
    const sync = () => {
      const pw = page.offsetWidth;
      const bw = box.clientWidth;
      setScale(pw > 0 && bw > 0 ? bw / pw : 0);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={cadre} className="relative h-full w-full overflow-hidden">
      <div
        ref={feuille}
        className="avis-print origin-top-left"
        style={{
          width: '297mm',
          height: '210mm',
          transform: `scale(${scale})`,
          visibility: scale > 0 ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
