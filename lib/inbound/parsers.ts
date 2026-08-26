/**
 * Captation des demandes portail — parseurs isolés.
 * Aucun corps brut n'est stocké : on extrait puis on jette.
 */

export type PortailParserId = 'seloger' | 'bienici' | 'logicimmo' | 'leboncoin' | 'inconnu';

export interface IncomingEmail {
  /** Identifiant Gmail stable (Message-ID ou id API). */
  gmailMessageId: string;
  fromAddress: string;
  subject: string;
  /** Corps texte / HTML allégé — uniquement en mémoire pour le parse. */
  bodyText: string;
  receivedAt: string | null;
}

export interface ParsedPortailLead {
  portail: PortailParserId;
  nom: string | null;
  telephone: string | null;
  email: string | null;
  referenceAnnonce: string | null;
  typeDemande: string | null;
  message: string | null;
  demandeAt: string | null;
}

export type ParseResult =
  | { ok: true; lead: ParsedPortailLead }
  | { ok: false; reason: 'format_inconnu'; portail: PortailParserId; detail: string };

export interface PortailEmailParser {
  readonly id: PortailParserId;
  /** true si le message ressemble à ce portail (sujet / marqueurs). */
  matches(email: IncomingEmail): boolean;
  parse(email: IncomingEmail): ParseResult;
}

function pick(re: RegExp, text: string): string | null {
  const m = text.match(re);
  const v = m?.[1]?.trim();
  return v || null;
}

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  return digits || null;
}

export class SelogerParser implements PortailEmailParser {
  readonly id = 'seloger' as const;

  matches(email: IncomingEmail): boolean {
    const hay = `${email.subject}\n${email.fromAddress}\n${email.bodyText}`.toLowerCase();
    return hay.includes('seloger') || hay.includes('se loger');
  }

  parse(email: IncomingEmail): ParseResult {
    const t = email.bodyText;
    const nom =
      pick(/Nom\s*:\s*(.+)/i, t) ||
      pick(/Contact\s*:\s*(.+)/i, t) ||
      pick(/de la part de\s+(.+)/i, t);
    const telephone = normalizePhone(
      pick(/T[ée]l[ée]phone\s*:\s*([+\d\s.()/-]+)/i, t) || pick(/Tel\s*:\s*([+\d\s.()/-]+)/i, t),
    );
    const emailAddr =
      pick(/E-?mail\s*:\s*([^\s<>]+@[^\s<>]+)/i, t) ||
      pick(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i, t);
    const referenceAnnonce =
      pick(/R[ée]f[ée]rence\s*(?:annonce)?\s*:\s*([A-Z0-9_-]+)/i, t) ||
      pick(/Annonce\s*n[°o]?\s*:?\s*([A-Z0-9_-]+)/i, t);
    const message =
      pick(/Message\s*:\s*([\s\S]+?)(?:\n\s*\n|$)/i, t) ||
      pick(/Voici son message\s*:\s*([\s\S]+)/i, t);

    if (!nom && !telephone && !emailAddr) {
      return {
        ok: false,
        reason: 'format_inconnu',
        portail: this.id,
        detail: 'SeLoger : aucun champ contact reconnu — à traiter à la main.',
      };
    }

    return {
      ok: true,
      lead: {
        portail: this.id,
        nom,
        telephone,
        email: emailAddr,
        referenceAnnonce,
        typeDemande: 'acquereur',
        message: message?.slice(0, 2000) ?? null,
        demandeAt: email.receivedAt,
      },
    };
  }
}

export class BieniciParser implements PortailEmailParser {
  readonly id = 'bienici' as const;

  matches(email: IncomingEmail): boolean {
    const hay = `${email.subject}\n${email.fromAddress}`.toLowerCase();
    return hay.includes('bienici') || hay.includes("bien'ici");
  }

