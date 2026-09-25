# Accueil priimo.fr — maquette 2026

Nouvelle page d'accueil, pensée pour un directeur d'agence indépendante qui arrive
sur le site après un appel téléphonique et doit comprendre en dix secondes.

## Ouvrir la maquette

Double-cliquer sur `index.html`. Aucun serveur n'est nécessaire : la page charge
directement le logo, les stickers, les avatars, la police Inter et la vidéo depuis
`public/`.

Pour comparer les deux formats demandés, ouvrir les outils de développement du
navigateur et régler la largeur sur **1440 px** (ordinateur) puis **390 px** (mobile).

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure. Une `<section>` par futur composant React, nommé dans le bandeau de commentaire. |
| `accueil.css` | Styles. Un bloc par section, dans le même ordre, avec les mêmes noms. |
| `accueil.js` | Outils de maquette : emplacements de capture, vidéo, panneau de réglages. |

## Panneau de réglages

Bouton « Réglages » en bas à droite.

- **Chaque texte de la page** y est modifiable, groupé par section. La modification
  est immédiate et conservée dans le navigateur.
- **Afficher la section Tarifs** : cochée par défaut.
- **Afficher l'emplacement témoignage** : décochée par défaut, conformément à la règle
  (aucun témoignage tant qu'une agence n'a pas donné son accord écrit).
- **Copier les textes** met tous les textes dans le presse-papier au format JSON,
  prêt à être relu ou repris.
- **Réinitialiser** revient aux textes d'origine.

Le panneau se pilote par l'attribut `data-txt="Section / Champ"` dans le HTML :
ajouter cet attribut à un élément suffit à le rendre modifiable, aucun réglage à
tenir à jour ailleurs.

## Captures à déposer

Tant qu'un fichier est absent, le cadre affiche le nom attendu à sa place : la page
reste lisible et indique exactement ce qui manque. Déposer les PNG dans
`public/captures/` sous ces noms :

| Fichier | Format conseillé | Contenu |
| --- | --- | --- |
| `hero-ordinateur.png` | 1920 × 1080 | Image d'attente de la vidéo (première image du film). |
| `hero-mobile.png` | 1170 × 2500 | Accueil mobile du négociateur. |
| `journee-matin.png` | 1600 × 1000 | Accueil ordinateur : relances, visites, adresses du jour. |
| `journee-rue-note.png` | 1170 × 2500 | Note dictée devenue fiche contact. |
| `journee-rue-carte.png` | 1170 × 2500 | Carte du secteur et tournée. |
| `journee-bureau.png` | 1600 × 1000 | Tableau des prospects, du contact au mandat. |
| `journee-soir.png` | 1170 × 2500 | Fin de journée, tout est déjà enregistré. |
| `directeur-entonnoir.png` | 1600 × 1000 | Entonnoir : contacts, qualifiés, estimations, mandats. |
| `directeur-objectifs.png` | 1200 × 900 | Cartes d'objectifs par négociateur. |
| `plaisir-objectifs.png` | 1170 × 2500 | Carte d'objectifs à stickers. |
| `plaisir-progression.png` | 1170 × 2500 | Progression de la semaine. |
| `plaisir-equipe.png` | 1170 × 2500 | Cartes de l'équipe avec les avatars. |

Toutes les données visibles dans ces captures doivent être fictives : noms, adresses,
montants, volumes.

La vidéo du hero utilise le fichier existant `public/priimo-film-heros.mp4`
(1920 × 1080, 63 secondes). Le bouton « Voir Priimo en 60 secondes » l'ouvre en grand
avec le son ; dans le cadre d'ordinateur elle tourne en sourdine, en boucle.

## Reprise dans le site Next.js

1. **Chemins d'images** : remplacer `../../public/` par `/` dans le HTML et le CSS
   (une seule occurrence dans le CSS, les `@font-face`).
2. **Variables** : le bloc `:root` en tête de `accueil.css` contient toutes les
   couleurs, tailles de texte, rayons et ombres. C'est le seul endroit à raccorder au
   design system.
3. **Découpage** : chaque `<section>` devient le composant nommé dans son commentaire
   (`AccueilEnTete`, `AccueilHero`, `AccueilProbleme`, `AccueilJournee`,
   `AccueilDirecteur`, `AccueilPlaisir`, `AccueilTemoignage`, `AccueilTarifs`,
   `AccueilQuestions`, `AccueilAppelFinal`, `AccueilPied`, `AccueilVideoModale`).
   Les classes CSS sont déjà préfixées par section, sans collision avec l'existant.
4. **Liens** : les boutons de démonstration pointent vers `/rendez-vous`
   (`CALENDLY_URL` dans `lib/calendly.ts`), le pied de page vers `/mentions-legales`
   et `/politique-de-confidentialite`.
5. **Ne pas reprendre** : le panneau de réglages et les emplacements de capture
   (`.ecran__vide`, `.squelette`) ne servent qu'à la maquette. Seule la modale vidéo
   demande un petit composant client.
6. **Accordéon** : construit avec `<details>` / `<summary>`, sans JavaScript.

## Règles respectées

- Aucun témoignage, aucun logo de client, aucun chiffre de résultat ; seul un
  emplacement de témoignage existe, masqué par défaut.
- Aucun emoji : les touches illustrées sont les stickers et les avatars de l'app.
- Alternance de sections crème et bleu nuit, titres larges, phrases courtes.
- Le mot « intelligence artificielle » et son sigle n'apparaissent nulle part : la
  promesse est formulée par l'usage (dicter, ranger, ne rien ressaisir).
