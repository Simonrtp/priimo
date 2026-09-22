import type { KindGeneree } from '@/lib/rapport/modele-defaut';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import {
  PageComparables,
  PageConcurrentiel,
  PageConnectivite,
  PageCouverture,
  PageDescription,
  PageEstimation,
  PageImmeuble,
  PageIndices,
  PagePermis,
  PagePointsInteret,
  PageProchaineEtape,
  PageSecteur,
  PageVotreBien,
} from './PagesAvis';

export default function PageGenereeHtml({
  kind,
  dossier,
  accent,
}: {
  kind: KindGeneree;
  dossier: DossierRapport;
  accent: string;
}) {
  switch (kind) {
    case 'couverture':
      return <PageCouverture d={dossier} accent={accent} />;
    case 'votre_bien':
      return <PageVotreBien d={dossier} accent={accent} />;
    case 'description':
      return <PageDescription d={dossier} accent={accent} />;
    case 'immeuble_appartement':
      return <PageImmeuble d={dossier} accent={accent} />;
    case 'secteur':
      return <PageSecteur d={dossier} accent={accent} />;
    case 'points_interet':
      return <PagePointsInteret d={dossier} accent={accent} />;
    case 'connectivite':
      return <PageConnectivite d={dossier} accent={accent} />;
    case 'permis':
      return <PagePermis d={dossier} accent={accent} />;
    case 'comparables':
      return <PageComparables d={dossier} accent={accent} />;
    case 'concurrentiel':
      return <PageConcurrentiel d={dossier} accent={accent} />;
    case 'indices':
      return <PageIndices d={dossier} accent={accent} />;
    case 'prix':
      return <PageEstimation d={dossier} accent={accent} />;
    case 'prochaine_etape':
      return <PageProchaineEtape d={dossier} accent={accent} />;
  }
}
