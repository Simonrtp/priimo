/** Gabarit David Valor : variables et page A4. Le HTML des pages reste inline, comme les maquettes. */

export const AVIS_FONT_FACE_ECRAN = `
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap');
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-400-ext.woff2') format('woff2'), url('/fonts/inter-400.woff2') format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/inter-600-ext.woff2') format('woff2'), url('/fonts/inter-600.woff2') format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/inter-700-ext.woff2') format('woff2'), url('/fonts/inter-700.woff2') format('woff2');
}
`;

export const AVIS_LAYOUT_CSS = `
@page { size: A4 landscape; margin: 0; }

.avis-print, .avis-print * { box-sizing: border-box; }
.avis-print {
  margin: 0;
  height: 100%;
  background: #fff;
  color: #0A0D11;
  font-family: 'Open Sans', Inter, system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  counter-reset: avis-folio;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.avis-page {
  --accent: #14AED6;
  --accent-2: #1F6FB5;
  --c-orange: #F7931E;
  --c-green: #6BB02E;
  --c-purple: #4B2E83;
  --c-red: #F0445A;
  --logo: repeating-linear-gradient(135deg, rgba(61,90,128,.16) 0 4px, rgba(61,90,128,.05) 4px 8px);
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #fff;
  color: #0A0D11;
  font-family: 'Open Sans', Inter, system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  counter-increment: avis-folio;
}
.avis-page--plein { padding: 0; }

@media print {
  html, body { margin: 0; background: #fff; }
  .avis-page {
    width: 297mm;
    height: 210mm;
    break-after: page;
    break-inside: avoid;
  }
  .avis-no-print { display: none !important; }
}

.avis-folio { color: #fff; font-weight: 700; }
.avis-folio::after { content: counter(avis-folio); }

/* Reliquats pages hors gabarit 7 (bibliothèque, connectivité…) */
.avis-carte {
  background: #F3F4F6;
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(10, 13, 17, 0.03);
  padding: 16px 20px;
}
.avis-carte--flex { display: flex; flex: 1; min-height: 0; flex-direction: column; }
.avis-label { margin: 0 0 0.2rem; font-size: 10.5px; color: #3D5A80; }
.avis-valeur { margin: 0; font-weight: 600; }
.avis-muted { color: #3D5A80; }
.avis-grille { display: grid; gap: 14px; }
.avis-grille-2 { grid-template-columns: 1fr 1fr; }
.avis-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.avis-table th {
  padding: 0.35rem 0.5rem;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #3D5A80;
  text-align: left;
  border-bottom: 1px solid rgba(61, 90, 128, 0.16);
}
.avis-table td {
  padding: 0.38rem 0.5rem;
  border-bottom: 1px solid rgba(61, 90, 128, 0.08);
}
.avis-table .num { text-align: right; }
.avis-ligne {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.38rem 0;
  border-bottom: 1px solid rgba(61, 90, 128, 0.12);
}
.avis-ligne:last-child { border-bottom: 0; }
.avis-cta { margin: 0; font-size: 21px; font-weight: 600; }
.avis-titre { margin: 0; font-size: 23px; }
.avis-filet { display: none; }
.avis-corps { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 14px; padding: 18px 40px 16px; }
.avis-kicker {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent-2);
}
`;

export const AVIS_PRINT_CSS = `${AVIS_FONT_FACE_ECRAN}${AVIS_LAYOUT_CSS}`;
