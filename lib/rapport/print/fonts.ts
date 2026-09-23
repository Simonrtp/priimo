import { readFileSync } from 'fs';
import { join } from 'path';

const FILES: Array<{ file: string; weight: number; ext: boolean }> = [
  { file: 'inter-400.woff2', weight: 400, ext: false },
  { file: 'inter-400-ext.woff2', weight: 400, ext: true },
  { file: 'inter-600.woff2', weight: 600, ext: false },
  { file: 'inter-600-ext.woff2', weight: 600, ext: true },
  { file: 'inter-700.woff2', weight: 700, ext: false },
  { file: 'inter-700-ext.woff2', weight: 700, ext: true },
];

const RANGE_LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const RANGE_EXT =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

function face(family: string, file: string, weight: number, ext: boolean): string {
  const bytes = readFileSync(join(process.cwd(), 'public', 'fonts', file));
  const b64 = bytes.toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${ext ? RANGE_EXT : RANGE_LATIN};}`;
}

/** @font-face en data-URI : Chromium imprime sans réseau. Open Sans = mêmes fichiers (pas d’appel Google). */
export function cssPolicesInterEmbeddees(): string {
  return FILES.flatMap(({ file, weight, ext }) => [
    face('Inter', file, weight, ext),
    face('Open Sans', file, weight, ext),
    ...(weight === 400 ? [face('Open Sans', file, 300, ext)] : []),
  ]).join('');
}
