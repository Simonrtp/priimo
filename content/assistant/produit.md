# Base de connaissance produit

Réponses sur le fonctionnement de Priimo. Ce fichier est la seule source de
l'assistant sur ce sujet : il ne consulte aucune donnée d'agence pour y
répondre. Un sujet = un titre de niveau 2, une ligne `Écran:` facultative,
puis un paragraphe. Les mots de la ligne `Mots-clés:` servent à retrouver le
sujet ; écrivez-y les formulations que les agents emploient vraiment.

## Le bouton Nouveau
Écran: /dashboard
Mots-clés: nouveau, bouton nouveau, créer, ajouter, plus, saisir

Le bouton Nouveau, en haut à droite, ouvre la création rapide. Il sert à
saisir un contact, un bien ou une note de terrain sans quitter l'écran où
vous êtes. Sur mobile, c'est le bouton rond au centre de la barre du bas.
Chaque création part directement dans votre base d'agence : ce que vous
saisissez est visible par votre équipe selon les règles de visibilité de
votre rôle.

## L'accueil
Écran: /dashboard
Mots-clés: accueil, aujourd hui, page d accueil, tableau de bord, journee

L'accueil montre ce qu'il y a à faire aujourd'hui, classé par urgence. Les
cartes viennent de vos données : une promesse qui arrive à échéance, une
visite sans retour, un rapprochement possible, une relance à passer. Chaque
carte porte une action unique. Les compteurs de portefeuille en dessous
donnent l'état d'ensemble : mandats actifs, leads non pris, rendez-vous sans
suite, mandats qui dorment.

## La prospection
Écran: /dashboard/prospection
Mots-clés: prospection, prospects, leads, pipeline, kanban, liste

La prospection rassemble les adresses détectées comme susceptibles de se
vendre. Chaque ligne est un prospect : une adresse, un score, des signaux.
Vous pouvez la travailler en liste ou en kanban. Prendre un lead, c'est se
l'attribuer : il sort du lot commun et entre dans votre pipeline.

## Le score d'un prospect
Mots-clés: score, note, chiffre, pastille, couleur du score, priorite

Le score va de 0 à 100 et répond à une seule question : faut-il y aller
maintenant. Il combine l'enjeu — ce que l'adresse peut rapporter — et
l'imminence — à quel point le moment est propice. Un score élevé ne promet
pas un mandat : il dit que l'adresse mérite votre temps avant les autres. La
teinte suit le chiffre en continu, du vert au orange.

## La vérification marché
Mots-clés: verification marche, marche, hors marche, deja en vente, annonce, portail

La vérification marché regarde si l'adresse est déjà en vente ailleurs. Un
prospect marqué hors marché a été retrouvé sur une annonce publique : un
confrère l'a probablement déjà rentré, ou le propriétaire vend seul. La date
de vérification est affichée sur la fiche. Ce n'est pas une raison
d'abandonner l'adresse, c'est une raison de changer d'approche.

## La prise et le lot du lundi
Écran: /dashboard/prospection
Mots-clés: prise, prendre un lead, lot, livraison, non pris, lundi, attribution

Les leads sont livrés par lots. Un lead livré et non pris reste dans le lot
commun de l'agence : n'importe qui peut le prendre. Le prendre l'attribue à
votre nom et le fait entrer dans votre pipeline. Le compteur « leads non
pris » de l'accueil mesure ce qui dort encore dans le lot.

## Le pipeline et ses colonnes
Écran: /dashboard/prospection
Mots-clés: pipeline, colonne, etape, stage, kanban, avancement, portillon

Le pipeline suit un prospect de la première approche au mandat signé. Chaque
colonne est une étape ; un prospect avance en le déplaçant. Le passage d'une
colonne à l'autre est un engagement, pas un rangement : ne faites avancer une
fiche que lorsque quelque chose s'est réellement produit avec le
propriétaire.

## Les types de contact
Écran: /dashboard/contacts
Mots-clés: type de contact, vendeur, acquereur, locataire, gardien, commercant

