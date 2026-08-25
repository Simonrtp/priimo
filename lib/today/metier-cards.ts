import type {
  TodayBienMetier,
  TodayOffre,
  TodayPromesse,
  TodayRendezVous,
  TodayVisite,
} from '@/types/metier';
import type { TodayCard, TodayCardAction } from '@/lib/today/cards';
import { geoFrom } from '@/lib/today/field';
import {
  ENJEU_PAR_TYPE,
  heuresDepuis,
  imminenceFenetreHeures,
  imminenceJoursRestants,
  imminenceRendezVous,
  sameDayParis,
  scoreCarte,
} from '@/lib/today/scoring';
import {
  formatDateFr,
  imminenceExpirationMandat,
  joursAvantExpirationMandat,
  joursDepuis,
  joursJusquA,
  mandatExpireDansFenetre,
} from '@/lib/metier/mandat';

function cardBase(
  partial: Omit<TodayCard, 'enjeu' | 'imminence' | 'score' | 'dismissible'>,
  enjeu: number,
  imminence: number,
  dismissible = true,
): TodayCard {
  const e = ENJEU_PAR_TYPE[partial.type] ?? enjeu;
  return {
    ...partial,
    enjeu: e,
    imminence,
    score: scoreCarte(e, imminence),
    dismissible,
  };
}

export function cartesEcheanceContractuelle(
  biens: readonly TodayBienMetier[],
  offres: readonly TodayOffre[],
  now: Date,
): TodayCard[] {
  const cartes: TodayCard[] = [];

  for (const bien of biens) {
    if (!bien.mandatSigneLe) continue;
    if (!mandatExpireDansFenetre(bien.mandatSigneLe, bien.mandatDureeMois, now, 30)) continue;
    const jours = joursAvantExpirationMandat(bien.mandatSigneLe, bien.mandatDureeMois, now);
    const imminence = imminenceExpirationMandat(jours);
    cartes.push(
      cardBase(
        {
          key: `echeance:mandat:${bien.id}`,
          type: 'echeance_contractuelle',
          headline: bien.address,
          context:
            jours <= 0
              ? 'Mandat expiré — renouveler ou clôturer'
              : `Mandat expire dans ${jours} jour${jours > 1 ? 's' : ''}`,
          action: { kind: 'ouvrir_bien', label: 'Voir le mandat', bienId: bien.id },
          urgent: jours <= 7,
          geo: geoFrom(bien.latitude, bien.longitude, bien.address),
        },
        ENJEU_PAR_TYPE.echeance_contractuelle,
        imminence,
        false,
      ),
    );
  }

  for (const offre of offres) {
    if (offre.statut !== 'en_attente') continue;

    if (offre.validiteJusquAu) {
      const jours = joursJusquA(offre.validiteJusquAu, now);
      if (jours <= 3) {
        cartes.push(
          cardBase(
            {
              key: `echeance:offre:${offre.id}`,
              type: 'echeance_contractuelle',
              headline: offre.bienAddress,
              context:
                jours <= 0
                  ? `Offre expirée · ${new Intl.NumberFormat('fr-FR').format(offre.montant)} €`
                  : `Offre expire ${jours === 0 ? "aujourd'hui" : `dans ${jours} j`} · ${new Intl.NumberFormat('fr-FR').format(offre.montant)} €`,
              action: { kind: 'ouvrir_bien', label: "Suivre l'offre", bienId: offre.bienId },
              urgent: jours <= 1,
              geo: null,
            },
            ENJEU_PAR_TYPE.echeance_contractuelle,
            jours <= 0 ? 100 : jours <= 3 ? 100 : 70,
            false,
          ),
        );
      }
    }

    if (offre.financementEcheance) {
      const jours = joursJusquA(offre.financementEcheance, now);
      if (jours <= 15) {
        cartes.push(
          cardBase(
            {
              key: `echeance:financement:${offre.id}`,
              type: 'echeance_contractuelle',
              headline: offre.bienAddress,
              context: `Financement · échéance ${formatDateFr(offre.financementEcheance)}`,
              action: { kind: 'ouvrir_bien', label: 'Relancer la banque', bienId: offre.bienId },
              urgent: jours <= 5,
              geo: null,
            },
            ENJEU_PAR_TYPE.echeance_contractuelle,
            imminenceJoursRestants(Math.max(0, jours), 15),
            false,
          ),
        );
      }
    }

    if (offre.compromisSigneLe && !offre.preemptionPurgeeLe) {
      const jours = joursDepuis(offre.compromisSigneLe, now);
      if (jours !== null && jours >= 60) {
        cartes.push(
          cardBase(
            {
              key: `echeance:preemption:${offre.id}`,
              type: 'echeance_contractuelle',
              headline: offre.bienAddress,
              context: 'Préemption non purgée · plus de 60 jours',
              action: { kind: 'ouvrir_bien', label: 'Purger la préemption', bienId: offre.bienId },
              urgent: true,
              geo: null,
            },
            ENJEU_PAR_TYPE.echeance_contractuelle,
            85,
            false,
          ),
        );
      }
    }
  }

  return cartes;
}

