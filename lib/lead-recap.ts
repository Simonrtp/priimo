import type { Lead } from '@/types/lead';
import { toDisplayPersonName } from '@/lib/lead-person-display';
import { daysSinceDpe } from '@/lib/lead-dpe';

export type LeadRecap = {
  who: string;
  whoDetail: string | null;
  bien: string | null;
  /** Faits à avoir en tête avant de décrocher. */
  faits: string[];
  note: string | null;
};

function sanitize(label: string): string {
  let s = label.trim();
  s = s.replace(/\bDVF\b/gi, 'ventes');
  s = s.replace(/\bBODACC\b/gi, 'annonce légale');
  s = s.replace(/\s*ces\s+\d+\s+derni[eè]res?\s+ann[eé]es?/gi, '');
  s = s.replace(/\s*ces\s+\d+\s+derniers?\s+mois/gi, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

function etageLabel(etage: string | null): string | null {
  const raw = (etage ?? '').trim();
  if (!raw) return null;
  if (/^rdc$/i.test(raw) || raw === '0') return 'au rez-de-chaussée';
  if (/^\d+$/.test(raw)) return `au ${raw}e`;
  return `au ${raw}`;
}

function lastNoteBody(notes: string | null): string | null {
  if (!notes?.trim()) return null;
  const blocks = notes
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  const last = blocks[blocks.length - 1];
  if (!last) return null;
  const lines = last.split('\n');
  const first = lines[0] ?? '';
  const body = /^\[[^\]]+\]/.test(first) ? lines.slice(1).join('\n').trim() : last;
  if (!body) return null;
  return body.length > 220 ? `${body.slice(0, 219).trimEnd()}…` : body;
}

function pushUnique(list: string[], value: string | null | undefined) {
  const v = value?.trim();
  if (!v) return;
  const key = v.toLocaleLowerCase('fr');
  if (list.some((x) => x.toLocaleLowerCase('fr') === key)) return;
  list.push(v);
}

/**
 * Récap pour l’agent avant l’appel. Pas un texte à lire, pas un prompt.
 * Uniquement des faits déjà dans la fiche.
 */
export function buildLeadRecap(lead: Pick<
  Lead,
  | 'ownerName'
  | 'ownerCompany'
  | 'companyName'
  | 'companyDirector'
  | 'ownerType'
  | 'propertyType'
  | 'surfaceM2'
  | 'rooms'
  | 'etage'
  | 'dpeClass'
  | 'dpeDate'
  | 'mainSignalLabel'
  | 'displaySignals'
  | 'notes'
>): LeadRecap {
  const name = lead.ownerName?.trim() ? toDisplayPersonName(lead.ownerName) : null;
  const company = (lead.ownerCompany || lead.companyName)?.trim()
    ? toDisplayPersonName((lead.ownerCompany || lead.companyName) as string)
    : null;
  const isCompany = lead.ownerType === 'entreprise' || Boolean(company && !name);

  let who = 'Propriétaire non identifié';
  if (name) who = name;
  else if (company) who = company;

  const whoDetail = name && company && company.toLocaleLowerCase('fr') !== name.toLocaleLowerCase('fr')
    ? company
    : lead.companyDirector?.trim() && lead.companyDirector.trim() !== name
      ? lead.companyDirector.trim()
      : null;

  const bien = spokenBien(lead);

  const faits: string[] = [];
  const dpeDays = daysSinceDpe(lead.dpeDate);
  const classe = lead.dpeClass?.trim().toUpperCase() || lead.displaySignals.dpe?.classe?.toUpperCase();
  if (classe && /^[A-G]$/.test(classe)) {
    if (dpeDays !== null && dpeDays >= 0 && dpeDays < 60) {
      pushUnique(faits, `a eu un diagnostic récent, classe ${classe}`);
    } else {
      pushUnique(faits, `a un diagnostic classe ${classe}`);
    }
  } else if (dpeDays !== null && dpeDays >= 0 && dpeDays < 60) {
    pushUnique(faits, 'a eu un diagnostic récent');
  }

  const ventes = lead.displaySignals.cascade?.nbVentes;
  if (ventes && ventes > 0) {
    pushUnique(
      faits,
      ventes === 1 ? '1 vente dans l’immeuble' : `${ventes} ventes dans l’immeuble`,
    );
  }

  const vie = lead.displaySignals.evenementsVie?.items ?? [];
  for (const item of vie) {
    pushUnique(faits, sanitize(item.label));
    if (faits.length >= 5) break;
  }

  const extra = lead.displaySignals.dpe?.items ?? [];
  for (const item of extra) {
    const label = sanitize(item.label);
    if (/classe\s+[A-G]/i.test(label)) continue;
    pushUnique(faits, label);
    if (faits.length >= 5) break;
  }

  const entreprise = lead.displaySignals.entreprise;
  if (entreprise?.eventType) {
    pushUnique(faits, sanitize(entreprise.eventType));
  }
  for (const item of entreprise?.items ?? []) {
    pushUnique(faits, sanitize(item.label));
    if (faits.length >= 5) break;
  }

  if (faits.length === 0 && lead.mainSignalLabel) {
    pushUnique(faits, sanitize(lead.mainSignalLabel));
  }

  if (isCompany && company && name) {
    pushUnique(faits, `bien détenu par ${company}`);
  }

  const note = lastNoteBody(lead.notes);

  return { who, whoDetail, bien, faits: faits.slice(0, 5), note };
}

/** Phrase d’accroche lue par l’agent, pas un script. */
export function recapHeadline(recap: LeadRecap): string {
  if (recap.bien) return `${recap.who} a ${recap.bien}.`;
  return recap.who;
}

function spokenBien(
  lead: Pick<Lead, 'propertyType' | 'surfaceM2' | 'rooms' | 'etage'>,
): string | null {
  const type =
    lead.rooms && lead.rooms > 0
      ? `T${lead.rooms}`
      : lead.propertyType?.trim() || null;
  const surface = lead.surfaceM2 && lead.surfaceM2 > 0 ? `${lead.surfaceM2} m²` : null;
  const etage = etageLabel(lead.etage);

  if (!type && !surface && !etage) return null;

  if (!type && surface) {
    return etage ? `un bien de ${surface} ${etage}` : `un bien de ${surface}`;
  }

  const article = type && /^maison/i.test(type) ? 'une' : 'un';
  const chunks: string[] = [];
  if (type) chunks.push(`${article} ${type}`);
  if (surface) chunks.push(`de ${surface}`);
  if (etage) chunks.push(etage);
  return chunks.join(' ');
}