Un contact porte un type qui dit ce qu'il attend de vous. Vendeur : il a un
bien à céder. Acquéreur : il cherche, avec des critères de secteur, de budget
et de surface. Locataire : il occupe ou cherche à louer. Gardien et commerçant
sont des relais de terrain — ils savent ce qui bouge dans l'immeuble et dans
la rue avant tout le monde. Le type détermine ce que Priimo vous propose : un
acquéreur alimente les rapprochements, un gardien nourrit vos notes de
secteur.

## Le rapprochement acquéreur
Écran: /dashboard/contacts
Mots-clés: rapprochement, acquereur, matcher, correspondre, qui cherche, proposer

Le rapprochement confronte les critères de vos acquéreurs aux biens que vous
rentrez. Quand un bien correspond au secteur, au budget et à la surface d'un
acquéreur, Priimo vous le signale. C'est un tri, pas une décision : à vous de
juger si l'appel vaut la peine.

## Les biens
Écran: /dashboard/biens
Mots-clés: biens, mandat, mandat exclusif, mandat simple, compromis, vendu

Les biens sont les mandats de l'agence et leur avancement : estimation,
mandat simple, mandat exclusif, compromis, vendu, archivé. Un bien porte son
propriétaire, ses caractéristiques, ses visites et ses photos. Le compteur
« mandats qui pourrissent » de l'accueil signale ceux qui dépassent soixante
jours avec moins de trois visites.

## La carte
Écran: /dashboard/carte
Mots-clés: carte, plan, map, secteur, immeuble, pin, 3d

La carte place sur le terrain tout ce que vous avez en base : prospects,
contacts, biens, notes. Toucher un immeuble ouvre sa fiche. Le bouton Couches
choisit ce qui s'affiche. Le bouton 2D/3D bascule entre le plan à plat et le
relief des immeubles.

## La couche cadastre
Écran: /dashboard/carte
Mots-clés: cadastre, parcelle, dpe, ventes, copropriete, dvf, couche

La couche cadastre superpose le parcellaire public à votre secteur. Elle
ouvre trois sous-couches. DPE : l'étiquette énergie des logements, utile pour
repérer les passoires qui vont devoir se vendre ou se rénover. Ventes : les
prix des transactions passées, pour argumenter une estimation. Copropriétés :
le nombre de lots et les procédures en cours, qui signalent un immeuble en
difficulté. Le cadastre demande un certain niveau de zoom pour s'afficher.

## La tournée
Écran: /dashboard/carte
Mots-clés: tournee, sortie, porte a porte, terrain, itineraire, marche

La tournée prépare une sortie de prospection physique. Elle part de l'agence,
enchaîne les adresses à visiter et revient au point de départ, par le chemin
piéton le plus court. Vous pouvez retirer une adresse, en ajouter une par
recherche ou en touchant un immeuble sur la carte.

## L'estimation
Écran: /dashboard/estimation
Mots-clés: estimation, estimer, prix, valeur, fourchette, avis de valeur

L'estimation produit une fourchette de prix pour une adresse à partir des
transactions comparables du secteur. Elle affiche un indice de fiabilité :
plus il y a de ventes proches et récentes, plus la fourchette est resserrée.
C'est une base de discussion avec le propriétaire, pas un avis de valeur
signé.

## Les notes de terrain
Écran: /dashboard/notes
Mots-clés: note, dictee, vocal, dicter, terrain, micro

Les notes de terrain se dictent à la voix, depuis n'importe quel écran.
Priimo les transcrit, les rattache à l'adresse ou au contact concerné et en
extrait ce qui peut l'être. Une note privée n'est visible que de vous ; une
note d'agence est visible par l'équipe.

## Les rôles et la visibilité
Écran: /dashboard/settings
Mots-clés: role, directeur, agent, visibilite, qui voit quoi, equipe, droits

Un agent voit les fiches de son agence, sauf celles assignées à un collègue
et les notes privées des autres. Un directeur voit l'ensemble de l'activité
de son agence. Personne ne voit rien d'une autre agence. Les conversations
avec l'assistant sont privées, y compris pour le directeur.
