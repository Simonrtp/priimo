# Politique de confidentialité — Priimo

## 1. Qui traite vos données

Le responsable de traitement, pour le site et pour les comptes Priimo, est :

**Simon**, entrepreneur individuel, enseigne **Priimo** — 27 rue A. Peunaud, Paris, France — hello@priimo.fr.

Lorsqu’une agence saisit dans Priimo le fichier de **ses** clients (contacts, notes, biens, messages), **l’agence est responsable de ce traitement**. Priimo agit alors comme **sous-traitant** : nous hébergeons et faisons fonctionner l’outil, nous ne réutilisons pas ce fichier pour notre propre prospection.

## 2. Ce que couvre cette politique

- le site priimo.fr (présentation, prise de rendez-vous) ;
- l’application Priimo (tableau de bord, comptes, intégrations) ;
- le support et les échanges commerciaux.

## 3. Données que nous traitons

Selon ce que vous faites, nous pouvons traiter :

- **Compte professionnel** : prénom, nom, email, téléphone, rôle (directeur / collaborateur), nom et adresse de l’agence, secteur de travail.
- **Connexion** : identifiants (mot de passe hashé), sessions.
- **Usage de l’outil** : actions dans l’application, compteurs d’activité, paramètres.
- **Fichier de l’agence** (sous-traitance) : contacts, biens, prospects, notes (y compris dictées et transcrites), photos, assignations, historique de pipeline.
- **Intégrations, si vous les branchez** :
  - Google Agenda : lecture des événements de la semaine (jetons chiffrés, pas de modification de l’agenda) ;
  - Gmail : lecture limitée aux messages des domaines portail autorisés, pour ranger les demandes entrantes (jetons chiffrés) ;
  - passerelle de diffusion : métadonnées d’annonces publiées, pas le contenu de toute votre messagerie.
- **Prise de contact** : ce que vous envoyez par email, WhatsApp ou Calendly.
- **Technique** : logs, adresse IP, type de navigateur — pour la sécurité et le bon fonctionnement.
- **Audience du site** : mesures agrégées via Vercel Analytics.

**Adresses proposées à la prospection.** Priimo croise des bases françaises (publiques et, le cas échéant, privées) : DVF, DPE ADEME, BODACC, cadastre, copropriétés, permis, et d’autres signaux de marché. Pour un **particulier**, l’outil montre une **adresse** et un **contexte** — pas un nom acheté à un courtier, pas un téléphone personnel. Pour une **société**, des informations de dirigeants issues de registres officiels peuvent apparaître.

Nous ne revendons pas vos données.

## 4. Pourquoi, et sur quelle base

- Fournir le service souscrit — **contrat**.
- Créer et gérer les comptes, facturer — **contrat**.
- Répondre à une demande de démo — **mesures précontractuelles** / **intérêt légitime**.
- Support — **contrat** / **intérêt légitime**.
- Sécurité, prévention des abus — **intérêt légitime**.
- Améliorer le produit (retours d’usage, qualité des adresses) — **intérêt légitime**.
- Obligations comptables et légales — **obligation légale**.
- Intégrations Google ou portail — **contrat**, à votre demande.

## 5. Destinataires

Les données sont vues par les personnes habilitées chez Priimo, par les membres de **votre** agence selon les règles de visibilité du logiciel, et par nos prestataires :

- **Supabase** — base de données, authentification ;
- **Vercel** — hébergement, analytics ;
- **Stripe** — paiement (nous ne stockons pas le numéro de carte) ;
- **Resend** — emails transactionnels ;
- **Calendly** — si vous réservez une démo ;
- **Mapbox** — carte ;
- **Google** — uniquement si vous connectez Agenda ou Gmail ;
- **Passerelle de diffusion** (Ubiflow, Diffuze ou équivalent) — uniquement si l’agence active la publication d’annonces.

Ces prestataires sont choisis pour pouvoir travailler en conformité avec le RGPD et sont encadrés contractuellement.

## Données issues de Google (Gmail)

Cette section décrit uniquement les données obtenues lorsque vous connectez Gmail à Priimo (scope `gmail.readonly`) : jetons d’accès, adresse de la boîte, et contenu des e-mails des domaines portail autorisés, le temps de les parser.

**Trajet.** Priimo reçoit une notification de nouveau message, ouvre l’e-mail uniquement si l’expéditeur appartient à la liste blanche des portails immobiliers, en extrait les champs de la demande (nom, téléphone, e-mail, référence d’annonce, message), puis jette le corps brut. Le corps n’est jamais enregistré.