export function cartesPostVisite(visites: readonly TodayVisite[], now: Date): TodayCard[] {
  const cartes: TodayCard[] = [];

  for (const v of visites) {
    const h = heuresDepuis(v.dateVisite, now);
    if (h >= 72) continue;

    const imminence = h <= 24 ? 100 : imminenceFenetreHeures(h, 72);

    if (!v.compteRenduAcquereurFaitLe && v.contactName) {
      const action: TodayCardAction = v.contactPhone
        ? { kind: 'appeler', label: 'Appeler', phone: v.contactPhone, contactId: v.contactId ?? undefined }
        : { kind: 'ouvrir_contact', label: 'Compte rendu acquéreur', contactId: v.contactId! };
      cartes.push(
        cardBase(
          {
            key: `post_visite:acq:${v.id}`,
            type: 'post_visite',
            headline: v.contactName,
            context: `Visite · ${v.bienAddress} · compte rendu acquéreur`,
            action,
            urgent: h <= 24,
            geo: null,
          },
          ENJEU_PAR_TYPE.post_visite,
          imminence,
        ),
      );
    }

    if (!v.compteRenduVendeurFaitLe && v.proprietaireName) {
      const action: TodayCardAction = v.proprietairePhone
        ? { kind: 'appeler', label: 'Appeler', phone: v.proprietairePhone, contactId: v.proprietaireContactId ?? undefined }
        : v.proprietaireContactId
          ? { kind: 'ouvrir_contact', label: 'Compte rendu vendeur', contactId: v.proprietaireContactId }
          : { kind: 'ouvrir_bien', label: 'Compte rendu vendeur', bienId: v.bienId };
      cartes.push(
        cardBase(
          {
            key: `post_visite:vendeur:${v.id}`,
            type: 'post_visite',
            headline: v.proprietaireName,
            context: `Visite · ${v.bienAddress} · compte rendu vendeur`,
            action,
            urgent: h <= 24,
            geo: null,
          },
          ENJEU_PAR_TYPE.post_visite,
          imminence,
        ),
      );
    }
  }

  return cartes;
}

export function cartesPromesse(promesses: readonly TodayPromesse[], now: Date): TodayCard[] {
  return promesses
    .filter((p) => p.statut === 'a_faire')
    .map((p) => {
      const jours = joursJusquA(p.echeance, now);
      const enRetard = jours < 0;
      const imminence = enRetard || jours === 0 ? 100 : imminenceJoursRestants(jours, 7);
      const action: TodayCardAction = p.contactPhone
        ? { kind: 'appeler', label: 'Honorer la promesse', phone: p.contactPhone, contactId: p.contactId ?? undefined }
        : p.contactId
          ? { kind: 'ouvrir_contact', label: 'Honorer la promesse', contactId: p.contactId }
          : { kind: 'ouvrir_promesse', label: 'Voir la promesse', promesseId: p.id };
      return cardBase(
        {
          key: `promesse:${p.id}`,
          type: 'promesse',
          headline: p.intitule,
          context: enRetard
            ? `En retard · ${Math.abs(jours)} jour${Math.abs(jours) > 1 ? 's' : ''}`
            : jours === 0
              ? "Aujourd'hui"
              : `Échéance ${formatDateFr(p.echeance)}`,
          action,
          urgent: enRetard,
          geo: null,
        },
        ENJEU_PAR_TYPE.promesse,
        imminence,
      );
    });
}

export function cartesRendezVousMetier(rdv: readonly TodayRendezVous[], now: Date): TodayCard[] {
  return rdv
    .filter((r) => {
      const fin = Date.parse(r.fin);
      return !Number.isNaN(fin) && fin > now.getTime();
    })
    .map((r) => {
      const imminence = imminenceRendezVous(r.debut, r.fin, now);
      const action: TodayCardAction = r.contactPhone
        ? { kind: 'appeler', label: 'Confirmer', phone: r.contactPhone, contactId: r.contactId ?? undefined }
        : r.bienId
          ? { kind: 'ouvrir_bien', label: 'Voir le bien', bienId: r.bienId }
          : r.contactId
            ? { kind: 'ouvrir_contact', label: 'Voir le contact', contactId: r.contactId }
            : { kind: 'ouvrir_rdv', label: 'Voir le rendez-vous', rdvId: r.id };
      const lieu = r.lieu ?? r.bienAddress;
      return cardBase(
        {
          key: `rdv:${r.id}`,
          type: 'rendez_vous',
          headline: r.contactName ?? lieu ?? 'Rendez-vous',
          context: sameDayParis(r.debut, now)
            ? `Aujourd'hui · ${r.type}`
            : `${formatDateFr(r.debut.slice(0, 10))} · ${r.type}`,
          action,
          urgent: sameDayParis(r.debut, now),
          geo: null,
        },
        ENJEU_PAR_TYPE.rendez_vous,
        imminence,
      );
    });
}

export function cartesMandatSansVisite(biens: readonly TodayBienMetier[], now: Date): TodayCard[] {
  const cartes: TodayCard[] = [];
  for (const bien of biens) {
    if (!bien.mandatSigneLe) continue;
    if (bien.mandatStatut !== 'mandat_simple' && bien.mandatStatut !== 'mandat_exclusif') continue;
    if (bien.visitCount > 0) continue;
    const jours = joursDepuis(bien.mandatSigneLe, now);
    if (jours === null || jours < 21) continue;
    cartes.push(
      cardBase(
        {
          key: `mandat_sans_visite:${bien.id}`,
          type: 'mandat_sans_visite',
          headline: bien.address,
          context: `Mandat depuis ${jours} jours · aucune visite`,
          action: { kind: 'ouvrir_bien', label: 'Relancer la diffusion', bienId: bien.id },
          urgent: jours >= 45,
          geo: geoFrom(bien.latitude, bien.longitude, bien.address),
        },
        ENJEU_PAR_TYPE.mandat_sans_visite,
        imminenceJoursRestants(Math.min(jours - 21, 30), 30) || 50,
      ),
    );
  }
  return cartes;
}
