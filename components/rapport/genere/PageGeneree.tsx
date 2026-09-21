import type { ReactNode } from 'react';
import type { KindGeneree } from '@/lib/rapport/modele-defaut';
import { formatDateRapport, joindreSansVide } from '@/lib/rapport/identite';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import {
  formatDistance,
  formatEuro,
  formatPct,
  formatPrixM2,
  formatSurface,
  intituleBien,
  libelleAscenseur,
  libelleEtageAffiche,
  libelleEtagesImmeubleAffiche,
  libelleOccupation,
  libelleTypeLocal,
} from '@/lib/rapport/genere/format';
import { formatDateCourte } from '@/lib/rapport/genere/format';
import {
  phraseEffortAchat,
  phrasePerimetreConcurrentiel,
  phraseCriteresConcurrentiels,
  phrasePointsInteret,
  phraseSecteur,
  phraseComparaisonSecteur,
} from '@/lib/rapport/genere/phrases';
import { CarteIgn, Encadre, EtiquetteDpe, Fait, GraphiqueBarres, NuagePoints, TitrePage } from './shared';

export default function PageGeneree({
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
      return <Couverture d={dossier} accent={accent} />;
    case 'votre_bien':
      return <VotreBien d={dossier} accent={accent} />;
    case 'description':
      return <Description d={dossier} accent={accent} />;
    case 'immeuble_appartement':
      return <Immeuble d={dossier} accent={accent} />;
    case 'secteur':
      return <Secteur d={dossier} accent={accent} />;
    case 'points_interet':
      return <PointsInteret d={dossier} accent={accent} />;
    case 'connectivite':
      return <Connectivite d={dossier} accent={accent} />;
    case 'permis':
      return <Permis d={dossier} accent={accent} />;
    case 'comparables':
      return <Comparables d={dossier} accent={accent} />;
    case 'concurrentiel':
      return <Concurrentiel d={dossier} accent={accent} />;
    case 'indices':
      return <Indices d={dossier} accent={accent} />;
    case 'prix':
      return <Estimation d={dossier} accent={accent} />;
    case 'prochaine_etape':
      return <ProchaineEtape d={dossier} accent={accent} />;
  }
}

function Cadre({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-5">{children}</div>;
}

function Couverture({ d, accent }: { d: DossierRapport; accent: string }) {
  const date = formatDateRapport(d.dateEvaluation);
  return (
    <div className="relative flex h-full min-h-0 flex-col bg-white">
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: accent }} aria-hidden />
      {d.photoCouverture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.photoCouverture.url} alt="" className="h-[58%] w-full object-cover" />
      ) : (
        <div className="flex h-[58%] items-end bg-[#F3F0EA] px-10 pb-8">
          <p className="max-w-xl text-pretty font-display text-[36px] font-semibold leading-tight text-text-strong">
            {d.titreCouverture}
          </p>
        </div>
      )}
      <div className="flex flex-1 flex-col justify-between px-10 py-6">
        <div>
          {d.photoCouverture ? (
            <p className="font-display text-[28px] font-semibold text-text-strong">{d.titreCouverture}</p>
          ) : null}
          {d.adresse ? <p className="mt-2 text-[15px] text-text">{d.adresse}</p> : null}
          {d.client.nom ? (
            <p className="mt-3 text-[13px] text-text-muted">
              À la demande de <span className="font-medium text-text-strong">{d.client.nom}</span>
            </p>
          ) : null}
          {date ? <p className="mt-1 text-[13px] tabular-nums text-text-muted">{date}</p> : null}
        </div>
        {d.agence.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.agence.logoUrl} alt="" className="h-10 max-w-[10rem] object-contain object-left" />
        ) : (
          <p className="text-[13px] font-semibold" style={{ color: accent }}>
            {d.agence.nomCommercial}
          </p>
        )}
      </div>
    </div>
  );
}

