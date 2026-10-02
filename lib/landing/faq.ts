/**
 * Objections d'un directeur avant de payer.
 * Première phrase = réponse directe. Ensuite le pourquoi, pour rassurer.
 */

export type FaqItem = {
  id: string;
  q: string;
  a: string;
};

export type FaqGroup = {
  id: string;
  title: string;
  items: FaqItem[];
};

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "adoption",
    title: "L'adoption",
    items: [
      {
        id: "adoption-usage",
        q: "Mes agents vont-ils vraiment l'utiliser ?",
        a: "Parce que Priimo se saisit à la voix, en quelques secondes, depuis la rue — pas le soir au bureau. Un agent qui doit remplir un formulaire en rentrant n'ouvre plus l'outil. Un agent qui dicte au pied de l'immeuble range le passage tout de suite, et l'agence en garde la mémoire.\n\nOn n'ajoute pas une tâche de plus. On remplace le carnet. C'est pour ça que ça tient dans le temps.",
      },
      {
        id: "adoption-formation",
        q: "Faut-il une formation ?",
        a: "Non. La démo de 20 minutes suffit pour démarrer : on voit le secteur, on dicte une note, on comprend la liste du lundi. Chaque agent est opérationnel le jour même, sans session de formation dédiée.\n\nSi un logiciel de terrain a besoin d'un mode d'emploi, ce n'est plus un logiciel de terrain. On reste joignable ensuite si une question arrive.",
      },
      {
        id: "adoption-app",
        q: "Faut-il installer une application ?",
        a: "Non. Priimo s'ouvre dans le navigateur du téléphone. On peut l'ajouter à l'écran d'accueil, comme une application, sans store et sans installation à maintenir.\n\nSi le téléphone change, on se reconnecte. Rien n'est enfermé « dans l'appli » : tout reste dans l'agence.",
      },
      {
        id: "adoption-reseau",
        q: "Et si l'agent n'a pas de réseau dans une cage d'escalier ?",
        a: "Non. La dictée reste sur le téléphone. Elle part dès que le réseau revient, sans que l'agent ait à y penser.\n\nLe terrain ne s'arrête pas pour un palier sans 4G. L'outil non plus : on ne demande pas à quelqu'un de ressaisir ce qu'il vient de dire.",
      },
    ],
  },
  {
    id: "bascule",
    title: "Le changement de logiciel",
    items: [
      {
        id: "bascule-transfert",
        q: "Comment je transfère mes données ?",
        a: "Vous nous envoyez l'export de votre logiciel, ou vos fichiers Excel. On s'occupe du transfert.\n\nLe but n'est pas de vous faire recommencer à zéro. C'est de retrouver votre fichier dans Priimo, prêt à servir, avant que l'équipe reparte sur le terrain.",
      },
    ],
  },
  {
    id: "donnees",
    title: "Les données",
    items: [
      {
        id: "donnees-propriete",
        q: "À qui appartiennent les données ?",
        a: "Tout reste à l'agence. Les données appartiennent à l'agence, pas au négociateur.\n\nC'est souvent ce qui bloque un directeur : on a peur de construire un fichier pour quelqu'un d'autre. Ici, si un agent part, ses notes, ses contacts et son historique restent. L'agence continue.",
      },
      {
        id: "donnees-export",
        q: "Si j'arrête Priimo, je récupère tout ?",
        a: "Oui, vous récupérez tout. Contacts et biens s'exportent en fichier, à tout moment, sans demander une autorisation spéciale.\n\nOn ne vous retient pas par les données. Un outil dont on ne peut pas sortir n'est pas un outil d'agence.",
      },
      {
        id: "donnees-visibilite",
        q: "Qui voit quoi dans l'équipe ?",
        a: "Chaque agent voit ses dossiers et les prospects non attribués. Il ne s'installe pas dans le fichier d'un collègue. Le directeur voit toute l'agence.\n\nUne note privée n'est lisible que par son auteur — y compris si vous êtes directeur. On a besoin d'une mémoire d'agence, pas d'un outil où plus rien n'est dit parce que tout le monde lit tout.",
      },
    ],
  },
  {
    id: "directeur",
    title: "Le directeur",
    items: [
      {
        id: "directeur-activite",
        q: "Qu'est-ce que je vois de l'activité de mon équipe ?",
        a: "Les objectifs de chacun et l'entonnoir de l'agence, uniquement à partir de ce que Priimo enregistre. Jamais un chiffre déclaré à la main.\n\nUn indicateur que l'on tape soi-même n'est pas un indicateur. Vous pilotez ce qui s'est passé, pas ce que l'on a bien voulu saisir.",
      },
      {
        id: "directeur-surveillance",
        q: "Mes agents vont-ils se sentir surveillés ?",
        a: "Non. Priimo ne montre jamais au directeur où se trouvent ses agents. Ce n'est pas un outil de géolocalisation d'équipe.\n\nUne note privée reste lisible seulement par son auteur. On mesure le travail fait dans l'outil — les notes, les suites, ce qui avance — pas la position de quelqu'un dans la rue. C'est la différence entre piloter une agence et fliquer une tournée.",
      },
      {
        id: "directeur-multi",
        q: "J'ai plusieurs agences, ça marche ?",
        a: "Oui, ça tient. Vous passez d'une agence à l'autre depuis le même compte.\n\nChaque agence reste isolée : on ne mélange pas les fichiers. Vous voyez la vôtre, pas celle d'à côté.",
      },
    ],
  },
  {
    id: "valeur",
    title: "L'avis de valeur",
    items: [
      {
        id: "valeur-calcul",
        q: "Comment le prix est-il calculé ?",
        a: "À partir des ventes réellement enregistrées autour du bien, ajustées selon ses caractéristiques. C'est une base de discussion, pas un avis signé à votre place.\n\nL'agent garde le dernier mot sur le prix. L'outil documente ; il ne remplace pas le jugement de celui qui est devant le vendeur.",
      },
    ],
  },
  {
    id: "prix",
    title: "Prix et engagement",
    items: [
      {
        id: "prix-cout",
        q: "Combien ça coûte ?",
        a: "70 € HT par mois pour 5 sièges, puis 50 € HT par siège supplémentaire. Le premier mois est offert.\n\nC'est le prix de l'agence qui tourne, pas d'un module à rajouter tous les mois. Vous savez ce que vous payez avant de démarrer.",
      },
      {
        id: "prix-engagement",
        q: "Y a-t-il un engagement ?",
        a: "Non. L'abonnement est mensuel. Vous arrêtez quand vous voulez, pour la fin du mois en cours.\n\nOn n'a pas besoin de vous bloquer douze mois pour que l'outil ait un intérêt. S'il ne prend pas dans l'agence, vous partez.",
      },
      {
        id: "prix-cb",
        q: "Faut-il une carte bancaire pour l'essai ?",
        a: "Non. Le premier mois se fait sans carte bancaire.\n\nL'essai sert à voir si l'équipe l'utilise vraiment. Pas à démarrer un prélèvement avant d'avoir mis un pied dans l'outil.",
      },
    ],
  },
  {
    id: "confiance",
    title: "La confiance",
    items: [
      {
        id: "confiance-perennite",
        q: "Et si Priimo disparaît ?",
        a: "Vos contacts et vos biens restent exportables à tout moment. Vous ne restez pas bloqué dans l'outil.\n\nC'est la même logique que l'arrêt volontaire : le fichier est à vous. On ne construit pas une agence sur un coffre dont on n'a pas la clé.",
      },
      {
        id: "confiance-aide",
        q: "Qui m'aide en cas de problème ?",
        a: "Par WhatsApp, au 07 66 85 71 65, ou par e-mail à hello@priimo.fr.\n\nPas un standard anonyme : on répond à l'agence. Le but est de débloquer le terrain, pas d'ouvrir un ticket pour la semaine suivante.",
      },
    ],
  },
];

const HOME_IDS = [
  "adoption-usage",
  "adoption-formation",
  "donnees-propriete",
  "donnees-export",
  "donnees-visibilite",
  "directeur-surveillance",
  "prix-cout",
  "prix-engagement",
] as const;

const BY_ID = new Map(FAQ_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item])));

/** Huit objections sur l'accueil. Les deux premières portent sur l'adoption. */
export const FAQ_HOME: FaqItem[] = HOME_IDS.map((id) => {
  const item = BY_ID.get(id);
  if (!item) throw new Error(`Question d'accueil introuvable : ${id}`);
  return item;
});

export const FAQ_ALL: FaqItem[] = FAQ_GROUPS.flatMap((group) => group.items);

export function faqAnswerPlain(answer: string): string {
  return answer.replace(/\s+/g, " ").trim();
}
