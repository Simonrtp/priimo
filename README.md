# Priimo — Landing page bêta privée

Landing page B2B haute conversion pour **Priimo**, logiciel de prospection
immobilière prédictive. Objectif unique : générer des inscriptions à la bêta
privée.

## Stack

- **Next.js 14** (App Router) — rendu serveur, API routes
- **React 18** + **TypeScript** strict
- **Tailwind CSS 3** — palette orange/bleu personnalisée
- **Google Fonts** via `next/font/google` (**Inter**, weights 400–700)
- **Widget Causio** chargé via `next/script` après hydration (`causio.fr`)
- Aucune dépendance d'UI ou d'animation externe (tout en CSS/JS natif)

## Lancer en local

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

### Scripts disponibles

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (HMR) |
| `npm run build` | Build production (`.next/`) |
| `npm run start` | Sert le build production sur `localhost:3000` |
| `npm run lint` | ESLint (config Next.js) |
| `npm run typecheck` | Vérification TypeScript stricte sans emit |

## Variables d'environnement

Toutes optionnelles — voir [.env.example](./.env.example).

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL publique (canonical, OG, sitemap). Ex : `https://priimo.fr` |
| `BETA_WEBHOOK_URL` | Webhook appelé par `/api/beta` à chaque inscription (Slack, Discord, Make.com, n8n…) |
| `BETA_BLOB_STORE` | Mettre à `1` pour enregistrer **un fichier JSON par inscription** sur [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (trace dans le dashboard, sans base SQL). Nécessite un store Blob lié au projet et `BLOB_READ_WRITE_TOKEN` (injecté par Vercel en prod ; en local, copie depuis le dashboard). Les fichiers ont une URL « publique » techniquement mais un chemin non devinable (`beta-signups/…`) : traitez-les comme des données personnelles. |

En local, copiez `.env.example` vers `.env.local`. Sur Vercel, ajoutez-les
dans **Project → Settings → Environment Variables**.

## Déployer sur Vercel

1. **Importer le repo** sur [vercel.com/new](https://vercel.com/new).
2. Vercel détecte automatiquement Next.js. Un fichier [`vercel.json`](./vercel.json)
   force le preset **Next.js** si la détection automatique échoue.
3. (Facultatif) Renseignez les variables d'environnement listées ci-dessus.
4. Cliquez **Deploy**. Une URL `*.vercel.app` est générée immédiatement.
5. **Domaine custom** : Project → Settings → Domains → ajoutez `priimo.fr`
   et suivez les instructions DNS.

### Erreur : « No Next.js version detected »

Votre [`package.json`](./package.json) contient bien `"next"` dans `dependencies`.
Si Vercel affiche quand même cette erreur, c’est presque toujours l’un des cas suivants :

| Cause | Que faire |
|---|---|
| **Root Directory** incorrect | Dans Vercel : **Project → Settings → General → Root Directory** doit être le dossier qui **contient** `package.json` et `next.config.js`. Laissez **vide** si le repo Git = la racine du projet. Si votre app est dans un sous-dossier (ex. `apps/web`), mettez ce chemin exact. |
| **`package.json` absent du dépôt** | Vérifiez que `package.json` et `package-lock.json` sont bien **commités et poussés** (`git status` ne doit pas les lister comme ignorés). |
| **Repo parent** | Si le dépôt Git contient plusieurs projets, le répertoire racine Git n’a peut‑être pas de `package.json` — configurez **Root Directory** vers le bon sous-dossier. |

Après correction : **Redeploy** (Deployments → … → Redeploy).

## Structure

```
app/
  api/
    beta/route.ts      # Endpoint d'inscription (POST), validation server-side
  globals.css          # Tailwind + utilitaires (boutons, reveal, animations)
  layout.tsx           # Fonts, metadata SEO, viewport, provider modal, widget Causio
  page.tsx             # Assemble toutes les sections dans l'ordre
  robots.ts            # /robots.txt généré (App Router)
  sitemap.ts           # /sitemap.xml généré (App Router)
components/
  Header.tsx                 # Header fixe transparent, blur au scroll
  HeroSection.tsx            # Hero + form inline + visuel
  HeroBackground.tsx         # Fond animé réactif souris
  DashboardMockup.tsx        # Mockup dashboard stylisé
  BetaForm.tsx               # Formulaire (POST /api/beta + validation)
  BetaModal.tsx              # Modale globale (mêmes champs que le form inline)
  BetaModalContext.tsx       # Provider + hook useBetaModal()
  CtaButton.tsx              # Bouton CTA réutilisable
  Reveal.tsx                 # Wrapper IntersectionObserver
  ProblemTransformation.tsx  # Bloc Avant / Avec Priimo
  HowItWorks.tsx             # Section sticky scroll-jacking 01 → 02 → 03
  Features.tsx               # Grid de features
  DataReassurance.tsx        # Bloc conformité RGPD
  FAQ.tsx                    # Accordéon FAQ
  FinalCTA.tsx               # CTA final + footer fusionnés
```

## Inscription bêta : flux complet

1. L'utilisateur remplit le formulaire (hero ou modale) — validation client à
   `onBlur` + à la soumission.
2. `POST /api/beta` (JSON) avec `{ prenom, email, telephone, nomAgence }`.
3. **Server-side** : ré-validation, log structuré (visible dans les logs
   Vercel), enregistrement optionnel **un JSON par inscription** sur Vercel Blob
   (`BETA_BLOB_STORE=1`), forwarding optionnel vers `BETA_WEBHOOK_URL`.
4. Réponse `200 { ok: true }` → état succès inline ; `400 { fields }` → erreurs
   par champ ; `5xx` → message d'erreur générique non bloquant.

Pour brancher un vrai backend (CRM, base de données…) : éditez
[`app/api/beta/route.ts`](./app/api/beta/route.ts) à la place de `console.log` /
Blob / webhook.

## A11y

- Labels `htmlFor`/`id`, `aria-invalid`, `aria-describedby` sur les champs.
- `aria-expanded` sur la FAQ, fermeture modale `Escape` + clic backdrop.
- `prefers-reduced-motion` respecté (animations désactivées).

## Personnalisation rapide

| Donnée | Endroit |
|---|---|
| Couleur d'accentuation | `tailwind.config.ts` → `colors.accent` |
| Compteur "47 agences" | recherche globale `47 agences` |
| Liste prospects mockup | `components/DashboardMockup.tsx` (`PROSPECTS`) |
| Questions FAQ | `components/FAQ.tsx` (`FAQS`) |
| Widget chat Causio | `app/layout.tsx` → `CAUSIO_CONFIG.chatbotId` + URL `widget.js` |
