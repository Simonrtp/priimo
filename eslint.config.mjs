// Configuration ESLint « flat ».
//
// `next lint` a été supprimé dans Next 16 et ESLint 9 ignore les fichiers
// `.eslintrc.*` : sans ce fichier, `npm run lint` ne vérifiait plus rien.
// `eslint-config-next` expose désormais directement des configs plates.

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'awesome-cursorrules/**',
      'awesome-cursor-rules-mdc/**',
      'cursor-plugin/**',
      'saas-boilerplate/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
];
