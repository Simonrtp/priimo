import type { CSSProperties, ReactNode } from 'react';
import { decouperTitre } from '@/lib/rapport/couleurs';
import { formatDateRapport, joindreSansVide, normaliserCouleurSecondaire } from '@/lib/rapport/identite';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import { AVIS_PRINT_CSS } from '@/lib/rapport/print/styles';

export function PrintStyles() {
  return <style dangerouslySetInnerHTML={{ __html: AVIS_PRINT_CSS }} />;
}

const LOGO_PLACEHOLDER: CSSProperties = {
  background: 'var(--logo)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  font: '500 8px/1 ui-monospace, Menlo, monospace',
  letterSpacing: '.12em',
  color: '#3D5A80',
  borderRadius: 4,
};

export function LogoSlot({
  url,
  large,
}: {
  url: string | null;
  large?: boolean;
}) {
  const box: CSSProperties = large
    ? { width: 128, height: 38, ...LOGO_PLACEHOLDER, font: '500 9px/1 ui-monospace, Menlo, monospace', letterSpacing: '.14em' }
    : { width: 84, height: 26, flex: 'none', ...LOGO_PLACEHOLDER };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" style={{ ...box, objectFit: 'contain', background: 'transparent' }} />
    );
  }
  return <div style={box}>LOGO</div>;
}

/** EnTeteV2.dc.html */
export function EnTeteAvis({
  titre,
  logoUrl,
}: {
  titre?: string;
  logoUrl: string | null;
}) {
  const { bold, light } = decouperTitre(titre);
  return (
    <div style={{ height: 72, boxSizing: 'border-box', padding: '22px 40px 0', display: 'flex', flexDirection: 'column', gap: 10, flex: 'none', fontFamily: "'Open Sans', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', gap: 9, fontSize: 23, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '.01em' }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{bold}</span>
          {light ? <span style={{ fontWeight: 300, color: 'var(--accent-2)' }}>{light}</span> : null}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <LogoSlot url={logoUrl} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 160, height: 4, background: 'var(--accent)' }} />
        <div style={{ flex: 1, height: 1, background: 'var(--accent)', opacity: 0.35 }} />
      </div>
    </div>
  );
}

/** PiedDePageV2.dc.html */
export function PiedAvis({ d }: { d: DossierRapport }) {
  const bien = joindreSansVide([d.adresse, d.city], ', ');
  const date = formatDateRapport(d.dateEvaluation);
  return (
    <div style={{ position: 'relative', height: 50, flex: 'none', fontFamily: "'Open Sans', system-ui, sans-serif", fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ position: 'absolute', left: 0, bottom: 0, width: 200, height: 50, background: 'var(--accent)', clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
      <div style={{ position: 'absolute', right: 0, bottom: 0, width: 300, height: 50, background: 'var(--accent)', clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 34, background: 'var(--accent-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '0 40px', fontSize: 10.5, color: 'rgba(255,255,255,.88)' }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {d.agent.nom ? <span style={{ color: '#fff', fontWeight: 700 }}>{d.agent.nom}</span> : null}
          {d.agent.telephone ? <span>{d.agent.telephone}</span> : null}
          {d.agent.email ? <span>{d.agent.email}</span> : null}
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {bien ? <span>{bien}</span> : null}
          {date ? <span>{date}</span> : null}
          <span className="avis-folio" />
        </div>
      </div>
    </div>
  );
}

export const PAGE_V2: CSSProperties = {
  width: '297mm',
  height: '210mm',
  boxSizing: 'border-box',
  background: '#FFFFFF',
  color: '#0A0D11',
  fontFamily: "'Open Sans', system-ui, sans-serif",
  fontVariantNumeric: 'tabular-nums',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
};

export function GabaritPage({
  d,
  titre,
  accent,
  children,
  plein,
}: {
  d: DossierRapport;
  titre?: string;
  accent: string;
  children: ReactNode;
  plein?: boolean;
}) {
  const accent2 = normaliserCouleurSecondaire(d.agence.couleurSecondaire);
  return (
    <section
      className={`avis-page${plein ? ' avis-page--plein' : ''}`}
      style={
        {
          ...PAGE_V2,
          ['--accent']: accent,
          ['--accent-2']: accent2,
        } as CSSProperties
      }
    >
      {plein ? (
        children
      ) : (
        <>
          <EnTeteAvis titre={titre} logoUrl={d.agence.logoUrl} />
          {children}
          <PiedAvis d={d} />
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
    <div>
      <p className="avis-label">{label}</p>
      <p className="avis-valeur">{valeur}</p>
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
