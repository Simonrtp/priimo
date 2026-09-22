/** Feuille unique : écran (composeur, présentation) et impression Chromium. */

export const AVIS_FONT_FACE_ECRAN = `
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
  background: #FFF7F0;
  color: #0A0D11;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.avis-page {
  --avis-fond: #FFF7F0;
  --avis-encre: #0A0D11;
  --avis-ardoise: #3D5A80;
  --avis-accent: #E8743C;
  --avis-carte: #ffffff;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--avis-fond);
  color: var(--avis-encre);
  padding: 5.2% 5.6% 4.6%;
}
.avis-page--plein { padding: 0; }

@media print {
  html, body { margin: 0; background: #FFF7F0; }
  .avis-page {
    width: 297mm;
    height: 210mm;
    padding: 12mm 14mm 11mm;
    break-after: page;
    break-inside: avoid;
  }
  .avis-page--plein { padding: 0; }
  .avis-no-print { display: none !important; }
}

.avis-titre {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
  text-wrap: balance;
}
.avis-filet {
  display: block;
  width: 2.6rem;
  height: 3px;
  margin: 0.55rem 0 1.05rem;
  background: var(--avis-accent);
  border-radius: 99px;
}
.avis-corps {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 0.85rem;
}
.avis-carte {
  background: var(--avis-carte);
  border-radius: 16px;
  box-shadow: 0 10px 28px -22px rgba(10, 13, 17, 0.28);
  padding: 0.95rem 1.1rem;
  break-inside: avoid;
}
.avis-carte--flex { display: flex; flex: 1; min-height: 0; flex-direction: column; }
.avis-label {
  margin: 0 0 0.2rem;
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--avis-ardoise);
}
.avis-valeur {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--avis-encre);
}
.avis-muted { color: var(--avis-ardoise); }
.avis-grille { display: grid; gap: 0.75rem; }
.avis-grille-2 { grid-template-columns: 1fr 1fr; }
.avis-grille-3 { grid-template-columns: 1fr 1fr 1fr; }
.avis-ligne {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.38rem 0;
  border-bottom: 1px solid rgba(10, 13, 17, 0.06);
}
.avis-ligne:last-child { border-bottom: 0; }
.avis-pastille {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  min-width: 5.2rem;
  padding: 0.45rem 0.65rem;
  border-radius: 12px;
  background: rgba(61, 90, 128, 0.06);
}
.avis-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.avis-table th {
  padding: 0.4rem 0.55rem;
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--avis-ardoise);
  text-align: left;
  border-bottom: 1px solid rgba(10, 13, 17, 0.08);
}
.avis-table td {
  padding: 0.42rem 0.55rem;
  font-variant-numeric: tabular-nums;
  border-bottom: 1px solid rgba(10, 13, 17, 0.04);
}
.avis-table .num { text-align: right; }
.avis-table tbody tr:nth-child(even) { background: rgba(61, 90, 128, 0.045); }
.avis-cta {
  margin: 0;
  max-width: 38rem;
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 1.35;
  text-wrap: pretty;
}
`;

export const AVIS_PRINT_CSS = `${AVIS_FONT_FACE_ECRAN}${AVIS_LAYOUT_CSS}`;
