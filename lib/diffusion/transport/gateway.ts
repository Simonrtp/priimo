/**
 * Transport passerelle de multidiffusion.
 *
 * Ubiflow / Diffuze : une seule intégration, formats évolutifs chez eux.
 * Les secrets (API key) sont des variables serveur — jamais en base en clair,
 * jamais côté client.
 */

import type { Annonce, DiffusionAck, DiffusionTransport, PortailId } from '../types';

export type GatewayKind = 'ubiflow' | 'diffuze' | 'noop';

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(
      `[diffusion] Variable serveur manquante : ${name}. ` +
        'Configurez la passerelle côté hébergeur (jamais en base, jamais client).',
    );
  }
  return v;
}

/**
 * Adaptateur Ubiflow (stub prêt à brancher).
 * La traduction Annonce → payload Ubiflow reste isolée ici.
 */
export class UbiflowTransport implements DiffusionTransport {
  readonly id = 'ubiflow';
  readonly label = 'Ubiflow';

  private apiKey: string;
  private baseUrl: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = opts?.apiKey ?? requireEnv('UBIFLOW_API_KEY');
    this.baseUrl = (opts?.baseUrl ?? process.env.UBIFLOW_API_BASE ?? 'https://api.ubiflow.net').replace(
      /\/$/,
      '',
    );
  }

  private toPayload(annonce: Annonce, portail: PortailId) {
    return {
      external_id: annonce.reference,
      portal: portail,
      title: annonce.titre,
      description: annonce.description,
      price: annonce.prix,
      surface: annonce.surfaceM2,
      rooms: annonce.pieces,
      photos: annonce.photos,
      energy: {
        dpe: annonce.dpeVierge ? 'vierge' : annonce.dpeLettre,
        dpe_kwh: annonce.dpeKwh,
        ges: annonce.gesLettre,
        ges_kg: annonce.gesKgCo2,
      },
      fees: {
        amount: annonce.honorairesMontant,
        paid_by: annonce.honorairesACharge,
      },
      condo: annonce.estCopropriete
        ? {
            lots: annonce.nombreLots,
            charges: annonce.chargesAnnuelles,
            procedure: annonce.procedureEnCours,
          }
        : null,
      address: {
        line: annonce.adresse,
        postal_code: annonce.codePostal,
        city: annonce.ville,
      },
    };
  }

  async publier(annonce: Annonce, portail: PortailId): Promise<DiffusionAck> {
    const res = await fetch(`${this.baseUrl}/v1/listings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `${annonce.reference}:${portail}`,
      },
      body: JSON.stringify(this.toPayload(annonce, portail)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ubiflow publier HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string; reference?: string };
    return {
      kind: 'ack',
      message: `Publié via Ubiflow → ${portail}`,
      referencePortail: data.reference ?? data.id ?? `${portail}:${annonce.reference}`,
    };
  }

  async mettreAJour(
    annonce: Annonce,
    portail: PortailId,
    referencePortail: string,
  ): Promise<DiffusionAck> {
    const res = await fetch(
      `${this.baseUrl}/v1/listings/${encodeURIComponent(referencePortail)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `${annonce.reference}:${portail}:update`,
        },
        body: JSON.stringify(this.toPayload(annonce, portail)),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ubiflow maj HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return {
      kind: 'ack',
      message: `Mis à jour via Ubiflow → ${portail}`,
      referencePortail,
    };
  }

  async retirer(
    _annonce: Annonce,
    portail: PortailId,
    referencePortail: string,
  ): Promise<DiffusionAck> {
    const res = await fetch(
      `${this.baseUrl}/v1/listings/${encodeURIComponent(referencePortail)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.apiKey}` },
      },
    );
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ubiflow retirer HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return {
      kind: 'ack',
      message: `Retiré via Ubiflow → ${portail}`,
      referencePortail,
    };
  }
}

/** Diffuze — même contrat, autre endpoint. */
export class DiffuzeTransport implements DiffusionTransport {
  readonly id = 'diffuze';
  readonly label = 'Diffuze';

  private apiKey: string;
  private baseUrl: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = opts?.apiKey ?? requireEnv('DIFFUZE_API_KEY');
    this.baseUrl = (opts?.baseUrl ?? process.env.DIFFUZE_API_BASE ?? 'https://api.diffuze.io').replace(
      /\/$/,
      '',
    );
  }

  async publier(annonce: Annonce, portail: PortailId): Promise<DiffusionAck> {
    const res = await fetch(`${this.baseUrl}/listings`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': `${annonce.reference}:${portail}`,
      },
      body: JSON.stringify({ ...annonce, portal: portail }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Diffuze publier HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return {
      kind: 'ack',
      message: `Publié via Diffuze → ${portail}`,
      referencePortail: data.id ?? `${portail}:${annonce.reference}`,
    };
  }

  async mettreAJour(
    annonce: Annonce,
    portail: PortailId,
    referencePortail: string,
  ): Promise<DiffusionAck> {
    return this.publier(annonce, portail).then((ack) => ({
      ...ack,
      referencePortail,
      message: `Mis à jour via Diffuze → ${portail}`,
    }));
  }

  async retirer(
    _annonce: Annonce,
    portail: PortailId,
    referencePortail: string,
  ): Promise<DiffusionAck> {
    const res = await fetch(`${this.baseUrl}/listings/${encodeURIComponent(referencePortail)}`, {
      method: 'DELETE',
      headers: { 'X-Api-Key': this.apiKey },
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      throw new Error(`Diffuze retirer HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return {
      kind: 'ack',
      message: `Retiré via Diffuze → ${portail}`,
      referencePortail,
    };
  }
}

/** No-op pour dev / tests — aucune sortie réseau. */
export class NoopTransport implements DiffusionTransport {
  readonly id = 'noop';
  readonly label = 'Simulation (aucun envoi)';

  async publier(annonce: Annonce, portail: PortailId): Promise<DiffusionAck> {
    return {
      kind: 'ack',
      message: `[noop] Publication simulée → ${portail}`,
      referencePortail: `noop:${portail}:${annonce.reference}`,
    };
  }

  async mettreAJour(
    annonce: Annonce,
    portail: PortailId,
    referencePortail: string,
  ): Promise<DiffusionAck> {
    return {
      kind: 'ack',
      message: `[noop] Mise à jour simulée → ${portail}`,
      referencePortail,
    };
  }

  async retirer(
    _annonce: Annonce,
    portail: PortailId,
    referencePortail: string,
  ): Promise<DiffusionAck> {
    return {
      kind: 'ack',
      message: `[noop] Retrait simulé → ${portail}`,
      referencePortail,
    };
  }
}

export function getDiffusionTransport(kind?: GatewayKind): DiffusionTransport {
  const resolved =
    kind ??
    ((process.env.DIFFUSION_GATEWAY?.trim().toLowerCase() as GatewayKind | undefined) || 'noop');
  switch (resolved) {
    case 'ubiflow':
      return new UbiflowTransport();
    case 'diffuze':
      return new DiffuzeTransport();
    case 'noop':
    default:
      return new NoopTransport();
  }
}
