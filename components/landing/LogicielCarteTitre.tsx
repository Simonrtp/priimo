/**
 * Titre des cartes fonctionnalités sur l’accueil (LogicielOnglets).
 * Toujours le `titre` brut — pas de pastille colorée (réservée aux pages /fonctionnalites/*).
 */
export default function LogicielCarteTitre({ titre }: { titre: string }) {
  return <h3 className="logiciel-carte-title">{titre}</h3>;
}
