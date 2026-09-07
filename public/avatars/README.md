# Avatars onboarding

Personnages proposés à l'étape « avatar » : `chat.webp`, `hibou.webp`, `lapin.webp`,
`ours.webp`, `poulpe.webp`, `random.webp`, `renard.webp`, `robot.webp`, `singe.webp`,
`tortue.webp` — 256×256, fond transparent, détourés et compressés (~15 Ko chacun).

Sources originales : les PNG haute résolution à la racine de `public/`.
Pour en ajouter un : déposer le PNG dans `public/`, générer une version 256×256 ici,
puis l'ajouter à `AVATAR_PERSONNAGES` dans `lib/onboarding/parcours.ts`.

Les `avatar-01.svg` … `avatar-12.svg` sont les anciens placeholders : plus proposés
au choix, conservés uniquement pour les profils qui en auraient un enregistré en base.