function VotreBien({ d, accent }: { d: DossierRapport; accent: string }) {
  const titre = intituleBien(d);
  return (
    <Cadre>
      <TitrePage accent={accent}>{titre ?? 'Votre bien'}</TitrePage>
      <div className="grid flex-1 grid-cols-3 gap-4">
        <div className="col-span-2 flex flex-col gap-3">
          {d.adresse ? <p className="text-[14px] text-text">{d.adresse}</p> : null}
          <div className="grid grid-cols-3 gap-3">
            {d.propertyType ? <Fait label="Type" valeur={d.propertyType === 'maison' ? 'Maison' : 'Appartement'} /> : null}
            {d.surfaceM2 != null ? <Fait label="Surface" valeur={formatSurface(d.surfaceM2)} /> : null}
            {d.rooms != null ? <Fait label="Pièces" valeur={String(d.rooms)} /> : null}
          </div>
          {(d.client.nom || d.client.telephone || d.client.email) ? (
            <div className="rounded-clay border border-black/[0.06] bg-white px-3 py-2.5">
              <p className="text-[10.5px] uppercase text-text-muted">Client</p>
              {d.client.nom ? <p className="mt-1 text-[13.5px] font-medium text-text-strong">{d.client.nom}</p> : null}
              <p className="text-[12.5px] text-text">{joindreSansVide([d.client.telephone, d.client.email])}</p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
          <BlocAgence d={d} />
          <CarteAgent d={d} />
        </div>
      </div>
    </Cadre>
  );
}

function Description({ d, accent }: { d: DossierRapport; accent: string }) {
  const visuels = d.photos.filter((p) => p.kind === 'photo').slice(0, 6);
  return (
    <Cadre>
      <div className="flex items-start justify-between gap-3">
        <TitrePage accent={accent}>Description du bien</TitrePage>
        {d.dpeClass ? <EtiquetteDpe lettre={d.dpeClass} /> : null}
      </div>
      {d.commentairesPublics ? (
        <p className="text-pretty text-[13.5px] leading-relaxed text-text">{d.commentairesPublics}</p>
      ) : null}
      {visuels.length > 0 ? (
        <ul className={`grid min-h-0 flex-1 gap-2 ${visuels.length > 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {visuels.map((p) => (
            <li key={p.url} className="min-h-0 overflow-hidden rounded-clay">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
    </Cadre>
  );
}

function Immeuble({ d, accent }: { d: DossierRapport; accent: string }) {
  const immeuble = [
    ['Étages', libelleEtagesImmeubleAffiche(d.etagesImmeuble)],
    ['Construction', d.anneeConstruction != null ? String(d.anneeConstruction) : null],
  ].filter(([, v]) => v);
  const appart = [
    ['Étage', libelleEtageAffiche(d.floor)],
    ['Ascenseur', libelleAscenseur(d.ascenseur)],
    ['Pièces', d.rooms != null ? String(d.rooms) : null],
    ['Chambres', d.chambres != null ? String(d.chambres) : null],
    ['Occupation', libelleOccupation(d.occupation)],
  ].filter(([, v]) => v);
  const synthese = phraseComparaisonSecteur({
    typeMajoritaire: d.iris && d.iris.partAppartements != null
      ? d.iris.partAppartements >= 50
        ? 'appartement'
        : 'maison'
      : null,
    piecesDominant: d.iris?.piecesDominant ?? null,
    epoque: d.iris?.epoque ?? null,
  });
  return (
    <Cadre>
      <TitrePage accent={accent}>L’immeuble et l’appartement</TitrePage>
      <div className="grid grid-cols-2 gap-4">
        {immeuble.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase text-text-muted">Immeuble</p>
            <div className="grid grid-cols-2 gap-2">
              {immeuble.map(([l, v]) => (
                <Fait key={l} label={l!} valeur={v!} />
              ))}
            </div>
          </div>
        ) : null}
        {appart.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase text-text-muted">Appartement</p>
            <div className="grid grid-cols-2 gap-2">
              {appart.map(([l, v]) => (
                <Fait key={l} label={l!} valeur={v!} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <table className="w-full text-left text-[13px]">
        <tbody>
          {d.surfaceM2 != null ? (
            <tr className="border-t border-black/[0.06]">
              <th className="py-1.5 font-normal text-text-muted">Surface habitable</th>
              <td className="py-1.5 tabular-nums">{formatSurface(d.surfaceM2)}</td>
            </tr>
          ) : null}
          {d.surfaceCarrez != null ? (
            <tr className="border-t border-black/[0.06]">
              <th className="py-1.5 font-normal text-text-muted">Surface Carrez</th>
              <td className="py-1.5 tabular-nums">{formatSurface(d.surfaceCarrez)}</td>
            </tr>
          ) : null}
          {d.annexes
            .filter((a) => a.surfaceM2 != null)
            .map((a) => (
              <tr key={a.libelle} className="border-t border-black/[0.06]">
                <th className="py-1.5 font-normal text-text-muted">{a.libelle}</th>
                <td className="py-1.5 tabular-nums">{formatSurface(a.surfaceM2!)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {synthese ? <Encadre>{synthese}</Encadre> : null}
    </Cadre>
  );
}

function Secteur({ d, accent }: { d: DossierRapport; accent: string }) {
  const iris = d.iris!;
  const phrase = phraseSecteur({
    commune: iris.commune,
    partAppartements: iris.partAppartements,
    piecesDominant: iris.piecesDominant,
    epoque: iris.epoque,
    partProprietaires: iris.partProprietaires,
    partLocataires: iris.partLocataires,
  });
  return (
    <Cadre>
      <TitrePage accent={accent}>Le secteur</TitrePage>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {iris.partAppartements != null ? <Fait label="Part d’appartements" valeur={formatPct(iris.partAppartements)} /> : null}
          {iris.piecesDominant != null ? <Fait label="Pièces dominantes" valeur={String(iris.piecesDominant)} /> : null}
          {iris.epoque ? <Fait label="Époque dominante" valeur={iris.epoque} /> : null}
          {iris.partProprietaires != null ? <Fait label="Propriétaires" valeur={formatPct(iris.partProprietaires)} /> : null}
          {iris.partLocataires != null ? <Fait label="Locataires" valeur={formatPct(iris.partLocataires)} /> : null}
          {phrase ? <Encadre>{phrase}</Encadre> : null}
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          {d.latitude != null && d.longitude != null ? (
            <>
              <CarteIgn latitude={d.latitude} longitude={d.longitude} spanM={1200} />
              <CarteIgn latitude={d.latitude} longitude={d.longitude} spanM={280} couche="cadastre" />
            </>
          ) : null}
        </div>
      </div>
    </Cadre>
  );
}

function PointsInteret({ d, accent }: { d: DossierRapport; accent: string }) {
  const cats = ['administration', 'enseignement', 'transports', 'sante'] as const;
  const lib: Record<(typeof cats)[number], string> = {
    administration: 'Administration',
    enseignement: 'Enseignement',
    transports: 'Transports',
    sante: 'Santé',
  };
  const resume = cats
    .map((c) => {
      const items = d.equipements.filter((e) => e.categorie === c);
      if (items.length === 0) return null;
      return { categorie: c, count: items.length, plusProcheM: items[0]!.distanceM };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  const phrase = phrasePointsInteret({ categories: resume });
  const points = d.equipements
    .filter((e) => e.latitude != null && e.longitude != null)
    .slice(0, 8)
    .map((e, i) => ({ lat: e.latitude!, lng: e.longitude!, label: String(i + 1) }));
  return (
    <Cadre>
      <TitrePage accent={accent}>Points d’intérêt</TitrePage>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        <div className="overflow-auto">
          {cats.map((c) => {
            const items = d.equipements.filter((e) => e.categorie === c);
            if (items.length === 0) return null;
            return (
              <div key={c} className="mb-2">
                <p className="text-[11px] font-semibold uppercase text-text-muted">{lib[c]}</p>
                <ul>
                  {items.slice(0, 4).map((e) => (
                    <li key={e.id} className="flex justify-between gap-2 text-[12.5px]">
                      <span className="truncate">{e.nom}</span>
                      <span className="shrink-0 tabular-nums text-text-muted">{formatDistance(e.distanceM)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {d.latitude != null && d.longitude != null ? (
            <CarteIgn latitude={d.latitude} longitude={d.longitude} spanM={1600} points={points} />
          ) : null}
          {phrase ? <Encadre>{phrase}</Encadre> : null}
        </div>
      </div>
    </Cadre>
  );
}

function Connectivite({ d, accent }: { d: DossierRapport; accent: string }) {
  const niveaux: Record<string, string> = {
    tres_bonne: 'Très bonne',
    bonne: 'Bonne',
    moyenne: 'Moyenne',
    limitee: 'Limitée',
    nulle: 'Nulle',
  };
  return (
    <Cadre>
      <TitrePage accent={accent}>Connectivité</TitrePage>
      <div className="grid grid-cols-2 gap-5">
        {d.fixe.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase text-text-muted">Internet fixe</p>
            <table className="w-full text-left text-[12.5px]">
              <tbody>
                {d.fixe.map((l, i) => (
                  <tr key={`${l.operateur}-${l.technologie}-${i}`} className="border-t border-black/[0.06]">
                    <td className="py-1.5">{l.operateur}</td>
                    <td className="py-1.5 uppercase">{l.technologie}</td>
                    <td className="py-1.5">{l.eligible ? 'Éligible' : 'Non éligible'}</td>
                    <td className="py-1.5 tabular-nums">
                      {l.debitMaxMbps != null ? `${l.debitMaxMbps} Mbit/s` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {d.mobile.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase text-text-muted">Couverture mobile</p>
            <table className="w-full text-left text-[12.5px]">
              <tbody>
                {d.mobile.map((l, i) => (
                  <tr key={`${l.operateur}-${l.generation}-${i}`} className="border-t border-black/[0.06]">
                    <td className="py-1.5">{l.operateur}</td>
                    <td className="py-1.5 uppercase">{l.generation}</td>
                    <td className="py-1.5">{niveaux[l.niveau] ?? l.niveau}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Cadre>
  );
}

function Permis({ d, accent }: { d: DossierRapport; accent: string }) {
  const points = d.permis
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p, i) => ({ lat: p.latitude!, lng: p.longitude!, label: String(i + 1) }));
  return (
    <Cadre>
      <TitrePage accent={accent}>Permis de construire</TitrePage>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        <ol className="overflow-auto text-[12.5px]">
          {d.permis.map((p, i) => (
            <li key={p.id} className="border-t border-black/[0.06] py-1.5">
              <span className="mr-2 font-semibold tabular-nums">{i + 1}.</span>
              {p.numero}
              {p.type ? ` · ${p.type}` : ''}
              {p.dateDecision ? ` · ${formatDateCourte(p.dateDecision)}` : ''}
              {p.distanceM != null ? ` · ${formatDistance(p.distanceM)}` : ''}
              {p.adresse ? <span className="block pl-5 text-text-muted">{p.adresse}</span> : null}
            </li>
          ))}
        </ol>
        {d.latitude != null && d.longitude != null ? (
          <CarteIgn latitude={d.latitude} longitude={d.longitude} spanM={2000} points={points} />
        ) : null}
      </div>
    </Cadre>
  );
}

function Comparables({ d, accent }: { d: DossierRapport; accent: string }) {
  return (
    <Cadre>
      <TitrePage accent={accent}>Ventes comparables</TitrePage>
      <ul className="grid grid-cols-2 gap-2 overflow-auto">
        {d.comparables.map((v) => (
          <li key={v.id} className="rounded-clay border border-black/[0.06] bg-white px-3 py-2 text-[12.5px]">
            <p className="font-medium text-text-strong">
              {joindreSansVide([libelleTypeLocal(v.typeLocal), v.pieces != null ? `${v.pieces} p.` : null, formatSurface(v.surfaceM2)])}
            </p>
            <p className="tabular-nums text-text">
              {formatEuro(v.prix)}
              {v.prixM2 != null ? ` · ${formatPrixM2(v.prixM2)}` : ''}
            </p>
            <p className="text-text-muted">
              {joindreSansVide([
                v.codePostal,
                formatDateCourte(v.date),
                v.distanceM != null ? formatDistance(v.distanceM) : null,
              ])}
            </p>
          </li>
        ))}
      </ul>
    </Cadre>
  );
}

function Concurrentiel({ d, accent }: { d: DossierRapport; accent: string }) {
  const n = d.annonces.length;
  const surfaces = d.annonces.map((a) => a.surfaceM2).filter((x): x is number => x != null);
  const prix = d.annonces.map((a) => a.prix).filter((x): x is number => x != null);
  const pm2 = d.annonces.map((a) => a.prixM2).filter((x): x is number => x != null);
  const surfaceMoy = surfaces.length ? surfaces.reduce((s, x) => s + x, 0) / surfaces.length : null;
  const prixMoy = prix.length ? prix.reduce((s, x) => s + x, 0) / prix.length : null;
  const perimetre = phrasePerimetreConcurrentiel({ count: n, surfaceMoyenne: surfaceMoy, prixMoyen: prixMoy });
  const criteres = phraseCriteresConcurrentiels({
    propertyType: d.propertyType,
    postalCode: d.postalCode,
  });
  const dispersion = pm2.length >= 3
    ? [
        { label: 'Bas', valeur: Math.min(...pm2) },
        { label: 'Médian', valeur: [...pm2].sort((a, b) => a - b)[Math.floor(pm2.length / 2)]! },
        { label: 'Haut', valeur: Math.max(...pm2) },
      ]
    : [];
  const nuage = d.annonces
    .filter((a) => a.surfaceM2 != null && a.prix != null)
    .map((a) => ({ x: a.surfaceM2!, y: a.prix! }));
  const bien =
    d.surfaceM2 != null && d.priceValue != null ? { x: d.surfaceM2, y: d.priceValue } : null;
  return (
    <Cadre>
      <TitrePage accent={accent}>Étude concurrentielle</TitrePage>
      <p className="text-[13px] text-text">{perimetre}</p>
      {criteres ? <p className="text-[12.5px] text-text-muted">{criteres}</p> : null}
      {d.fluiditeJoursMedian != null || d.negotiationPctMedian != null ? (
        <div className="grid grid-cols-2 gap-3">
          {d.fluiditeJoursMedian != null ? (
            <Fait label="Délai médian constaté" valeur={`${Math.round(d.fluiditeJoursMedian)} jours`} />
          ) : null}
          {d.negotiationPctMedian != null ? (
            <Fait
              label="Négociation médiane"
              valeur={`${d.negotiationPctMedian.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}
            />
          ) : null}
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <div>
          {dispersion.length > 0 ? (
            <>
              <p className="text-[11px] font-semibold uppercase text-text-muted">Prix au m²</p>
              <GraphiqueBarres valeurs={dispersion} accent={accent} format={(v) => `${Math.round(v)}`} />
            </>
          ) : null}
          {nuage.length > 0 ? (
            <>
              <p className="mt-2 text-[11px] font-semibold uppercase text-text-muted">Surface et prix</p>
              <NuagePoints points={nuage} bien={bien} accent={accent} />
            </>
          ) : null}
        </div>
        <ul className="overflow-auto">
          {d.annonces.slice(0, 6).map((a) => (
            <li key={a.id} className="border-t border-black/[0.06] py-1.5 text-[12.5px]">
              <p className="font-medium">
                {joindreSansVide([
                  libelleTypeLocal(a.typeLocal),
                  a.surfaceM2 != null ? formatSurface(a.surfaceM2) : null,
                  a.pieces != null ? `${a.pieces} p.` : null,
                ])}
              </p>
              <p className="tabular-nums text-text-muted">
                {joindreSansVide([
                  a.prix != null ? formatEuro(a.prix) : null,
                  a.prixM2 != null ? formatPrixM2(a.prixM2) : null,
                  formatDateCourte(a.dateReleve),
                ])}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Cadre>
  );
}

function Indices({ d, accent }: { d: DossierRapport; accent: string }) {
  const oat = d.oat.slice(-8).map((p) => ({
    label: p.date.slice(0, 4),
    valeur: p.taux,
  }));
  const effort =
    d.effort?.secteur != null
      ? phraseEffortAchat({
          secteur: d.effort.secteur,
          departement: d.effort.departement,
          france: d.effort.france,
        })
      : null;
  return (
    <Cadre>
      <TitrePage accent={accent}>Indices du marché</TitrePage>
      {oat.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase text-text-muted">Taux OAT</p>
          <GraphiqueBarres valeurs={oat} accent={accent} format={(v) => `${v.toFixed(1)} %`} />
        </div>
      ) : null}
      {effort ? <Encadre>{effort}</Encadre> : null}
      {d.fluiditeJoursMedian != null ? (
        <Fait label="Délai médian constaté" valeur={`${Math.round(d.fluiditeJoursMedian)} jours`} />
      ) : null}
    </Cadre>
  );
}

function Estimation({ d, accent }: { d: DossierRapport; accent: string }) {
  return (
    <Cadre>
      <TitrePage accent={accent}>Notre estimation</TitrePage>
      {d.priceValue != null ? (
        <p className="font-display text-[40px] font-semibold tabular-nums text-text-strong">{formatEuro(d.priceValue)}</p>
      ) : null}
      <div className="grid grid-cols-3 gap-3">
        {d.pricePerM2 != null && d.surfacePrixLibelle ? (
          <Fait label={`Prix au m² (${d.surfacePrixLibelle})`} valeur={formatPrixM2(d.pricePerM2)} />
        ) : null}
        {d.priceLow != null && d.priceHigh != null ? (
          <Fait label="Fourchette" valeur={`${formatEuro(d.priceLow)} – ${formatEuro(d.priceHigh)}`} />
        ) : null}
        <Fait label="Occupation" valeur={libelleOccupation(d.occupation)} />
      </div>
      {d.remarquesExpert ? <Encadre>{d.remarquesExpert}</Encadre> : null}
    </Cadre>
  );
}

function ProchaineEtape({ d, accent }: { d: DossierRapport; accent: string }) {
  return (
    <Cadre>
      <TitrePage accent={accent}>Prochaine étape</TitrePage>
      <p className="max-w-xl text-pretty text-[16px] leading-relaxed text-text">{d.ctaProchaineEtape}</p>
      <div className="mt-auto grid grid-cols-2 gap-4">
        <CarteAgent d={d} />
        <BlocAgence d={d} />
      </div>
    </Cadre>
  );
}

function BlocAgence({ d }: { d: DossierRapport }) {
  const a = d.agence;
  return (
    <div className="rounded-clay border border-black/[0.06] bg-white px-3 py-2.5">
      {a.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.logoUrl} alt="" className="mb-2 h-7 max-w-[8rem] object-contain object-left" />
      ) : null}
      <p className="text-[13.5px] font-semibold text-text-strong">{a.nomCommercial}</p>
      <p className="text-[12.5px] text-text">{joindreSansVide([a.adresse, a.telephone, a.email, a.siteWeb], '\n')}</p>
    </div>
  );
}

function CarteAgent({ d }: { d: DossierRapport }) {
  const a = d.agent;
  if (!a.nom && !a.telephone && !a.email) return null;
  return (
    <div className="flex items-center gap-3 rounded-clay border border-black/[0.06] bg-white px-3 py-2.5">
      {a.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.photoUrl} alt="" className="size-12 rounded-full object-cover" />
      ) : (
        <span className="flex size-12 items-center justify-center rounded-full bg-black/[0.06] text-[13px] font-semibold">
          {(a.nom ?? 'A').slice(0, 1)}
        </span>
      )}
      <div>
        {a.nom ? <p className="text-[13.5px] font-semibold text-text-strong">{a.nom}</p> : null}
        <p className="text-[12.5px] text-text">{joindreSansVide([a.telephone, a.email])}</p>
      </div>
    </div>
  );
}
