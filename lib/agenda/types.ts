export type AgendaEvenement = {
  id: string;
  titre: string;
  jour: string;
  debut: string | null;
  fin: string | null;
  journee: boolean;
};

export type AgendaReponse = {
  connected: boolean;
  calendarEmail?: string | null;
  /** Plage couverte : « semaine:2026-09-07 » ou « mois:2026-09 ». */
  cle?: string;
  events: AgendaEvenement[];
};
