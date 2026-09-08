export type AgendaEvenement = {
  id: string;
  titre: string;
  jour: string;
  debut: string | null;
  fin: string | null;
  journee: boolean;
};
