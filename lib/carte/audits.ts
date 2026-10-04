/**
 * Audits énergétiques réglementaires (base ADEME, depuis septembre 2023).
 *
 * Un audit est exigé pour vendre une maison ou un immeuble en monopropriété
 * classé F ou G (E depuis 2025) ; il précède aussi les rénovations aidées.
 * Dans les deux cas, le propriétaire bouge : c'est un signal de terrain.
 *
 * La base publie une ligne par scénario (« état initial », puis les travaux
 * proposés). On les regroupe en un audit : la classe d'aujourd'hui et la
 * meilleure classe atteignable. Pur.
 */

import { parseDpeLetter, type DpeLetter } from '@/lib/carte/dpe-public';

export type LigneAudit = {
  n_audit?: string | null;
  categorie_scenario?: string | null;
  date_etablissement_audit?: string | null;
  classe_bilan_dpe?: string | null;
  typologie_logement?: string | null;
  surface_habitable_logement?: number | null;
  surface_habitable_immeuble?: number | null;
  n_etage_appart?: string | number | null;
  identifiant_ban?: string | null;
};

export type AuditEnergetique = {
  numero: string;
  date: string;
  banId: string | null;
  /** Classe du logement avant travaux. */
  classeActuelle: DpeLetter | null;
  /** Meilleure classe des scénarios de travaux proposés. */
  classeVisee: DpeLetter | null;
  typologie: string | null;
  surface: number | null;
  etage: number | null;
};

const RANG: Record<DpeLetter, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6 };

function meilleure(a: DpeLetter | null, b: DpeLetter | null): DpeLetter | null {
  if (!a) return b;
  if (!b) return a;
  return RANG[a] <= RANG[b] ? a : b;
}

function etatInitial(categorie: string | null | undefined): boolean {
  return /initial/i.test(categorie ?? '');
}

export function regrouperAudits(lignes: readonly LigneAudit[]): AuditEnergetique[] {
  const parNumero = new Map<string, AuditEnergetique>();
  for (const l of lignes) {
    const numero = l.n_audit?.trim();
    const date = l.date_etablissement_audit?.slice(0, 10);
    if (!numero || !date) continue;
    let a = parNumero.get(numero);
    if (!a) {
      a = {
        numero,
        date,
        banId: l.identifiant_ban?.trim() || null,
        classeActuelle: null,
        classeVisee: null,
        typologie: null,
        surface: null,
        etage: null,
      };
      parNumero.set(numero, a);
    }
    const classe = parseDpeLetter(l.classe_bilan_dpe);
    if (etatInitial(l.categorie_scenario)) {
      a.classeActuelle = classe;
      a.typologie = l.typologie_logement?.trim() || a.typologie;
      const surface = l.surface_habitable_logement ?? l.surface_habitable_immeuble ?? null;
      if (typeof surface === 'number' && surface > 0) a.surface = surface;
      const etage = Number(l.n_etage_appart);
      if (Number.isFinite(etage) && etage >= 1) a.etage = etage;
    } else {
      a.classeVisee = meilleure(a.classeVisee, classe);
    }
  }
  // La classe visée n'a de sens que si elle améliore la situation.
  for (const a of parNumero.values()) {
    if (a.classeActuelle && a.classeVisee && RANG[a.classeVisee] >= RANG[a.classeActuelle]) a.classeVisee = null;
  }
  return [...parNumero.values()].sort((x, y) => y.date.localeCompare(x.date));
}