  parse(email: IncomingEmail): ParseResult {
    const t = email.bodyText;
    const nom = pick(/Nom\s*:\s*(.+)/i, t) || pick(/de\s+([A-ZÀ-ÖØ-öø-ÿ][\wÀ-ÖØ-öø-ÿ' -]+)/i, t);
    const telephone = normalizePhone(pick(/T[ée]l(?:[ée]phone)?\s*:\s*([+\d\s.()/-]+)/i, t));
    const emailAddr = pick(/E-?mail\s*:\s*([^\s<>]+@[^\s<>]+)/i, t);
    const referenceAnnonce = pick(/R[ée]f\.?\s*:\s*([A-Z0-9_-]+)/i, t);
    const message = pick(/Message\s*:\s*([\s\S]+?)(?:\n--|\n\s*\n|$)/i, t);

    if (!nom && !telephone && !emailAddr) {
      return {
        ok: false,
        reason: 'format_inconnu',
        portail: this.id,
        detail: "Bien'ici : format non reconnu — à traiter à la main.",
      };
    }
    return {
      ok: true,
      lead: {
        portail: this.id,
        nom,
        telephone,
        email: emailAddr,
        referenceAnnonce,
        typeDemande: 'acquereur',
        message: message?.slice(0, 2000) ?? null,
        demandeAt: email.receivedAt,
      },
    };
  }
}

export class LogicImmoParser implements PortailEmailParser {
  readonly id = 'logicimmo' as const;

  matches(email: IncomingEmail): boolean {
    const hay = `${email.subject}\n${email.fromAddress}`.toLowerCase();
    return hay.includes('logic-immo') || hay.includes('logicimmo') || hay.includes('logic immo');
  }

  parse(email: IncomingEmail): ParseResult {
    const t = email.bodyText;
    const nom = pick(/Nom\s*:\s*(.+)/i, t);
    const telephone = normalizePhone(pick(/T[ée]l(?:[ée]phone)?\s*:\s*([+\d\s.()/-]+)/i, t));
    const emailAddr = pick(/E-?mail\s*:\s*([^\s<>]+@[^\s<>]+)/i, t);
    const referenceAnnonce = pick(/R[ée]f(?:[ée]rence)?\s*:\s*([A-Z0-9_-]+)/i, t);
    const message = pick(/Message\s*:\s*([\s\S]+)/i, t);

    if (!nom && !telephone && !emailAddr) {
      return {
        ok: false,
        reason: 'format_inconnu',
        portail: this.id,
        detail: 'Logic-Immo : format non reconnu — à traiter à la main.',
      };
    }
    return {
      ok: true,
      lead: {
        portail: this.id,
        nom,
        telephone,
        email: emailAddr,
        referenceAnnonce,
        typeDemande: 'acquereur',
        message: message?.slice(0, 2000) ?? null,
        demandeAt: email.receivedAt,
      },
    };
  }
}

export class LeboncoinParser implements PortailEmailParser {
  readonly id = 'leboncoin' as const;

  matches(email: IncomingEmail): boolean {
    const hay = `${email.subject}\n${email.fromAddress}`.toLowerCase();
    return hay.includes('leboncoin');
  }

  parse(email: IncomingEmail): ParseResult {
    const t = email.bodyText;
    const nom = pick(/de la part de\s+(.+)/i, t) || pick(/Nom\s*:\s*(.+)/i, t);
    const telephone = normalizePhone(pick(/0\d(?:[\s.-]?\d{2}){4}/, t));
    const emailAddr = pick(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i, t);
    const referenceAnnonce = pick(/annonce\s+n[°o]?\s*(\d+)/i, t);

    if (!nom && !telephone && !emailAddr) {
      return {
        ok: false,
        reason: 'format_inconnu',
        portail: this.id,
        detail: 'Leboncoin : format non reconnu — à traiter à la main.',
      };
    }
    return {
      ok: true,
      lead: {
        portail: this.id,
        nom,
        telephone,
        email: emailAddr,
        referenceAnnonce,
        typeDemande: 'acquereur',
        message: null,
        demandeAt: email.receivedAt,
      },
    };
  }
}

const PARSERS: PortailEmailParser[] = [
  new SelogerParser(),
  new BieniciParser(),
  new LogicImmoParser(),
  new LeboncoinParser(),
];

export function parsePortailEmail(email: IncomingEmail): ParseResult {
  const parser = PARSERS.find((p) => p.matches(email));
  if (!parser) {
    return {
      ok: false,
      reason: 'format_inconnu',
      portail: 'inconnu',
      detail: 'Aucun parseur ne reconnaît ce message portail.',
    };
  }
  return parser.parse(email);
}

export function domainFromAddress(fromAddress: string): string | null {
  const m = fromAddress.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/);
  return m?.[1] ?? null;
}
