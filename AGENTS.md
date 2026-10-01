## Learned User Preferences

- Répondre en français. Dans le dashboard, s'adresser à l'agent avec « mes » / « nos », et nommer l'assistant intégré « Mon assistant ».
- Rester dans la charte visuelle déjà en place : coins très arrondis (coque, cartes, footers, recherche mobile en pilule), accent orange existant, même dessin d'un écran à l'autre. Quand le volet d'un lead s'ouvre, assombrir la page sans assombrir le header.
- Une réécriture de la landing ne change que les textes et les metadata. Laisser le JSX, les classes, les animations et l'ordre des sections tels quels, sauf demande explicite.
- Tenir les mentions légales alignées sur le produit actuel, et n'y indiquer que le prénom.
- Dans l'interface, lire les signaux lead via `display_signals` uniquement. Le volet détail est en lignes épurées.
- Travailler dans ce dépôt Next.js. Laisser le dépôt `priimo-pipeline` de côté.
- Séparer le territoire de livraison de l'agence et le secteur du négociateur. Le négociateur dessine et modifie son secteur ; le directeur voit toutes les zones, sans seuil de revisite à configurer.
- Sur le dashboard, mesurer avant d'optimiser. Rendre la navigation instantanée par cache et préchargement à l'intention, sans précharger tous les écrans au démarrage.
- Le mobile est un écran de terrain à part, pas un desktop réduit. Détecter l'appareil côté serveur à partir du user-agent.
- Une note vocale existe seule : les rattachements à un contact ou un bien sont optionnels et peuvent être ajoutés ensuite.
- Les données de démonstration ne concernent que l'agence de test.

## Learned Workspace Facts

- Priimo est le CRM d'agence (pige et terrain) : leads DPE, contacts, carte, estimations et notes vocales. Ce dépôt sert la vitrine et le dashboard Next.js (App Router). L'ingestion et le scoring vivent dans `priimo-pipeline`, qui remplit `leads.display_signals`.
- Auth et données passent par Supabase, session cookie dans `lib/supabase/server.ts`. Les rôles sont `directeur` et `collaborateur`. Sans zone de prospection, le premier login directeur est renvoyé vers l'onboarding.
- Un lead a `owner_type` (`particulier` ou `entreprise`), une classe DPE de A à G et une date de DPE. `internal_signals` reste hors du client.
- La production part de `main` sur github.com/Simonrtp/priimo, se construit sur Vercel et est servie sur priimo.fr. En local, `npm run dev` sert le port 3000.
- Les e-mails transactionnels partent par Resend, domaine priimo.fr déjà vérifié, au nom de Priimo.
- Le callback Google Agenda est `/api/dashboard/integrations/calendar/callback`, en local et sur priimo.fr. L'agent choisit quel agenda connecter.
- L'estimation affiche ses sources en texte seul (DVF / Etalab, indice Notaires–INSEE, cadastre IGN), sans logo d'institution.
