# Priimo — Contexte projet complet

> Document de référence du projet Priimo. Toute IA travaillant sur ce projet doit charger ce fichier en premier pour comprendre le produit, la vision, la stratégie data, et l'état actuel.

---

## 1. Pitch en une phrase

> **Priimo détecte les propriétaires qui vont vendre leur bien avant même qu'ils ne soient sur le marché, grâce au croisement intelligent des données publiques françaises et à un scoring prédictif propriétaire.**

Le produit est un SaaS B2B vendu aux agences immobilières françaises sous forme d'abonnement mensuel. Chaque agence dispose d'un territoire géographique et reçoit une liste de prospects ultra-qualifiés à contacter en priorité.

---

## 2. Origine du projet

Priimo est le deuxième projet SaaS de son fondateur. Le premier — **Causio** (un chatbot IA pour sites d'agences immobilières) — a permis de comprendre le métier d'agence et d'identifier une demande systématique et unanime du marché.

Lors des appels de prospection pour Causio, **tous les directeurs d'agence sans exception ont verbalisé le même besoin** :

> *"Ce qu'il nous faut vraiment, c'est un outil pour trouver des vendeurs."*

Ce signal répété, ont déclenché le pivot vers Priimo.

Causio reste actif en maintenance mais ne représente plus du tout la priorité. Priimo concentre 100 % du temps de développement.

---

## 3. Vision long terme

À 3 ans, Priimo doit devenir **le standard français de la prospection immobilière prédictive** — l'outil que tout directeur d'agence indépendante utilise par défaut, comme aujourd'hui ils utilisent SeLoger pour la diffusion.

La vision n'est pas de devenir un CRM tout-en-un ni de concurrencer les portails. Priimo doit rester focalisé sur **une seule chose qu'il fait mieux que tout le monde** : identifier les futurs vendeurs avant qu'ils ne soient sur le marché.

À terme, la défensibilité repose sur quatre piliers :
1. **L'utuilisation de données privées pour qualifié les leads (déces, mutation, divorce/marriage, successions). 
2. **La précision du scoring** auto-amélioré par machine learning sur les conversions réelles
3. **L'effet réseau** : plus d'agences clientes = plus de feedback = scoring plus précis
4. **Le module SCI/SARL premium** (killer feature légalement défendable, voir section 11)

---

## 4. Le problème résolu

### 4.1 Le contexte du marché

Les agences immobilières françaises font face à une crise structurelle de la prospection vendeurs :

- **La pige téléphonique est interdite depuis août 2025** — c'était historiquement le canal n°1 de prospection sortante
- **Le porte-à-porte à l'aveugle à été largement abandonné depuis le Covid**, surtout en zones urbaines
- **Les portails (SeLoger, MeilleursAgents) coûtent 500 à 1500 €/mois** par agence et fournissent des leads en aval (propriétaires déjà actifs, donc déjà sollicités par toute la concurrence)
- **1 232 agences ont fermé en France en 2024**, signe d'une pression croissante

### 4.2 Pourquoi maintenant

Trois facteurs créent une fenêtre d'opportunité maintenant :
1. **L'interdiction de la pige** crée une urgence non adressée
2. **Les bases de données publiques sont matures** (DVF depuis 2014, DPE refait sur toute la France)
3. **Les outils de scoring deviennent abordables** grâce aux infrastructures cloud bon marché

---

## 5. La solution Priimo

### 5.1 Ce que Priimo fait

Concrètement, chaque semaine, chaque agence cliente reçoit une **liste de 15 à 30 prospects vendeurs ULTRA-qualifiés** sur son territoire exclusif. Pour chaque prospect, elle voit :

- L'adresse précise du bien
- Un score de probabilité de vente sur 100
- Les signaux détectés qui ont déclenché le scoring (ex : DPE refait il y a 2 mois, détenu depuis 9 ans, dissolution SCI en cours, divorcé (invisible juste pour le scoring ), succession, déces etc)
- Le contexte du bien (type, surface, date d'achat, prix d'achat, valeur estimée, plus-value)
- Un statut modifiable (nouveau, contacté, intéressé, pas intéressé)
- Un espace pour ajouter des notes
- **Pour les biens détenus en SCI/SARL : le nom du dirigeant + son téléphone professionnel + son email professionnel** (voir section 11)

L'agence peut exporter la liste filtrée en CSV et ouvrir chaque adresse dans Google Maps (bouton **Maps** sur la fiche). Une **vue carte interactive** de tous les prospects est prévue mais pas encore livrée (placeholder « bientôt »).

### 5.2 Ce que Priimo N'est PAS

- ❌ Un CRM (pas de gestion mandats / transactions)
- ❌ Un outil de pige (pas de surveillance des annonces en ligne — en MVP)
- ❌ Un portail d'annonces ni un concurrent de SeLoger
- ❌ Un outil de nurturing ou d'emailing automatisé
- ❌ Un logiciel tout-en-un

### 5.3 Positionnement complémentaire

Priimo ne remplace pas SeLoger ni MeilleursAgents. C'est une **source supplémentaire** de leads, mais en amont du marché — pas en aval comme les portails. Ce positionnement évite la résistance au changement et permet une coexistence avec les outils déjà en place.

### 5.4 La promesse stricte

Priimo promet **15-30 leads ultra-qualifiés par mois minimum, jamais plus**. Le produit refuse explicitement la promesse du volume, qui a brûlé le marché (cf. Realadvisor : 30 leads promis, 5 livrés en 6 mois → client perdu).

---

## 6. Le marché

### 6.1 Taille

- **~30 000 agences immobilières** en France
- 70 % sont des indépendantes (1–10 agents)
- 25 % sont en franchise (Century 21, Laforêt, Orpi, Guy Hoquet…)
- **~45 000 mandataires indépendants** (IAD, Capifrance…) — **cible secondaire valide**

### 6.2 Taux d'équipement actuel

- **30 à 40 %** des agences utilisent un outil de prospection dédié
- **60 à 70 %** fonctionnent encore manuellement (Excel, papier, ou aucun outil)
- Les TPE 1 à 3 agents sont le **marché adressable principal non équipé**

### 6.3 TAM (Total Addressable Market)

Calcul indicatif : 30 000 agences × 200 €/mois × 12 mois = **72 M€/an**

Marché adressable réel (en excluant les réseaux déjà liés à des solutions intégrées) : entre 35 et 50 M€/an.

Marché potentiel mandataires : 45 000 × 79 €/mois × 12 = **42,6 M€/an supplémentaires** (cible secondaire).

### 6.4 Profil client idéal (ICP)

**ICP principal — Directeur d'agence indépendante**
- 2 à 10 agents
- Zone urbaine dense (Paris, Lyon, Bordeaux, Marseille, Lille, Nantes, Toulouse, Strasbourg)
- Paie déjà 500+ €/mois en outils digitaux (SeLoger, MeilleursAgents)
- A été déçu par un outil de prospection (Realadvisor, Maline) OU n'en a jamais eu
- **N'est PAS le profil "agence installée depuis 30 ans, ne prospecte plus"** (ce profil existe mais ne convertira pas)

**ICP secondaire — Mandataire indépendant**
- Travaille seul ou en petite équipe (IAD, Capifrance, SAFTI, Megagence…)
- Décide seul de ses outils (pas de validation hiérarchique)
- Plus facile à joindre (téléphone direct, pas de standard)
- Plan "Solo" à explorer : 59-79 €/mois

---

## 7. Les concurrents

### 7.1 Concurrents directs

| Outil | Prix | Force | Faiblesse |
|-------|------|-------|-----------|
| **Maline.io** | 200 à 400 €/mois | Seul vrai prédictif (1500+ agences). Territoire exclusif. App mobile. | Très complexe, coûteux. *"Super outil pour qui l'exploite complètement"*. |
| **Telescop.com** | Par département | Base de données la plus dense (11M maisons, 5,7M téléphones — mais d'entreprises, pas de particuliers). Envoi de courriers intégré. | Outil de BDD, pas de scoring prédictif fort. Dense et multi-profils → complexe. |
| **Klape.io** | Non public | OpenData + comportements web. Leads contractuels garantis. Kanban. | Très jeune, peu de retours en circulation. |
| **Realty.fr** (Groupe Realty) | 79 €/mois | Tout-en-un : CRM + pige + site + signature. | Pas un générateur de leads prédictif. La prospection est un module annexe. |
| **Realtys.pro** | 19 €/mois | Ultra-simple. DVF + DPE + Cadastre. | Trop basique, pas de scoring avancé, pas de pilotage d'équipe. |
| **Cadastre.gouv.fr** | Gratuit | Accès officiel aux données cadastrales (parcelles, propriétaires, limites foncières). Référence légale. | Aucune interface métier, pas de scoring, pas d'exploitation commerciale directe. Données brutes uniquement. |

### 7.2 Concurrents identifiés par les agences interviewées

- **Realadvisor** — utilisé par De Lachaise, abandon prévu (5 leads livrés / 30 promis en 6 mois). **Anti-pattern à ne pas reproduire.**
- **Taktikimmo** — utilisé par Conseil Rive Gauche, satisfait.
- **Jinka** — cité comme référence de centralisation.
- **Logic-Immo** — cité pour les leads qualifiés.
- **Immofacile** — utilisé par FREDELION en multicanal.
- **Cadastre** 

### 7.3 La position de Priimo

Le vide à occuper :
- Rigueur data de Maline + simplicité de Realtys.pro
- **Signaux de vie + module SCI/SARL comme vrai différenciateur**
- Prix accessible (100 à 349 €/mois selon le module)
- Territoire exclusif
- Scoring auto-amélioré par ML (à terme)

**Aucun concurrent n'occupe cette position aujourd'hui.**

---

## 8. Validation terrain — 6 discovery calls réalisés

### 8.1 Synthèse

| # | Agence | Outils actuels | Verdict | Insight clé |
|---|--------|----------------|---------|-------------|
| 1 | **Côté Particulier** (Paris St-Marcel) | Aucun | 🔥 Très intéressée | Validation simultanée territoire privé + scoring + signaux de vie. Veut un essai 1 mois gratuit. |
| 2 | **De Lachaise Immobilier** | Realadvisor (insatisfait) | 🟢 Intéressé si efficace | Brûlé par Realadvisor (5 leads / 30 promis). Veut nom + tel + adresse + contexte. |
| 3 | **Laforêt Paris** | SeLoger + MeilleursAgents premium | 🟡 Informatif | **Les directeurs paient les outils, pas le siège franchise**. Porte-à-porte abandonné post-Covid. |
| 4 | **Conseil Rive Gauche** (Paris 13) | Taktikimmo + portails (1000 €/mois) | 🟢 Intéressé | **A cité 200 €/mois spontanément** comme prix raisonnable. Agence familiale, ~10 actions de prospection/mois. |
| 5 | **Laforêt Paris 17e** | LeBonCoin + portails | ⚠️ Profil installé | Ne prospecte plus, peu d'intérêt. Profil non prioritaire. |
| 6 | **FREDELION** (Paris 8) | SeLoger + MeilleursAgents + Immofacile | 🔥 Très intéressé | *"Les DPE et la DVF sont déjà exploités par la concurrence. La vraie valeur ajoutée, c'est repérer les moments de bascule dans la vie des gens."* |
| 7 | **Biens de Famille** (Paris 8e) | Cadastre (satisfait) + LeBonCoin + PAP + pige | 🔥 Très intéressé | **Cadastre validé comme meilleur outil actuel**. Signaux succession/décès/divorce = top priorité. Feedback pricing : éviter le par-utilisateur, préférer forfait unique. |

### 8.2 Les 7 enseignements majeurs validés

**1. Les signaux de vie personnels sont LE différenciateur, pas DVF/DPE.**
Trois agences l'ont confirmé indépendamment (FREDELION, Biens de Famille, Côté Particulier). DVF + DPE = hygiène. Événements de vie (succession, décès, divorce, mutation) = valeur.

**2. Qualité > Quantité, toujours.**
*"15 leads ultra pertinents par mois, pas du volume."* (Côté Particulier).

**3. Chaque lead doit contenir 4 infos minimum.**
Nom + téléphone + adresse précise + contexte du bien.

**4. Le territoire exclusif rassure.**
Mentionné spontanément par Côté Particulier.

**5. Le prix de référence du marché est ~200 €/mois.**
Conseil Rive Gauche l'a cité spontanément.

**6. L'essai gratuit 1 mois est le meilleur levier de conversion.**

**7. Le porte-à-porte n'est PAS universel.**
Abandonné par plusieurs agences post-Covid. L'app mobile n'est pas une priorité MVP.

**8. Les signaux de vie personnels (décès, succession, divorce) sont les plus efficaces.**
Biens de Famille (30 ans d'expérience) confirme : *"Succession décès marche très bien, divorce, mutation. C'est des données extrêmement intéressantes."* Ces signaux doivent être au cœur du scoring, au-dessus même de DVF/DPE.

### 8.3 Ce qui a été INVALIDÉ par les calls

- L'app mobile dans le MVP (aucune mention spontanée)
- Le module dispatch / équipe dans le MVP (aucune mention spontanée)
- Le porte-à-porte comme canal principal
- DVF + DPE seuls comme proposition de valeur (insuffisant)

### 8.4 Le point à surveiller

Sur les 6 appels, 4 agences ont exprimé un intérêt explicite. **Mais aucune n'a encore signé.** L'intérêt verbal n'est pas une validation suffisante. La priorité absolue est maintenant d'obtenir des **pré-ventes via Calendly**.
**Cadastre est le concurrent de référence pour les agences satisfaites.** Biens de Famille (très expérimenté, 30 ans métier) l'utilise et en est satisfait. Notre différenciation vs Cadastre : scoring prédictif (eux = base de données brute) + signaux de vie enrichis (succession, divorce) + module SCI premium avec dirigeants. Prix équivalent mais valeur supérieure.
---

## 9. Architecture du produit

### 9.1 Vue d'ensemble fonctionnelle

L'application web (Next.js) se compose de **trois zones** pour le MVP en cours :

**Page 1 — Prospects (`/dashboard`)**
- 3 onglets segment : **Entreprises** (SCI/SARL), **Particuliers**, **Tous** (compteurs par onglet)
- 3 KPI en haut : **leads ultra chauds cette semaine** (score ≥ 80), **score moyen**, **leads actifs** (statuts non terminés)
- **Filtres rapides** (chips animés) : Tous, Ultra chaud, Chaud, Passoire thermique, DPE récent, Détention 5-9 ans
- **Filtres avancés** (barre desktop + sheet mobile) : score min, type de signal, statut, assigné à (directeur)
- Bascule **Liste / Carte** : liste opérationnelle ; carte = placeholder « fonctionnalité qui arrive bientôt »
- Liste : adresse, badge chaleur (Ultra chaud / Chaud / Tiède), détention, signaux (résumé « + X signaux »), statut inline
- Actions : **export CSV** (directeur), compteur de résultats filtrés

Au clic sur un prospect :
- **Desktop** : panneau latéral (drawer) ~480px
- **Mobile** : écran plein dédié

Contenu fiche prospect :
- Adresse + bouton **Maps** (Google Maps) ; score en anneau + badge chaleur
- **SCI/SARL** : bloc entreprise (société, dirigeant, téléphone, email pro)
- Signaux détectés (liste détaillée avec points)
- Contexte bien : type, surface, DPE, détention, prix d'achat, valeur estimée, plus-value (tooltip explicatif)
- Statut, notes, assignation (directeur), suppression du lead (avec confirmation)
- Champ `ml_feedback` en base pour le futur ML — **pas d'UI feedback ML** dans le drawer actuellement

**Page 2 — Onboarding directeur (`/onboarding`)**
- Obligatoire tant que la zone de prospection n'est pas configurée (adresse centre BAN + rayon 1–15 km, défaut 2 km)
- Étapes : identité agence (nom, téléphone, email) puis zone (autocomplete adresse + slider rayon)
- Redirection automatique depuis le middleware si zone incomplète

**Page 3 — Paramètres (`/dashboard/settings`)**
- Onglets **directeur** : Mon agence, Mon équipe, Abonnement, Notifications, Mon profil, Sécurité
- Onglets **collaborateur** : Mon profil, Notifications, Sécurité
- **Mon agence** : nom, coordonnées, zone (même logique que l'onboarding)
- **Mon équipe** : membres, invitations collaborateur (email → lien `/invite`), révocation / renvoi
- **Abonnement** : affichage plan (Stripe customer id en BDD — intégration paiement à compléter)
- **Notifications** : préférences JSON (`profiles.preferences`)
- **Sécurité** : changement mot de passe, déconnexion

### 9.2 Navigation persistante

Une sidebar verticale (desktop) ou bottom bar (mobile) avec :
- Logo Priimo
- Lien "Prospects"
- Lien "Paramètres"
- Lien "Écrire au fondateur" (WhatsApp)
- Bloc utilisateur : nom agence + plan + progression leads

### 9.3 Philosophie UX

- **Zéro formation** — opérationnel en 20 minutes maximum
- **Compréhensible en 10 secondes** par un directeur d'agence de 55 ans
- **Densité contrôlée** — beaucoup d'infos utiles, jamais d'encombrement visuel
- **Hiérarchie forte du score** — le score est l'information la plus importante
- **Différenciation visuelle des leads SCI** — badge distinct pour les biens avec coordonnées dirigeant

### 9.4 Architecture technique du code (état Mai 2026)

```
priimo/  (repo Next.js — package `priimo-landing`)
├── app/                          # App Router Next.js 16
│   ├── page.tsx                  # Landing marketing + CTA Calendly
│   ├── login/                    # Connexion Supabase Auth
│   ├── invite/                   # Acceptation invitation (?token=)
│   ├── onboarding/               # Configuration zone agence (directeur)
│   ├── dashboard/
│   │   ├── page.tsx              # Prospects (SSR → ProspectsClient)
│   │   ├── settings/             # Paramètres agence / équipe / profil
│   │   └── overview/             # Redirige vers /dashboard
│   └── api/
│       ├── onboarding/           # PATCH zone + infos agence
│       ├── create-director/      # Création compte depuis invitation directeur
│       ├── create-collaborator/  # Création compte depuis invitation collaborateur
│       ├── invitations/          # Inviter / renvoyer / supprimer (directeur)
│       ├── team/                 # Gestion membres équipe
│       └── auth/signout/
├── components/dashboard/         # UI métier prospects, drawer, filtres, settings
├── lib/
│   ├── supabase/                 # client browser, server, admin (service_role)
│   ├── queries/leads.ts          # fetchLeads, updateLead, deleteLead
│   ├── auth/                     # getServerUser, onboarding, requireDirector
│   ├── ban.ts                    # Autocomplete + géocodage Base Adresse Nationale
│   └── lead-display.ts           # Filtres rapides, badges chaleur, libellés détention
├── types/                        # lead.ts, database.ts (alignés Supabase)
├── middleware.ts                 # Auth guard /dashboard, redirect /onboarding
└── supabase/
    ├── schema.sql                # agencies, profiles, invitations + RLS leads
    └── migrations/               # ex. delete RLS leads, colonnes lat/lng
```

**Flux données prospects :**
1. `app/dashboard/page.tsx` charge l'utilisateur (`getServerUser`) + `fetchLeads(supabase)` côté serveur
2. `ProspectsClient` (client) filtre en mémoire (onglet, filtres, quick filters)
3. Modifications (statut, notes, assignation, suppression) → `updateLead` / `deleteLead` via client Supabase (RLS par `agency_id`)

**Multi-tenant :** chaque lead appartient à une `agency_id` ; les policies RLS limitent SELECT/UPDATE/DELETE à l'agence du profil connecté.

**Pages publiques (sans session) :** `/`, `/login`, `/invite`, `/cgu`, `/api/beta`.

---

## 10. ⚖️ Cadre légal RGPD — section critique

Cette section conditionne toute la stratégie data du produit. **Aucune feature ne contournera ces règles.**

### 10.1 Le distingo fondamental : personnes physiques vs personnes morales

C'est LA distinction qui structure tout le produit.

| Type de propriétaire | Bien + Score | + NOM | + TÉLÉPHONE |
|----------------------|--------------|-------|-------------|
| **Personne morale (SCI/SARL)** | ✅ Légal | ✅ Légal | ✅ Légal (téléphone pro) |
| **Personne physique** | ✅ Légal | ⚠️ Gris RGPD | ❌ Illégal pour prospection |

### 10.2 Pour les particuliers — ce qui est interdit

**Le RGPD interdit pour la prospection commerciale :**
- Croiser nom + téléphone personnel + adresse + données comportementales
- Constituer un fichier de particuliers avec leurs données personnelles sans consentement
- Révéler le "pourquoi" personnel d'une sélection (divorce, succession, etc.)

**Conséquences d'une violation :**
- Sanctions CNIL : jusqu'à 4 % du CA mondial ou 20 M€
- Cas réels : Carrefour 2,2 M€, Hertz France 40 M€
- Pour Simon : fin immédiate du projet + dette personnelle

**Règle absolue :** ne jamais afficher pour un particulier autre chose que l'adresse + score + signaux génériques + contexte du bien.

### 10.3 Pour les SCI/SARL — tout est légal

**Pourquoi les personnes morales n'ont pas droit à la vie privée RGPD :**
- Elles sont des entités commerciales, leurs données sont publiques par nature
- Pappers, Sirene, INSEE diffusent ces données légalement
- BODACC publie obligatoirement leurs événements (dissolution, liquidation, cession)

**Données légales et exploitables :**
- ✅ Nom de la SCI/SARL
- ✅ Nom des dirigeants et associés
- ✅ Téléphone professionnel
- ✅ Email professionnel
- ✅ Adresse du siège + adresse des biens détenus
- ✅ Événements de vie : dissolution, liquidation, cession de parts, changement de gérant, décès d'un associé
- ✅ Historique complet des modifications statutaires

### 10.4 Stratégie de présentation des signaux

Pour rester safe RGPD même avec les particuliers, voici la règle :

**Mauvaise approche (illégale) :**
> *"Madame Dupont a divorcé, contactez-la au 06.XX"*

**Bonne approche (légale) :**
> *"12 rue X — Score 87/100 — Très haute probabilité de vente dans les 6 prochains mois"*

L'agence ne reçoit pas le "pourquoi personnel". Elle reçoit un **score statistique anonymisé** et une **adresse à prospecter** (porte-à-porte ou courrier ciblé). Mme Dupont elle-même décide de répondre ou pas.

### 10.5 Audit RGPD prévu en phase 2

À partir du mois 4, prévoir un audit RGPD avec un avocat spécialisé immobilier (coût ~2000-3000 €) pour :
- Valider le pipeline data
- Préparer les mentions légales utilisateurs
- Préparer les CGU/CGV
- Préparer un Privacy Policy béton

---

## 11. ⭐ Module SCI/SARL Premium — le killer feature

C'est la pépite stratégique de Priimo. **Aucun concurrent ne le fait correctement aujourd'hui.**

### 11.1 Taille du marché SCI/SARL

- **20 à 30 %** des biens immobiliers en France
- À Paris intra-muros : **35 à 45 %**
- Sur les grandes métropoles : 25-40 %
- Sur l'immobilier d'investissement locatif : **60-70 %**

C'est un marché massif et **structurellement plus rentable** pour les agences (biens souvent plus chers, commissions plus élevées).

### 11.2 Pipeline data complet pour SCI/SARL

```
ÉTAPE 1 — Identification des biens en SCI
─────────────────────────────────────────
DVF contient un champ "nature acquéreur" qui distingue 
personne physique / morale.
→ Filtre : on isole les acquisitions par personnes morales.

ÉTAPE 2 — Identification du propriétaire
─────────────────────────────────────────
Le DVF nous donne uniquement "personne morale" sans nom.
Cadastre (cadastre.data.gouv.fr) → identité de la SCI 
propriétaire de la parcelle.
Coût : ~5-10 €/fiche en mode automatique, à optimiser.

ÉTAPE 3 — Enrichissement Pappers
─────────────────────────────────
API Pappers (~0,02 €/requête) → on récupère :
  • Nom officiel de la SCI/SARL
  • Capital social
  • Adresse du siège
  • Nom du ou des dirigeants
  • Date de nomination
  • Téléphone professionnel (souvent renseigné)
  • Email professionnel (parfois renseigné)
  • Statut juridique actuel (active, dissolution, etc.)
  • Historique des modifications statutaires
  • Compte de résultat (pour les SCI obligées de publier)

ÉTAPE 4 — Détection des événements BODACC
──────────────────────────────────────────
API BODACC gratuit → on surveille :
  • Dissolution amiable en cours
  • Liquidation judiciaire ou amiable
  • Cession de parts sociales
  • Décès d'un associé
  • Changement de gérant
  • Modification de l'objet social
  • Changement d'adresse du siège

ÉTAPE 5 — Scoring SCI dédié
────────────────────────────
Pondération renforcée pour les signaux SCI :
  • Dissolution en cours        → +40 pts
  • Liquidation amiable          → +35 pts
  • Cession de parts récente     → +30 pts
  • Décès d'un associé           → +25 pts
  • Changement de gérant         → +15 pts
  • Détention > 10 ans           → +15 pts
  • Compte de résultat en baisse → +10 pts

ÉTAPE 6 — Livraison à l'agence
───────────────────────────────
L'agence reçoit dans son dashboard, pour chaque bien SCI :
  • Adresse + caractéristiques du bien
  • Score 0-100
  • Nom de la SCI + dirigeant + téléphone professionnel
  • Signaux détectés
  • Action recommandée : "Appeler M. Martin"
```

### 11.3 Exemple de fiche complète SCI

```
═══════════════════════════════════════════════════════
📍 8 boulevard Vincent Auriol, 75013 Paris

   Score : 94/100 ★ TRÈS CHAUD
   
   🏢 SCI LES CÈDRES (RCS Paris 524 XX XX)
   
   Signaux détectés :
   🔴 Dissolution SCI en cours (BODACC du 03/04/2026)  +40 pts
   🟠 Détenu depuis 12 ans                              +15 pts
   🟡 DPE classé F (passoire thermique)                 +20 pts
   🟢 Plus-value estimée +38 %                          +15 pts
   🟢 Zone à forte rotation (>9 %)                      +10 pts
   
   ─────────────────────────────────────────────
   Dirigeant : Jean-Pierre MARTIN
   Téléphone professionnel : 01 XX XX XX XX
   Email professionnel : jpm@cabinet-martin.fr
   ─────────────────────────────────────────────
   
   Caractéristiques du bien :
   • Type : Immeuble mixte (commerce + résidentiel)
   • Surface : 320 m² totaux
   • Prix d'achat (2014) : 1 250 000 €
   • Valeur estimée 2026 : 1 720 000 €
   
   ▶ Action recommandée : Appeler M. Martin sur sa 
   ligne professionnelle. Mention possible des modifications 
   de la SCI sans révéler les détails BODACC.
═══════════════════════════════════════════════════════
```

### 11.4 Pricing du module SCI/SARL

```
Priimo Standard                     199 €/mois
  → Particuliers + SCI sans données dirigeants
  
Priimo Premium (avec module SCI)    349 €/mois
  → Tout Standard + identité dirigeants SCI + téléphones pros
  → +150 €/mois pour le module SCI
```

**Justification :** un seul mandat exclusif sur un bien à 1 M€ rapporte ~30 000 € de commission. Le module Premium coûte ~1 800 €/an. ROI : 1600 % sur un seul mandat.

### 11.5 Coût technique du module SCI

```
Pappers API :              ~0,02 €/requête × ~500 leads/mois = 10 €/mois
Cadastre (automatisé) :    ~50 €/mois pour les nouveaux biens
BODACC API :               Gratuit
─────────────────────────────────────────────────────────────
Coût marginal par client : ~60 €/mois
Marge brute Premium :      349 - 60 = 289 € (83 %)
```

**Rentabilité exceptionnelle** sur ce module premium.

---

## 12. Stack technique

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Frontend | Next.js 16 + React 18 + TypeScript + Tailwind CSS 3 | App Router, déploiement Vercel |
| Backend / BDD | Supabase (PostgreSQL + Auth + RLS) | Auth, données métier, policies multi-tenant |
| API métier | Routes Next.js `app/api/*` (+ `service_role` admin) | Invitations, onboarding, équipe — pas d'Edge Functions dédiées aujourd'hui |
| Authentification | Supabase Auth (`@supabase/ssr`) | Sessions cookie, middleware de protection |
| Cartographie | Lien Google Maps par adresse (fiche) ; carte interactive | Vue carte : placeholder ; colonnes `latitude`/`longitude` sur `leads` prêtes pour plus tard |
| UI feedback | Sonner (toasts) | Confirmations erreurs / succès |
| Paiements | Stripe | Standard du marché |
| Emails transactionnels | Resend | Simple, fiable |
| Hébergement | Vercel | Déploiement Next.js natif, CDN global |
| Police | Inter | Standard SaaS B2B moderne |
| Prospection (mois 2+) | Lemlist + Waalaxi LinkedIn | Cold outreach automatisé |
| Machine Learning (phase 3) | Python + scikit-learn | Régression logistique sur conversions réelles |

---

## 13. Sources de données

Toutes les sources sont **publiques et légales**. Le pipeline ne stocke jamais la donnée brute — uniquement les leads scorés.

### 13.1 Sources MVP (Phase 1) — biens + scoring

| Source | Données | Coût |
|--------|---------|------|
| **DVF** (data.gouv.fr) | Transactions immobilières depuis 2014 | Gratuit |
| **DPE ADEME** | Score énergétique + date diagnostic | Gratuit |
| **BAN** | Géocodage français de référence | Gratuit |
| **BODACC** | Liquidations pro, cessions, dissolutions | Gratuit |

### 13.2 Sources Phase 2 — enrichissement

| Source | Données | Coût |
|--------|---------|------|
| **Cadastre** | Parcelle, surface terrain, bâti, identité propriétaire | Quasi-gratuit (~5 €/fiche premium) |
| **INSEE IRIS** | Démographie quartier (âge, CSP, etc.) | Gratuit |
| **SITADEL** | Permis de construire récents | Gratuit |
| **Datafoncier (CEREMA)** | Propriétaires personnes morales | Convention gratuite |

### 13.3 Sources Phase 3 — module SCI/SARL

| Source | Données | Coût |
|--------|---------|------|
| **Pappers API** | Dirigeants + contacts + statuts | ~0,02 €/requête |
| **INSEE Sirene** | Mutations professionnelles, départs retraite | Gratuit |

### 13.4 Sources Phase 4 — pige intelligente automatisée

| Source | Données | Coût |
|--------|---------|------|
| **Scraping LeBonCoin / PAP** | Nouvelles annonces particuliers | Coût serveur |
| **API SeLoger (si partenariat)** | Annonces fraîches | À négocier |

L'idée : détecter en temps réel quand un propriétaire publie une annonce de particulier à particulier, et alerter l'agence dans les minutes qui suivent. L'agent appelle **avant que les concurrents aient vu l'annonce**.

### 13.5 Coût infrastructure cible

Moins de 50 $/mois jusqu'à 50 clients (avec module SCI inclus). Modèle viable même à très petite échelle.

---

## 14. ⚡ Algorithme de scoring — le cœur du produit

C'est ici que se joue 80 % de la valeur. Tout doit être impeccable.

// PRIORITÉ PHASE 2 (validé par Biens de Famille, 30 ans métier) :
// Signal succession/décès     → +35 pts (détection via actes de décès publics + mutation DVF)
// Signal divorce               → +30 pts (détection : changement de propriétaire sur bien détenu en commun)
// Signal mutation professionnelle → +20 pts (détection : changement adresse déclarée propriétaire)

### 14.1 Version 1 — MVP (5 signaux génériques)

```javascript
function scoreLeadV1(signals) {
  let score = 0;

  // Signal 1 — Durée de détention (DVF) : pic 5-12 ans
  if (signals.years_owned >= 5 && signals.years_owned <= 12) {
    score += 25;
  }

  // Signal 2 — DPE récent (<6 mois) : précède souvent vente
  if (signals.days_since_dpe < 180) {
    score += 20;
  }

  // Signal 3 — Plus-value estimée élevée
  if (signals.estimated_gain_pct > 20) {
    score += 15;
  }

  // Signal 4 — Événement de vie (BODACC) [SCI/SARL uniquement]
  if (signals.life_event === 'liquidation_pro') score += 30;
  if (signals.life_event === 'dissolution_sci') score += 30;
  if (signals.life_event === 'cession_entreprise') score += 25;

  // Signal 5 — Zone à forte rotation
  if (signals.zone_rotation_rate > 0.08) {
    score += 10;
  }

  return Math.min(score, 100);
}
```

// PRIORITÉ PHASE 2 (validé par Biens de Famille, 30 ans métier) :
// Signal succession/décès     → +35 pts (détection via actes de décès publics + mutation DVF)
// Signal divorce               → +30 pts (détection : changement de propriétaire sur bien détenu en commun)
// Signal mutation professionnelle → +20 pts (détection : changement adresse déclarée propriétaire)

### 14.2 Version 2 — Phase 2 (signaux enrichis, 4 catégories)

```javascript
function scoreLeadV2(signals) {
  let score = 0;

  // ═══════════════════════════════════════════════════
  // CATÉGORIE 1 — SIGNAUX TRANSACTIONNELS (DVF, ADEME)
  // ═══════════════════════════════════════════════════
  if (signals.years_owned >= 5 && signals.years_owned <= 12) score += 25;
  if (signals.days_since_dpe < 180) score += 20;
  if (signals.dpe_class === 'F' || signals.dpe_class === 'G') {
    if (signals.years_owned > 5) score += 25; // Passoire + détention longue
  }
  if (signals.estimated_gain_pct > 20) score += 15;
  if (signals.recent_works_sitadel) score += 15;

  // ═══════════════════════════════════════════════════
  // CATÉGORIE 2 — SIGNAUX DE VIE PRO (BODACC, Pappers)
  // [Uniquement pour SCI/SARL ou propriétaires liés à activité pro]
  // ═══════════════════════════════════════════════════
  if (signals.is_sci_or_sarl) {
    if (signals.bodacc_dissolution) score += 30;
    if (signals.bodacc_liquidation) score += 30;
    if (signals.bodacc_cession_parts) score += 25;
    if (signals.bodacc_changement_gerant) score += 15;
    if (signals.deces_associe) score += 25;
  }

  // ═══════════════════════════════════════════════════
  // CATÉGORIE 3 — SIGNAUX DE ZONE (INSEE, IRIS)
  // ═══════════════════════════════════════════════════
  if (signals.zone_rotation_rate > 0.08) score += 10;
  if (signals.zone_evolution_demo === 'decroissante') score += 10;
  if (signals.zone_vieillissement_pct > 0.30) score += 15;
  if (signals.zone_arrivees_jeunes_familles) score += 10;

  // ═══════════════════════════════════════════════════
  // CATÉGORIE 4 — SIGNAUX DE MARCHÉ
  // ═══════════════════════════════════════════════════
  if (signals.zone_annonces_concurrentes_baisse_15pct) score += 15;
  if (signals.zone_prix_median_baisse) score += 10;
  if (signals.zone_delai_vente_hausse) score += 10;

  // ═══════════════════════════════════════════════════
  // BONUS COMBINÉS (synergies de signaux)
  // ═══════════════════════════════════════════════════
  if (signals.dpe_F_or_G && signals.years_owned > 7) {
    score += 15; // Passoire + détention très longue = pression forte
  }
  if (signals.bodacc_dissolution && signals.years_owned > 8) {
    score += 20; // SCI dissoute + détention longue = vente quasi-certaine
  }
  if (signals.recent_works_sitadel && signals.estimated_gain_pct > 30) {
    score += 10; // Travaux + plus-value élevée = optimisation avant vente
  }

  return Math.min(score, 100);
}
```

### 14.3 Version 3 — Phase 3 (Machine Learning auto-amélioré)

C'est l'avantage défendable ultime.

**Le principe :**
Chaque client Priimo nous remonte le statut final de chaque lead :
- "Mandat signé" ✅
- "Vendeur mais pas chez nous" ➡️
- "Pas vendeur" ❌
- "Pas contacté" ⏸️

Après 6 mois, on a une base d'entraînement de **plusieurs milliers de leads avec issue réelle**. On peut entraîner un modèle ML qui apprend les VRAIES pondérations selon les conversions effectives.

**Architecture ML :**

```python
# Modèle : Régression logistique ou Gradient Boosting (XGBoost)
# Variables d'entrée : ~30 signaux numériques
# Variable cible : binaire "mandat signé dans les 6 mois" (0/1)

from sklearn.linear_model import LogisticRegression
from xgboost import XGBClassifier

model = XGBClassifier(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.05
)

# Entraînement sur historique
model.fit(X_train, y_train)

# Prédiction : probabilité de conversion en mandat signé
score = model.predict_proba(new_lead)[:, 1] * 100
```

**Effet réseau :**
- Plus de clients = plus de feedback = scoring plus précis
- Plus précis = meilleurs résultats = plus de clients
- Loop défensif que personne ne peut rattraper rapidement

**Ré-entraînement :**
- Modèle ré-entraîné chaque mois sur les nouvelles données
- A/B test continu entre versions du modèle
- Cible : précision > 80 % à 6 mois (vs ~40 % attendu avec scoring V1)

### 14.4 Boucle de feedback client

**Prévu phase 1 (dashboard) :**
- Boutons sur chaque lead : "Mandat signé" / "Pas vendeur" / "Vendeur ailleurs" / "Pas contacté"
- Colonne `leads.ml_feedback` déjà prévue en BDD — **UI retirée du drawer** en attendant la phase ML
- Ces données alimenteront la base d'entraînement quand l'interface sera réactivée

---

## 15. Modèle économique

### 15.1 Pricing — version actualisée

**Plans principaux :**

| Plan | Prix | Cible | Inclus |
|------|------|-------|--------|
| **Fondateur** (10 premiers, à vie) | **100 €/mois** | Early-adopters | Standard, co-construction, accès direct fondateur |
| **Solo** | 79 €/mois | Mandataires indépendants | 1 zone, ~15 prospects, sans module SCI |
| **Standard** | 199 €/mois | Agence 1–5 agents | 1 zone élargie, ~15-30 prospects, sans module SCI |
| **Premium** | 349 €/mois | Agence 5–15 agents | Standard + **module SCI/SARL complet** |
| **Réseau** | Sur devis (≥ 599 €) | Franchises | Tout Premium + multi-zones + API + account manager |

**Logique d'amorçage avec les Fondateurs :**

Les 10 premiers clients à 100 €/mois génèrent **1000 €/MRR**. Cette somme finance :
- Les APIs payantes (Pappers, Cadastre premium) pour développer le module SCI
- L'audit RGPD (~2500 €)
- L'hébergement et les outils marketing
- L'accélération du dev

**À partir du 11ᵉ client :** tarif normal Standard à 199 €/mois, Premium à 349 €/mois.

**Note importante validée par Biens de Famille (directeur 8 agents) :**

Le pricing par-utilisateur (type Cadastre à 10 €/utilisateur) génère une friction importante. Citation directe : *"Je recommande de faire un prix unique sans nombre d'utilisateurs."* Cadastre lui coûte 80 €/mois (8 utilisateurs) mais il trouve que 200 €/mois est déjà cher. Le forfait unique agence (notre modèle actuel) est validé comme supérieur au per-seat pricing.

### 15.2 Promesse contractuelle

> *"Priimo s'engage à fournir 15 leads ultra-qualifiés par mois minimum, ciblés sur votre zone exclusive. Pour les abonnés Premium, vous recevez en plus les coordonnées professionnelles des dirigeants de SCI/SARL identifiés."*

Cette promesse est **modérée volontairement** (sous-promesse / sur-livraison). Anti-pattern Realadvisor évité.




### 15.3 Essai gratuit

- **1 mois gratuit, sans engagement, sans carte bancaire**
- Validation explicite par Côté Particulier comme meilleur levier de conversion
- Cible : ≥ 60 % de conversion essai → payant

### 15.4 Remise annuelle

- **−20 %** sur paiement annuel (2 mois offerts)
- Objectif : 50 % des clients en annuel à fin année 1

### 15.5 Sources de revenus complémentaires (Phase 4+)

- **Courriers personnalisés automatisés** : 0,80 à 1,20 €/courrier (partenariat La Poste Pro)
- **Zone exclusive premium** : +50 €/mois (garantie zéro concurrent)
- **Commissions partenaires CRM** : 10 à 15 % de MRR référé (Hektor, Netty, Taktikimmo)
- **Module pige intelligente** : +99 €/mois (alertes annonces fraîches LBC/PAP)

### 15.6 Projections MRR (objectifs)

```
Fin mois 1   →  3 fondateurs × 100 €                          =     300 €
Fin mois 2   →  10 fondateurs × 100 €                         =   1 000 €  ← PMF
Fin mois 3   →  10 fondateurs + 8 Standard × 199 €            =   2 592 €
Fin mois 4   →  10 fondateurs + 15 Standard + 3 Premium       =   5 037 €
Fin mois 6   →  10 fondateurs + 30 Standard + 12 Premium      =  11 158 €
Fin mois 12  →  10 fondateurs + 70 Standard + 35 Premium      =  27 145 €
```

---

## 16. Stratégie Go-To-Market

### 16.1 Le récit de vente

> *"La pige téléphonique est interdite depuis août 2025. Les portails fournissent des leads en aval, déjà sollicités par toute la concurrence. Priimo vous donne des leads en amont — des propriétaires qui vont vendre dans les prochains mois, avant qu'ils ne soient sur le marché. Pour 25 à 30 % de votre zone (les biens en SCI/SARL), nous vous donnons en plus le nom et le téléphone professionnel du dirigeant. Vous appelez directement la bonne personne, au bon moment."*

### 16.2 Cible commerciale

**Le directeur d'agence**, jamais le siège franchise (validé par Laforêt). Les directeurs paient les outils eux-mêmes localement.

### 16.3 Argument ROI à utiliser

> *"Si Priimo vous permet de rentrer 1 mandat exclusif supplémentaire par mois, l'outil est rentabilisé 10 fois. Une commission de 3 % sur un bien à 400 000 € = 12 000 € de chiffre d'affaires. Le coût annuel de Priimo Standard : 2 400 €. ROI : 500 %. Sur un bien SCI à 1,5 M€, ROI : 1500 %."*

### 16.4 Flow d'acquisition — Calendly + invitation

**Étape 1 — Landing page → Calendly**

Le seul CTA de la landing page est "Réserver une démo" qui ouvre le Calendly de Simon. Pas de signup public, pas de self-serve. Toute entrée passe par une qualification téléphonique.

**Étape 2 — Appel de découverte (méthode Mom Test)**

Simon suit le script de discovery call (section 17) pour comprendre le process actuel, les douleurs, les tentatives passées. Il qualifie le fit produit/marché.

**Étape 3 — Envoi d'une invitation personnelle**

Si le directeur est un bon fit (ICP validé, besoin réel, zone Paris 13e/14e/15e pour le MVP), Simon lui envoie un email avec un lien d'invitation unique :

> *Voici votre lien d'accès à Priimo : https://priimo.fr/invite?token=abc123xyz*

**Étape 4 — Création du compte**

Le directeur clique sur le lien, arrive sur une page `/invite` qui valide le token, lui demande de renseigner :
- Nom de l'agence (pré-rempli si Simon l'a mis dans l'invitation)
- Prénom, nom
- Email (pré-rempli, lecture seule)
- Mot de passe

Au submit : création de l'agence + du profil directeur, connexion automatique, redirection vers **`/onboarding`** (configuration zone obligatoire) puis `/dashboard`.

**Étape 5 — Onboarding produit**

- **Automatique** : le directeur configure sa zone sur `/onboarding` (adresse + rayon) avant d'accéder aux prospects.
- **Humain (recommandé)** : Simon appelle le lendemain pour un walk-through (15 min) — scoring, filtres, invitation collaborateurs.

### 16.5 Canaux d'acquisition prioritaires

```
60 % du temps  →  Calendly discovery calls (cible principale)
                   • Cold call hors horaires
                   • LinkedIn warm intro
                   • Warm intro via agents

30 % du temps  →  Mandataires indépendants (cible secondaire)
                   • Plus faciles à joindre directement
                   • Validation rapide du concept
                   • Plan Solo à 79 €/mois

10 % du temps  →  Agents salariés
                   • UNIQUEMENT comme passerelle vers directeur
                   • Jamais comme cible de pré-vente directe
```

### 16.6 Loi des 19 canaux d'acquisition (Traction)

**À tester séquentiellement, 1 canal à la fois, 2-4 semaines max :**

1. ✅ Calendly discovery calls (en cours)
2. 🟡 LinkedIn organique (Waalaxi 300 contacts) — semaine 2
3. ⏸️ Cold email Lemlist — Phase 2
4. ⏸️ LinkedIn organique (Build in Public) — Phase 2
5. ⏸️ Google Ads — Phase 3 (avec budget)
6. ⏸️ SEO (3 articles/mois) — Phase 4
7. ⏸️ Partenariats CRM (Hektor, Netty) — Phase 4
8. ⏸️ Bouche-à-oreille agence — naturel

**Règle :** 1 canal qui marche fait 90 % du revenu au début. Trouver ce canal avant d'en lancer un deuxième.

---

## 17. Script d'appel de prospection

### Structure complète (15-20 minutes)

```
▼ OUVERTURE (30 sec)
─────────────────────
"Bonjour [Mme/M. Nom], Simon Berbey, je vous appelle 
parce que je développe un outil de prospection prédictive 
pour les agences immobilières. J'ai déjà échangé avec 
plusieurs directeurs en région parisienne et j'aurais 
besoin de 15 minutes pour comprendre comment vous 
travaillez. Vous avez un moment ?"

▼ PHASE 1 — CONTEXTE CLIENT (2-3 min)
──────────────────────────────────────
1. Directeur depuis combien de temps ?
2. Combien d'agents ?
3. Quelle zone ?
4. Indépendant ou réseau ?
5. (Si réseau) Les outils, c'est vous ou le siège qui paie ?

▼ PHASE 2 — PROCESS ACTUEL (5-7 min)
─────────────────────────────────────
6. La semaine dernière, comment avez-vous prospecté pour 
   trouver de nouveaux mandats vendeurs ?
7. Vos agents font du porte-à-porte ?
8. Vous utilisez des outils ?
   → Pour chaque outil cité :
     • "Vous payez combien environ ?"
     • "Vous en êtes satisfait ?"
     • "Qu'est-ce qui vous manque ?"
9. Sur un mois normal, combien de mandats exclusifs rentrez-vous ?

▼ PHASE 3 — DOULEURS CONCRÈTES (5 min)
───────────────────────────────────────
10. C'est quoi votre plus grosse galère en prospection ?
11. Le dernier mandat exclusif, il est venu d'où ?
12. La dernière fois qu'un confrère vous a piqué un mandat ?
13. Depuis l'interdiction de la pige, comment avez-vous adapté ?

▼ PHASE 4 — TENTATIVES PASSÉES (3 min)
───────────────────────────────────────
14. Vous avez déjà essayé un outil de prospection prédictive ?
    (Maline, Realadvisor, Telescop...)
    → Si oui : "Qu'est-ce qui n'allait pas ?"
    → Si non : "Pourquoi pas ?"
15. Pour résoudre votre problème de mandats, prêt à investir 
    combien par mois ?

▼ PHASE 5 — TEST PRIX ET PRÉ-VENTE (3 min)
────────────────────────────────────────────
"Priimo croise les données publiques et les signaux de vie 
pour identifier les propriétaires qui vont vendre, avant 
qu'ils ne soient sur le marché. Chaque lundi, vous recevez 
15 prospects scorés sur votre territoire exclusif.

★ Pour les biens en SCI/SARL — 25 à 30 % de votre zone — 
vous recevez en plus le nom et le téléphone du dirigeant. 
Aucun concurrent ne le fait à ce niveau.

★ QUESTION TEST :
Je propose un tarif fondateur à 100 €/mois pour les 10 
premières agences, à vie. En échange, vous co-construisez 
l'outil avec moi. Vous voulez en être ?"

→ DRAPEAUX :
   🟢 "Quand on commence ?" / "Comment ça marche ?"
   🟠 "C'est intéressant, j'aimerais voir un exemple"
   🔴 "Envoyez-moi de la doc" / "On verra"

▼ FERMETURE (selon drapeau)
────────────────────────────
🟢 → Envoyer lien d'invitation par email immédiatement
🟠 → Envoi exemple liste gratuite + relance J+3
🔴 → Rappel dans 3 semaines + noter motif

▼ TOUJOURS À LA FIN
────────────────────
"Vous connaissez d'autres directeurs qui pourraient être 
intéressés ?"
```

---

## 18. Système d'authentification et d'invitations

### 18.1 Architecture base de données (Supabase)

**Tables en production (schéma `supabase/schema.sql` + migrations) :**
- `public.agencies` — agence cliente (plan, zone : `zone_center_address`, `zone_latitude`, `zone_longitude`, `zone_radius_km`, `stripe_customer_id`)
- `public.profiles` — 1:1 avec `auth.users` (`agency_id`, `role`, identité, `phone`, `preferences` jsonb)
- `public.invitations` — tokens d'invitation (directeur ou collaborateur), expiration, `used_at`
- `public.leads` — prospects scorés par agence (adresse, score, signaux json, statut, notes, assignation, champs SCI, `ml_feedback`, `latitude`/`longitude`)

**Row Level Security (RLS) :**
- Chaque agence ne voit que ses propres données
- Les directeurs peuvent modifier leur agence, les collaborateurs non
- Les directeurs peuvent inviter et supprimer des collaborateurs
- Les collaborateurs ne peuvent modifier que leur propre profil

**Helpers SECURITY DEFINER :**
- `current_user_agency_id()` — retourne l'agency_id de l'utilisateur connecté
- `current_user_role()` — retourne le rôle (directeur/collaborateur)

Ces fonctions évitent la récursion infinie des policies RLS.

### 18.2 Flow d'invitation — Directeur d'agence

**Création de l'invitation (Simon / admin) :**
1. INSERT dans `public.invitations` (token, email, `role = directeur`, `agency_id` NULL, `agency_name` optionnel) — via SQL ou outil admin
2. Email avec lien `https://priimo.fr/invite?token=…` (manuel ou Resend)

**Acceptation (`/invite`) — implémenté :**
1. La page valide le token (non expiré, non utilisé)
2. Formulaire : nom d'agence (si directeur), prénom, nom, mot de passe
3. `POST /api/create-director` (clé `service_role`) : crée `agencies` + `auth.users` + `profiles`, marque `used_at`
4. Connexion automatique → **`/onboarding`** si zone non configurée, sinon **`/dashboard`**

### 18.3 Flow d'invitation — Collaborateur

**Depuis le dashboard — implémenté :**
1. Directeur → Paramètres > Mon équipe > inviter par email
2. `POST /api/invitations/collaborateur` : token + INSERT `invitations` (`role = collaborateur`, `agency_id` renseigné)
3. Email Resend (`sendInvitationEmail`) avec lien `/invite?token=…`
4. Collaborateur : prénom, nom, mot de passe sur `/invite`
5. `POST /api/create-collaborator` : `auth.users` + `profiles` (collaborateur), `used_at`
6. Connexion → `/dashboard` (pas d'onboarding zone — réservé au directeur)

**Routes API complémentaires :** renvoi / suppression d'invitation (`/api/invitations/[id]`), gestion équipe (`/api/team`).

### 18.4 Permissions par rôle

| Fonctionnalité | Directeur | Collaborateur |
|---|---|---|
| Voir tous les leads de l'agence | ✅ | ✅ |
| Changer statut d'un lead | ✅ | ✅ |
| Ajouter des notes | ✅ | ✅ |
| Donner feedback ML | ✅ | ✅ |
| Assigner un lead | ✅ | ❌ |
| Exporter CSV | ✅ | ❌ |
| Accéder à "Mon agence" (paramètres) | ✅ | ❌ |
| Accéder à "Mon équipe" | ✅ | ❌ |
| Accéder à "Abonnement" | ✅ | ❌ |
| Inviter/supprimer des collaborateurs | ✅ | ❌ |
| Modifier son profil (nom, mot de passe) | ✅ | ✅ |
| Gérer ses notifications | ✅ | ✅ |

---

## 19. Philosophie produit

### 19.1 Les 10 principes non-négociables

1. **Les signaux de vie sont le cœur du produit.** DVF/DPE = hygiène. Événements de vie = valeur.
2. **15 leads excellents > 100 leads moyens.** Ne jamais promettre du volume.
3. **Chaque lead = actionnable immédiatement.** Adresse + score + signal + contexte (+ dirigeant pour SCI).
4. **Simplicité radicale.** Compréhensible en 10 secondes par un directeur de 55 ans.
5. **Ne jamais construire ce qui n'a pas été demandé.** Painted Door Test systématique.
6. **Le scoring est l'avantage défendable.** Affiné par feedback, effet réseau ML.
7. **Priimo est complémentaire, pas concurrent.** Ne remplace pas SeLoger.
8. **Le territoire exclusif est un levier business.** Rareté + prix + rétention.
9. **Le module SCI/SARL est la pépite légale.** À développer prioritairement après le MVP.
10. **Aucun contournement RGPD.** La conformité légale est non-négociable.

### 19.2 Frameworks intellectuels appliqués

- **Mom Test (Rob Fitzpatrick)** — Questions sur le passé réel, jamais sur le futur hypothétique
- **Painted Door Test** — Tester l'intention d'usage avant de coder une feature
- **Jobs To Be Done** — Le job : "rentrer des mandats exclusifs sans augmenter l'équipe"
- **Concierge MVP (Eric Ries)** — Vendre le résultat manuellement, automatiser ensuite
- **Charge More (Patrick McKenzie)** — Prix trop bas = signal de faible valeur perçue
- **Narrative First (Andy Raskin)** — Ancien monde (pige) → changement → nouveau monde → Priimo = passeport
- **Effet réseau (Andrew Chen)** — Plus de clients = meilleur scoring = plus défendable

### 19.3 La règle d'or

> **Aucune feature n'entre dans la roadmap si elle n'a pas été demandée explicitement par au moins 3 clients payants.**

Cette règle écarte par défaut : module équipe, app mobile, courriers automatisés, dashboard analytics avancé. Elles seront construites si et seulement si les clients réels les réclament.

---

## 20. État actuel — Mai 2026

### 20.1 Ce qui est fait (produit & technique)

**Go-to-market / discovery**
- ✅ Domaine **priimo.fr**, landing + CTA Calendly
- ✅ **7 discovery calls** documentés
- ✅ Pricing et positionnement définis (voir sections 7, 11, 15)

**Application web (MVP opérationnel côté code)**
- ✅ **Auth** : `/login`, middleware, sessions Supabase SSR
- ✅ **Invitations** : `/invite`, APIs `create-director` / `create-collaborator`, emails Resend pour collaborateurs
- ✅ **Onboarding directeur** : `/onboarding` (zone BAN + rayon 1–15 km), garde middleware
- ✅ **Dashboard prospects** : données **Supabase** (`fetchLeads`), onglets, KPI, filtres rapides + avancés, liste/carte (carte = placeholder), export CSV, drawer + mobile plein écran
- ✅ **Fiche prospect** : signaux détaillés, SCI, Maps, assignation, suppression lead, badges chaleur
- ✅ **Paramètres** : agence, équipe, profil, notifications (json), sécurité ; onglet abonnement (affichage plan)
- ✅ **Schéma Supabase** : `agencies`, `profiles`, `invitations`, RLS ; table `leads` + policies SELECT/UPDATE/DELETE ; migrations lat/lng et delete RLS

**Non livré ou en attente**
- ⏸️ Vue **carte interactive** (Leaflet retiré — « bientôt »)
- ⏸️ UI **feedback ML** sur les fiches (colonne BDD prête)
- ⏸️ **Stripe** checkout / facturation self-serve
- ⏸️ **Pipeline data** automatisé (DVF/DPE → injection leads hebdo) — leads actuellement alimentés manuellement ou hors scope app
- ⏸️ Module SCI enrichi (Pappers/BODACC) côté produit data

### 20.2 Priorités immédiates (post-MVP app)

```
□ Appliquer / vérifier migrations Supabase en prod (leads delete RLS, coordinates)
□ Pipeline data Phase 1 : script ingestion DVF + DPE sur zone pilote
□ Premiers leads réels en base pour 1–2 agences fondateurs test
□ Réactiver feedback ML dans le drawer (quand données de conversion disponibles)
□ Carte interactive (quand priorisée vs autres features)
□ Stripe : essai / abonnement Fondateur
□ Pré-ventes / lettres d'intention (objectif commercial inchangé)
```

### 20.3 Critères business (inchangés)

Objectifs commerciaux **avant scale** :
- ≥ 5 lettres d'intention ou pré-paiements
- ≥ 20 discovery calls
- Concierge MVP : au moins une liste utile livrée manuellement à une agence test

Le **code MVP app** est avancé ; le goulot d'étranglement principal est désormais **data + premiers clients payants**, pas le squelette Next.js/Supabase.

---

## 21. Décisions actées et ce qui a été écarté

| Idée | Raison de l'écarter |
|------|---------------------|
| Téléphones de particuliers | Illégal (RGPD), risque CNIL massif |
| Croisement nom + raison personnelle de vente | Illégal pour la prospection commerciale |
| Nurturing / emailing automatisé | Les leads immo sont rares, agences appellent directement |
| Génération de leads acquéreurs | Pas de base de données publique exploitable |
| Modèle freemium | Pas de conversion sans accompagnement humain |
| Pricing < 99 €/mois | Signal de faible valeur perçue |
| Application mobile dans le MVP | Aucune demande spontanée lors des 6 calls |
| Module dispatch / équipe dans le MVP | Aucune mention spontanée lors des 6 calls |
| DVF + DPE seuls comme proposition de valeur | Jugé peu différenciant par FREDELION |
| Promesse de volume élevé de leads | Anti-pattern Realadvisor (30 promis, 5 livrés) |
| Stocker les DVF complètes de France | 6M lignes inutiles, coût prohibitif |
| Coder le MVP avant 5 lettres d'intention signées | Risque de construire ce que personne ne veut — *le squelette app est avancé ; la priorité reste data + ventes* |
| Cibler les sièges franchise | Les directeurs paient eux-mêmes |
| Promettre une intégration CRM dès le MVP | Aucun client ne l'a demandée |
| Contournement RGPD pour particuliers | Suicide légal et stratégique |
| Signup public self-serve | Dilue la qualification, empêche le PMF, vanity metrics |
| Page "Tableau de bord" avec graphiques | Prématuré, non demandé, distraction du cœur de valeur |
| Page "Mon territoire" avec carte | Prématuré, non demandé, complexe |
| Better Auth pour l'authentification | Complexité inutile, Supabase Auth natif suffit |

---

## 22. Questions encore ouvertes

- À partir de quel MRR faudra-t-il choisir entre "continuer les études sérieusement" et "tout miser sur le SaaS" ? Hypothèse : 5–10 k€ MRR = point de bascule.
- Le modèle "100 € à vie" pour les fondateurs est-il optimal ? Alternative : 100 € pendant 12 mois puis 199 €.
- Comment gérer le territoire exclusif quand 2 agences voisines veulent la même zone ? Premier arrivé / système d'enchères / zones plus petites ?
- Quand sortir du compte LinkedIn anonyme pour développer une marque personnelle ?
- Faut-il un produit séparé pour les mandataires indépendants ou un plan adapté ?
- À quel moment intégrer Causio avec Priimo (cross-sell) ? Hypothèse : à 30 clients Priimo.
- Comment structurer juridiquement les premiers contrats (auto-entrepreneur vs SAS) ?
- Quel partenaire idéal pour automatiser les courriers physiques (Phase 4) ?
- Quand intégrer la pige intelligente automatisée (LBC, PAP) ? Phase 4 ?
- Comment monétiser les données agrégées (statistiques de marché par zone) à terme ?

---

## 23. Glossaire métier

- **DVF** (Demandes de Valeurs Foncières) : base de données publique des transactions immobilières depuis 2014
- **DPE** (Diagnostic de Performance Énergétique) : score énergétique obligatoire avant vente / location
- **BODACC** (Bulletin Officiel Des Annonces Civiles et Commerciales) : publications légales (liquidations, dissolutions, cessions)
- **SITADEL** : base nationale des permis de construire
- **BAN** (Base Adresse Nationale) : référentiel adresses français
- **SCI** (Société Civile Immobilière) : structure juridique de détention de biens immobiliers, très répandue en France
- **SARL** (Société à Responsabilité Limitée) : forme juridique d'entreprise, peut détenir des biens immobiliers
- **Pappers** : registre d'entreprises français consultable via API, donne accès aux infos légales des sociétés
- **INSEE Sirene** : registre des entreprises (numéros SIRET, SIREN, adresses)
- **INSEE IRIS** : découpage statistique infra-communal pour les données démographiques
- **CNIL** : autorité française de protection des données personnelles
- **RGPD** : Règlement Général sur la Protection des Données, cadre légal européen
- **Mandat exclusif** : contrat où le propriétaire confie la vente à une seule agence
- **Pige immobilière** : surveillance des annonces de particuliers (téléphonique interdite depuis août 2025)
- **Prospection terrain** : porte-à-porte ciblé par adresse
- **Lead vendeur** : propriétaire identifié comme susceptible de vendre
- **PMF** (Product-Market Fit) : adéquation produit / marché, l'objectif des premiers mois
- **RLS** (Row Level Security) : sécurité au niveau des lignes dans PostgreSQL, garantit l'isolation multi-tenant
- **Edge Function** : fonction serveur déployée sur l'infrastructure Supabase, équivalent d'une API route
- **Resend** : service d'email transactionnel utilisé pour les invitations

---

*Dernière mise à jour : 19 mai 2026 — Version 4.1*  
*Document de référence opérationnel — à mettre à jour après chaque batch de 5 appels, chaque invitation envoyée, chaque jalon de développement, et chaque évolution majeure de l'algorithme de scoring.*