**Tiers auxquels ces données sont communiquées.** Chaque service ci-dessous les traite uniquement pour fournir le service à l’utilisateur qui a connecté Gmail :

- **Vercel** — héberge l’application Priimo : callback OAuth, webhook de notification, exécution du parseur en mémoire.
- **Supabase** — base de données : jetons OAuth chiffrés, identifiant du message, et informations extraites (coordonnées du demandeur, référence, extrait du message de demande). Pas le corps brut de l’e-mail.

Les notifications de nouveaux messages transitent par **Google Cloud Pub/Sub** (infrastructure Google) : identifiant de la boîte et curseur d’historique, pas le contenu des e-mails.

Le contenu des e-mails Gmail n’est **pas** envoyé à Mistral ni à aucun autre modèle d’IA. Les informations extraites ne transitent **pas** par Resend : elles s’affichent dans Priimo, pour l’agence. Les données obtenues via les API Google Workspace ne sont pas utilisées pour développer, améliorer ou entraîner des modèles d’IA ou d’apprentissage automatique non personnalisés.

**Engagement.** Aucune vente, aucune publicité, aucun courtier en données, aucun transfert à des tiers pour une autre finalité. Divulgation uniquement si la loi l’exige.

**Lecture humaine.** Aucune lecture humaine du contenu des e-mails, sauf accord explicite de l’utilisateur, raison de sécurité, ou obligation légale.

**Utilisation limitée.** L’utilisation par Priimo des informations reçues des API Google et leur transfert à toute autre application se conforment à la [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy#limited-use), y compris les exigences d’utilisation limitée (Limited Use).

Priimo's use and transfer to any other app of information received from Google APIs will adhere to [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy#limited-use), including the Limited Use requirements.

## 6. Combien de temps

- **Compte** : pendant l’abonnement, puis le temps nécessaire pour clôturer (export, factures, litige).
- **Fichier agence** : tant que le compte existe ; après résiliation, conservation limitée puis suppression, sauf obligation légale.
- **Facturation** : 10 ans.
- **Logs techniques** : en principe 12 mois au plus.
- **Demandes de démo** : jusqu’à 3 ans après le dernier échange, sauf opposition.
- **Jetons Google** : jusqu’à déconnexion ou résiliation.

## 7. Vos droits

Vous pouvez demander l’**accès**, la **rectification**, l’**effacement**, la **limitation**, l’**opposition**, la **portabilité** (quand elle s’applique), et fixer des directives après décès.

Écrivez à hello@priimo.fr. Réponse sous un mois.

Vous pouvez aussi saisir la **CNIL** (cnil.fr).

Si vous êtes collaborateur d’une agence et que la demande porte sur le fichier clients de l’agence, nous transmettons à l’agence, qui reste responsable de ce fichier.

## 8. Sécurité

Communications chiffrées (HTTPS), mots de passe hashés, accès restreints, jetons d’intégration chiffrés, sauvegardes. Aucun système n’est infaillible : en cas d’incident ayant un risque élevé pour vos droits, nous vous en informons comme le prévoit le RGPD.

## 9. Transferts hors Union européenne

Certains prestataires (Vercel, Stripe, Google, Calendly, Resend, Mapbox) peuvent traiter des données hors UE. Dans ce cas, des garanties adaptées sont prévues (clauses contractuelles types ou mécanisme équivalent).

## 10. Prospection menée par l’agence

L’agence décide **comment** elle contacte une adresse. Depuis le **11 août 2026**, le démarchage téléphonique des consommateurs est interdit par principe (loi n° 2025-594 du 30 juin 2025), sauf consentement préalable valable ou cas prévus par le Code de la consommation.

Priimo ne fournit pas de téléphone personnel de particulier pour appeler à froid. Le porte-à-porte, le courrier et les autres canaux restent de la responsabilité de l’agence, dans le respect du RGPD et des règles professionnelles.

## 11. Cookies

Voir aussi les mentions légales. Sur le site : cookies nécessaires, Vercel Analytics, Calendly si vous ouvrez une démo. Dans l’application : cookies de session indispensables.

## 12. Modifications

La date en tête de page fait foi. Un changement important vous sera signalé par email ou dans l’application.

## 13. Contact

hello@priimo.fr — 07 66 85 71 65 — **WhatsApp** : 07 66 85 71 65.
