# CONTEXT.MD — PRIIMO

> Document de référence fondateur du projet Priimo  
> Dernière mise à jour : 6 mai 2026  
> Usage : à placer à la racine du projet. Donner à Claude, Cursor ou tout outil IA en début de conversation pour un contexte complet.

---

## 1. FONDATEUR

- **Prénom :** Simon
- **Âge :** 19 ans
- **Profil :** Étudiant ingénieur à ESIEE Paris, développeur full-stack, entrepreneur
- **Statut juridique :** SIRET en tant que particulier (entrepreneur individuel)
- **Éditeur de code :** Cursor (IDE principal), Claude Pro pour la productivité
- **Domaine acheté :** priimo.fr
- **Hébergement :** Vercel (landing page déjà déployée sur Vercel pour d'autres projets)

### Expérience SaaS antérieure

Simon a développé et commercialisé **Causio** — chatbot IA B2B pour sites web d'agences immobilières.
- Stack Causio : Next.js 14, React, TypeScript, Tailwind CSS, Supabase, OpenAI gpt-4o-mini, Vercel Edge Functions, Stripe
- SAS Cosio/Causio créée, premiers clients signés, 10 agences payantes
- Causio a permis d'apprendre le cycle de vente immobilier, le vocabulaire métier, et les objections courantes

**Le pivot vers Priimo :** En prospectant pour Causio, tous les directeurs d'agence ont verbalisé le même besoin : *"Ce qu'il nous faut, c'est un outil pour trouver des vendeurs."* Ce signal répété et unanime a déclenché la création de Priimo.

### Atouts de départ
- 5 numéros de directeurs d'agence déjà dans le téléphone
- Connaissance terrain du fonctionnement des agences immobilières
- Maîtrise complète de la stack technique nécessaire (Next.js + Supabase + Stripe)
- Compte TikTok à 14 000 followers (levier de distribution potentiel à terme)

---

## 2. LE PRODUIT

### Nom
**Priimo**

### Domaine
priimo.fr

### Pitch en une phrase
> *"Priimo détecte les propriétaires qui vont vendre avant qu'ils ne soient sur le marché — grâce aux données publiques et aux signaux de vie."*

### Problème résolu
Les agences immobilières françaises manquent de mandats vendeurs. La pige téléphonique — canal historique de prospection — est interdite depuis août 2025. Le porte-à-porte a été largement abandonné depuis le Covid par de nombreuses agences urbaines. Les portails (SeLoger, MeilleursAgents, LeBonCoin) sont chers (~1000 €/mois pour un pack) et les leads y sont partagés avec la concurrence.

Il n'existe pas aujourd'hui d'outil simple, abordable et centré sur les signaux de vie (divorces, successions, mutations, retraites) qui permette aux agences de détecter les vendeurs en amont. Les solutions existantes sont soit trop chères et complexes (Maline, Telescop), soit trop basiques (Realtys.pro), soit trop généralistes (Realty, Hektor).

### Solution
Un SaaS qui croise des données publiques françaises (DVF, DPE, BODACC, et progressivement d'autres sources liées aux événements de vie) pour identifier les propriétaires les plus susceptibles de vendre, les scorer, et les présenter à l'agence sous forme d'une liste actionnable de leads ultra-qualifiés sur un territoire dédié.

### Ce que Priimo EST
- Un outil de **génération de leads vendeurs** par la data prédictive
- Un outil **simple**, opérationnel en 20 minutes sans formation
- Un outil qui fournit **peu de leads mais très qualifiés** (~15/mois minimum, ultra-pertinents)
- Un outil avec **territoire exclusif** par agence (zone réservée, pas de concurrence sur le même outil)

### Ce que Priimo N'EST PAS
- Ce n'est PAS un CRM (pas de gestion de mandats ni de transactions)
- Ce n'est PAS un outil de pige (pas de surveillance des annonces en ligne)
- Ce n'est PAS un portail d'annonces ni un concurrent de SeLoger
- Ce n'est PAS un outil de nurturing ou d'emailing automatisé
- Ce n'est PAS un logiciel tout-en-un

---

## 3. VALIDATION TERRAIN — DISCOVERY CALLS

### Statut des appels
6 agences contactées, 5 appels de 10–15 min, 1 appel de 40 min. Notes détaillées sur Google Sheets.

### Résumé par agence

| # | Agence | Interlocuteur | Outils actuels | Ce qui les intéresse | Signal d'achat | Insights clés |
|---|--------|--------------|----------------|---------------------|----------------|---------------|
| 1 | **Côté Particulier** (Paris St-Marcel) | Mme Vipascal | — | Territoire privé, scoring 67/100, signaux de vie | ✅ Très intéressée, veut un essai 1 mois gratuit | Veut 15 leads ultra qualifiés/mois minimum. A mentionné Jinka et Logic-Immo comme références |
| 2 | **De Lachaise Immobilier** | Agent | Realdvisor (insatisfait) | Leads exploitables avec nom + tel + adresse + contexte | ✅ Intéressé si efficace | Realdvisor a promis 30 leads, 5 reçus en 6 mois. Pas de porte-à-porte (copropriétés pénibles) |
| 3 | **Laforêt Paris** (local) | Agent | SeLoger, MeilleursAgents premium | Leads complémentaires aux portails | ⚠️ Informatif | Les directeurs paient les outils, pas le siège. Porte-à-porte abandonné depuis le Covid |
| 4 | **Conseil Rive Gauche** (Paris 13) | M. Sahmoune (fils du directeur) | Taktikimmo, MeilleursAgents, SeLoger (~1000 €/mois) | Leads ciblés sur leur quartier | ✅ Intéressé, prix de 200 €/mois jugé raisonnable | Agence familiale "bobo", ~10 actions de prospection/mois seulement |
| 5 | **Laforêt Paris 17e** | Agent | LeBonCoin, MeilleursAgents, SeLoger | Gain concret en mandats sans effort | ⚠️ Profil "installé", moins de besoin | Agence bien implantée, ne prospecte plus. Client potentiel si plug-and-play |
| 6 | **FREDELION Paris 8** | Agent auto-entrepreneur | SeLoger, MeilleursAgents, Immofacile | 🔥 Signaux de vie +++ | ✅ Intéressé | DVF/DPE jugés peu différenciants car déjà exploités. Les éléments de vie = vraie innovation perçue |

### Les 7 enseignements validés par les appels

**1. Les "éléments de vie" sont LE différenciateur — pas DVF/DPE**
Verbatim FREDELION : *"Les DPE et la DVF sont utiles mais déjà exploités par la concurrence. La vraie valeur ajoutée, c'est repérer les moments de bascule dans la vie des gens."*
Confirmé par Côté Particulier spontanément (mariages, divorces, mutations).
DVF + DPE = hygiène de base. Signaux de vie = ce pour quoi les agences paient.

**2. Qualité > Quantité — toujours**
Côté Particulier : *"Au minimum une quinzaine de leads ultra pertinents par mois, pas du volume."*
De Lachaise (brûlé par Realdvisor) : 5 leads livrés sur 30 promis en 6 mois → méfiance totale.
La promesse Priimo = moins mais mieux. Ne jamais promettre un volume élevé.

**3. Chaque lead doit contenir : nom + téléphone + adresse + contexte du bien**
De Lachaise a insisté explicitement. Un lead sans ces 4 infos est inutile.

**4. Le territoire exclusif rassure et différencie**
Côté Particulier l'a mentionné spontanément. Effet "outil sur-mesure".

**5. Le prix de référence du marché est ~200 €/mois**
Conseil Rive Gauche l'a cité spontanément. Ils paient déjà 1000 €/mois pour SeLoger + MeilleursAgents.

**6. L'essai gratuit 1 mois est le meilleur levier de conversion**
Côté Particulier l'a recommandé explicitement.

**7. Le porte-à-porte n'est PAS universel**
Laforêt a abandonné le porte-à-porte depuis le Covid. De Lachaise trouve les copropriétés pénibles. L'app mobile de navigation terrain n'est pas le cœur du produit. Le cœur = la liste de leads qualifiés.

### Ce que les appels ont INVALIDÉ ou nuancé

- ❌ Le porte-à-porte comme canal principal → pas universel, surtout à Paris
- ❌ L'app mobile comme priorité MVP → personne ne l'a demandée spontanément
- ❌ Le module dispatch/équipe comme besoin urgent → aucune mention spontanée
- ⚠️ Le prix de 99 €/mois → trop bas par rapport aux références du marché (200 €)
- ⚠️ DVF + DPE seuls comme proposition de valeur → insuffisant pour se différencier

---

## 4. MARCHÉ

### Taille du marché
- ~30 000 agences immobilières en France (Imop / Propulse Crédit Agricole 2024)
- 70 % sont des indépendantes (TPE 1–10 agents)
- 25 % sont des franchises (Century 21, Laforêt, Orpi, Guy Hoquet…)
- ~45 000 mandataires indépendants (IAD, Capifrance…)
- ~1 232 fermetures d'agences en 2024

### Taux d'équipement actuel en outils de prospection
- **30–40 %** des agences utilisent un outil dédié (Opco EP / estimations croisées)
- **60–70 %** fonctionnent encore manuellement
- Les TPE 1–3 agents = marché adressable principal non équipé

### Contexte réglementaire
- Pige téléphonique interdite depuis août 2025
- RGPD : données publiques exploitables, croisement nom + téléphone sans consentement = zone grise
- Le porte-à-porte ciblé par data reste le canal outbound conforme
- 60 % des agents attendent des outils conformes aux nouvelles règles (Yanport 2025)

### Ce que les agences paient déjà
- SeLoger + MeilleursAgents : 500–1500 €/mois
- Taktikimmo : ~100–300 €/mois
- Realdvisor : résultats jugés insuffisants (5/30 leads livrés)
- Maline : ~200–400 €/mois
- Pige Online : 29 €/mois

---

## 5. CONCURRENTS

### Concurrents directs

| Outil | Positionnement | Prix | Force | Faiblesse |
|-------|---------------|------|-------|-----------|
| **Maline.io** | Prospection prédictive Big Data, événements de vie, app mobile, territoire exclusif | ~200–400 €/mois | Seul vrai prédictif. 1500+ agences | Complexe, coûteux. *"Super outil pour qui l'exploite complètement"* |
| **Telescop.com** | BDD propriétaires massive (11M maisons, 5,7M avec tel), courriers, immo entreprise | Par département | Base la plus dense | Pas de scoring prédictif fort. Dense et complexe |
| **Klape.io** | OpenData + comportements web, leads contractuels garantis, Kanban | Non public | Combine data + comportement web | Très jeune, peu de retours clients |
| **Realty.fr** | Tout-en-un : CRM + pige + site + e-signature (Groupe Realty = Pige Online) | 79 €/mois | Le plus complet, moins cher | Pas un générateur de leads prédictif |
| **Realtys.pro** | Prospection simple DVF/DPE/Cadastre | 19 €/mois | Ultra-simple | Trop basique, pas de scoring avancé |

### Concurrents cités en discovery calls
- **Realdvisor** — utilisé par De Lachaise, insatisfait (5/30 leads livrés)
- **Taktikimmo** — utilisé par Conseil Rive Gauche, satisfait
- **Jinka** — mentionné par Côté Particulier comme référence
- **Immofacile** — utilisé par FREDELION en multicanal
- **SeLoger / MeilleursAgents / LeBonCoin** — canaux principaux actuels de toutes les agences

### Position de Priimo
Le vide à occuper : rigueur data de Maline + simplicité de Realtys.pro + signaux de vie comme différenciateur + ~200 €/mois avec territoire exclusif.
Priimo ne remplace pas SeLoger. C'est une **source complémentaire** de leads en amont du marché.

---

## 6. ARCHITECTURE TECHNIQUE

### Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14 + React + TypeScript + Tailwind CSS |
| Backend / BDD | Supabase (PostgreSQL + Edge Functions + Auth + pg_cron) |
| Cartographie | Google Maps My Maps (MVP) → Google Maps API ou Mapbox (v2) |
| Paiements | Stripe |
| Emails | Resend |
| Hébergement | Vercel |
| Prospection outbound | Lemlist / Waalaxi (mois 3+) |

### Sources de données

| Source | Données | Coût | Priorité |
|--------|---------|------|----------|
| **DVF (data.gouv.fr)** | Transactions depuis 2014 : prix, date, surface | 0 € | ✅ MVP |
| **DPE ADEME** | Score énergie, date diagnostic | 0 € | ✅ MVP |
| **BAN** | Géocodage français | 0 € | ✅ MVP |
| **BODACC** | Liquidations pro, cessions, dissolutions | 0 € | ✅ MVP (1er signal de vie) |
| **Cadastre** | Parcelle, surface terrain, bâti | 0 € | Phase 2 |
| **INSEE IRIS** | Données démographiques quartier | 0 € | Phase 2 |
| **SITADEL** | Permis de construire récents | 0 € | Phase 2 |
| **Datafoncier** | Propriétaires personnes morales | Convention | Phase 2 |
| **Pappers API** | Dirigeants + adresses | ~0,02 €/req | Phase 3 |

### Principe data fondamental
Ne jamais stocker la donnée brute. Requêtes par zone active uniquement. Stocker seulement les leads scorés. Coût infra cible : < 35 $/mois jusqu'à 50 clients.

### Structure Supabase

```sql
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  team_size INT,
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'trial',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  label TEXT,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  radius_km FLOAT NOT NULL DEFAULT 3,
  is_exclusive BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  lat FLOAT,
  lng FLOAT,
  parcelle_id TEXT,
  score INT CHECK (score >= 0 AND score <= 100),
  signal_type TEXT[],
  signals JSONB,
  property_type TEXT,
  surface FLOAT,
  estimated_value FLOAT,
  purchase_date DATE,
  purchase_price FLOAT,
  life_event TEXT,
  status TEXT DEFAULT 'nouveau',
  contacted_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lead_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id),
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Algorithme de scoring V1

```javascript
function scoreLead(signals) {
  let score = 0;

  // Durée de détention (DVF) — 5-12 ans = pic de revente
  if (signals.years_owned >= 5 && signals.years_owned <= 12) score += 25;

  // DPE récent (< 6 mois) — précède souvent une vente
  if (signals.days_since_dpe < 180) score += 20;

  // Plus-value estimée > 20% — incitation à vendre
  if (signals.estimated_gain_pct > 20) score += 15;

  // ★ Événement de vie (BODACC) — LE DIFFÉRENCIATEUR
  if (signals.life_event === 'liquidation_pro') score += 30;
  if (signals.life_event === 'cession_entreprise') score += 25;
  if (signals.life_event === 'dissolution_sci') score += 30;

  // Taux de rotation zone > 8%
  if (signals.zone_rotation_rate > 0.08) score += 10;

  return Math.min(score, 100);
}
```

---

## 7. ROADMAP PRODUIT

```
MVP (mois 1–2)
├── Pipeline : DVF + DPE + BAN + BODACC
├── Scoring V1 : 4 signaux (détention + DPE + plus-value + événement de vie)
├── Auth + définition zone (rayon km)
├── Dashboard : liste scorée + filtres + statuts + notes
├── Export : CSV + lien Google Maps My Maps
└── Stripe : essai 1 mois gratuit puis facturation

Phase 2 (mois 3–4)
├── Data : SITADEL, INSEE IRIS, Cadastre
├── Signaux de vie étendus
├── Carte interactive in-app
├── Territoire exclusif (non-chevauchement zones)
└── Scoring affiné par feedback clients

Phase 3 (mois 5–6+)
├── Module équipe (si demandé)
├── App mobile (si demandée)
├── Courriers automatisés
├── Scoring ML
└── API partenaires CRM
```

---

## 8. UX / NAVIGATION

### MVP — 2 écrans seulement

**Écran principal : MES PROSPECTS**
- Liste scorée avec pour chaque lead : adresse + score (/100) + signal principal + contexte bien + statut
- Filtres : score min, type signal, statut
- Actions : exporter CSV, générer lien Google Maps
- Clic sur lead → drawer avec détail complet + notes + historique

**Écran secondaire : PARAMÈTRES**
- Zone de prospection (carte + rayon)
- Abonnement (Stripe portal)
- Notifications

### V2 — Navigation complète (5 onglets max)
⚡ Tableau de bord — 📍 Prospects — 👥 Mon équipe — 📊 Performance — ⚙️ Paramètres

### Philosophie UX
- Zéro formation, opérationnel en 20 minutes
- Chaque lead = actionnable immédiatement (adresse + score + signal + contexte)
- Un écran = une question

---

## 9. BUSINESS MODEL

### Pricing

| Plan | Prix | Cible |
|------|------|-------|
| **Fondateur** (10 premiers) | 149 €/mois à vie | Early-adopters |
| **Standard** | 199 €/mois | Agence 1–5 agents |
| **Premium** | 299 €/mois | Agence 5–15 agents |
| **Réseau** | Sur devis (≥ 499 €) | Franchises |

- **Essai gratuit :** 1 mois sans engagement, sans CB
- **Remise annuelle :** −20 %
- **Promesse :** "15 leads ultra qualifiés/mois minimum" — jamais de volume élevé

### Projections MRR
```
Fin mois 2  →  10 × 149 €  =   1 490 €
Fin mois 3  →  25 × 199 €  =   4 975 €
Fin mois 5  →  50 × 199 €  =   9 950 €
Fin mois 6  →  80 × 210 €  =  16 800 €
```

---

## 10. GO-TO-MARKET

### Cible commerciale
Le **directeur d'agence** (pas le siège franchise — les directeurs paient les outils eux-mêmes).

### ICP (profil client idéal)
- Directeur agence indépendante, 2–10 agents, zone urbaine dense
- Paie déjà 500+ €/mois en outils (SeLoger, MeilleursAgents)
- A été déçu par un outil de prospection OU n'en a jamais eu
- N'est PAS le profil "installé depuis 30 ans, ne prospecte plus"

### Message principal
> *"Les portails vous donnent des leads en aval. Priimo vous donne des leads en amont — des propriétaires qui vont vendre, avant qu'ils ne soient sur le marché."*

### Canaux d'acquisition
1. Cold outreach LinkedIn + email (Waalaxi puis Lemlist)
2. LinkedIn organique (Build in Public)
3. Google Ads intent fort (mois 3+)
4. SEO : 3 articles/mois (mois 5+)
5. Partenariats CRM et formateurs immo

---

## 11. PHILOSOPHIE PRODUIT

1. **Les signaux de vie sont le cœur** — DVF/DPE = base, événements de vie = ce pour quoi on paie
2. **15 leads excellents > 100 leads moyens** — ne jamais promettre du volume
3. **Chaque lead = actionnable immédiatement** — adresse + score + signal + contexte
4. **Simplicité radicale** — compréhensible en 10 secondes par un directeur d'agence
5. **Ne jamais construire ce qui n'a pas été demandé** — Painted Door Test systématique
6. **Le scoring = avantage défendable** — affiné par feedback, effet réseau
7. **Complémentaire, pas concurrent** — Priimo ne remplace pas SeLoger
8. **Le territoire exclusif = levier business** — rareté, prix, rétention

---

## 12. CE QUI A ÉTÉ ÉCARTÉ

| Idée | Raison | Source |
|------|--------|--------|
| Nurturing / emailing auto | Leads rares, agences appellent en direct | Analyse marché |
| Leads acquéreurs | Pas de data publique exploitable | Analyse data |
| Freemium | Pas de conversion sans accompagnement | Benchmark |
| Prix < 99 € | Signal de faible valeur | Call Conseil Rive Gauche |
| App mobile MVP | Non demandée spontanément | 6 discovery calls |
| Module équipe MVP | Non mentionné spontanément | 6 discovery calls |
| DVF + DPE seuls | Jugé peu différenciant | Call FREDELION |
| Volume de leads élevé | Realdvisor = 30 promis, 5 livrés → client brûlé | Call De Lachaise |
| Stocker DVF complètes FR | 6M lignes inutiles | Architecture |

---

## 13. FRAMEWORKS

- **Mom Test** — Questions sur le passé, pas le futur hypothétique
- **Do Things That Don't Scale** — Valider avant d'automatiser
- **Jobs To Be Done** — Job = "rentrer des mandats exclusifs sans augmenter l'équipe"
- **Painted Door Test** — Tester l'intention avant de coder
- **1000 True Fans** — 10 fanatiques > 100 passifs
- **Charge More** — Prix bas = signal faible
- **Narrative First** — Pige interdite → data prédictive → Priimo = le passeport
- **Build in Public** — LinkedIn = distribution gratuite
- **Concierge MVP** — Vendre le résultat, automatiser après

---

*Version 2.0 — 6 mai 2026*  
*Mettre à jour après chaque batch de 5 appels et après les 10 premiers clients.*