'use client';

import { AlertTriangle, CircleDashed, PauseCircle, Radio } from 'lucide-react';
import {
  etatInstallation,
  phraseDepuis,
  type StatutInstallation,
} from '@/lib/widget/install-state';

/**
 * L'état d'installation, en tête de la page.
 *
 * Le directeur n'a pas à deviner si son prestataire a fait le travail : on lui
 * dit si le formulaire a été vu se charger, où, et quand. C'est ce qui
 * transforme un réglage en fait vérifiable.
 */

const APPARENCE: Record<
  StatutInstallation,
  { fond: string; bordure: string; couleur: string; Icone: typeof Radio; titre: string }
> = {
  en_ligne: {
    fond: '#E7F4EE',
    bordure: 'rgba(15,122,79,0.25)',
    couleur: '#0F7A4F',
    Icone: Radio,
    titre: 'En ligne sur votre site',
  },
  jamais_vu: {
    fond: '#F5F5F4',
    bordure: 'rgba(0,0,0,0.10)',
    couleur: '#57534E',
    Icone: CircleDashed,
    titre: 'Pas encore installé',
  },
  coupe: {
    fond: '#FBF2DE',
    bordure: 'rgba(138,97,0,0.25)',
    couleur: '#8A6100',
    Icone: PauseCircle,
    titre: 'Installé, mais coupé',
  },
  silencieux: {
    fond: '#FBF2DE',
    bordure: 'rgba(138,97,0,0.25)',
    couleur: '#8A6100',
    Icone: AlertTriangle,
    titre: 'Plus aucun chargement depuis un mois',
  },
};

export default function WidgetEtatInstallation({
  enabled,
  lastSeenAt,
  lastSeenHost,
}: {
  enabled: boolean;
  lastSeenAt: string | null;
  lastSeenHost: string | null;
}) {
  const etat = etatInstallation({ enabled, lastSeenAt, lastSeenHost });
  const { fond, bordure, couleur, Icone, titre } = APPARENCE[etat.statut];
  const depuis = phraseDepuis(etat.lastSeenAt);

  const detail = (() => {
    switch (etat.statut) {
      case 'en_ligne':
        return `Dernier chargement ${depuis ?? 'récemment'}${etat.host ? ` sur ${etat.host}` : ''}. Les demandes arrivent dans votre Accueil.`;
      case 'jamais_vu':
        return 'Nous n’avons pas encore vu le formulaire se charger. Choisissez ci-dessous qui s’en occupe : votre prestataire, ou vous.';
      case 'coupe':
        return `Le code est bien en place${etat.host ? ` sur ${etat.host}` : ''}, mais l’interrupteur est sur « désactivé » : le formulaire ne répond plus.`;
      case 'silencieux':
        return `Vu pour la dernière fois ${depuis ?? 'il y a longtemps'}${etat.host ? ` sur ${etat.host}` : ''}. Le code a peut-être été retiré du site, ou la page déplacée.`;
    }
  })();

  return (
    <div
      className="rounded-clay border p-4"
      style={{ backgroundColor: fond, borderColor: bordure }}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Icone className="mt-0.5 size-5 shrink-0" style={{ color: couleur }} aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold" style={{ fontSize: 15, color: couleur }}>
            {titre}
          </p>
          <p className="mt-1 text-pretty text-[13px] leading-relaxed text-ink">{detail}</p>
        </div>
      </div>
    </div>
  );
}
