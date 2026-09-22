import type { ReactNode } from 'react';
import { AVIS_PRINT_CSS } from '@/lib/rapport/print/styles';

export function PrintStyles() {
  return <style dangerouslySetInnerHTML={{ __html: AVIS_PRINT_CSS }} />;
}

export function GabaritPage({
  titre,
  accent,
  children,
  plein,
}: {
  titre?: string;
  accent: string;
  children: ReactNode;
  plein?: boolean;
}) {
  return (
    <section
      className={`avis-page${plein ? ' avis-page--plein' : ''}`}
      style={{ ['--avis-accent' as string]: accent }}
    >
      {plein ? (
        children
      ) : (
        <>
          {titre ? (
            <header>
              <h1 className="avis-titre">{titre}</h1>
              <span className="avis-filet" aria-hidden />
            </header>
          ) : null}
          <div className="avis-corps">{children}</div>
        </>
      )}
    </section>
  );
}

export function Carte({ children, flex }: { children: ReactNode; flex?: boolean }) {
  return <div className={`avis-carte${flex ? ' avis-carte--flex' : ''}`}>{children}</div>;
}

export function Fait({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <p className="avis-label">{label}</p>
      <p className="avis-valeur">{valeur}</p>
    </div>
  );
}

export function Pastille({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="avis-pastille">
      <p className="avis-label">{label}</p>
      <p className="avis-valeur" style={{ fontSize: '0.95rem' }}>
        {valeur}
      </p>
    </div>
  );
}

export function LigneFait({
  icone,
  label,
  valeur,
}: {
  icone: ReactNode;
  label: string;
  valeur: string;
}) {
  return (
    <div className="avis-ligne">
      <span className="avis-muted" aria-hidden style={{ display: 'inline-flex' }}>
        {icone}
      </span>
      <span className="avis-label" style={{ margin: 0, flex: 1 }}>
        {label}
      </span>
      <span className="avis-valeur" style={{ fontSize: '0.88rem' }}>
        {valeur}
      </span>
    </div>
  );
}
