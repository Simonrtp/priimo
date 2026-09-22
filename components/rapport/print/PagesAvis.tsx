import type { ReactNode } from 'react';
import {
  Building2,
  Calendar,
  DoorOpen,
  Layers,
  Ruler,
  User,
} from 'lucide-react';
import { joindreSansVide } from '@/lib/rapport/identite';
import { ATTRIBUTION_IGN, urlCarteIgn } from '@/lib/rapport/genere/carte-ign';
import { DPE_PALETTE, parseDpeLetter } from '@/lib/carte/dpe-public';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import {
  formatDateCourte,
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
  nomPersonne,
} from '@/lib/rapport/genere/format';
import {
  phraseComparaisonSecteur,
  phraseEffortAchat,
  phrasePerimetreConcurrentiel,
  phraseCriteresConcurrentiels,
  phrasePointsInteret,
  phraseSecteur,
} from '@/lib/rapport/genere/phrases';
import { BlocAgence, CarteAgent } from './Contacts';
import { Carte, Fait, GabaritPage, LigneFait, Pastille } from './Gabarit';
import { BarreFourchette, JaugeCirculaire, NuageComparables } from './svg';

const icone = { size: 14, strokeWidth: 1.6 } as const;

export function PageCouverture({ d, accent }: { d: DossierRapport; accent: string }) {
  const date = formatDateCourte(d.dateEvaluation);
  const client = nomPersonne(d.client.nom);
  if (d.photoCouverture) {
    return (
      <GabaritPage accent={accent} plein>
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#1A1714' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={d.photoCouverture.url}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(10,13,17,0.82) 0%, rgba(10,13,17,0.18) 48%, transparent 72%)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              height: '100%',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '8% 7%',
              color: '#fff',
            }}
          >
            {d.agence.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.agence.logoUrl} alt="" style={{ height: 40, maxWidth: 180, objectFit: 'contain' }} />
            ) : (
              <p style={{ margin: 0, fontWeight: 700 }}>{d.agence.nomCommercial}</p>
            )}
            <div>
              <p className="avis-label" style={{ color: 'rgba(255,255,255,0.72)' }}>
                {d.titreCouverture}
              </p>
              {d.adresse ? (
                <p style={{ margin: '0.4rem 0 0', fontSize: '2rem', fontWeight: 700, lineHeight: 1.15, maxWidth: '22ch' }}>
                  {d.adresse}
                </p>
              ) : null}
              {client ? (
                <p style={{ margin: '0.8rem 0 0', fontSize: '0.95rem' }}>
                  À la demande de <strong>{client}</strong>
                </p>
              ) : null}
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', opacity: 0.8 }}>
                {joindreSansVide([date, d.agence.nomCommercial])}
              </p>
            </div>
          </div>
        </div>
      </GabaritPage>
    );
  }
  return (
    <GabaritPage accent={accent} plein>
      <div
        style={{
          display: 'flex',
          height: '100%',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '8% 8%',
          background: '#FFF7F0',
        }}
      >
        {d.agence.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.agence.logoUrl} alt="" style={{ height: 40, maxWidth: 180, objectFit: 'contain' }} />
        ) : (
          <p className="avis-valeur">{d.agence.nomCommercial}</p>
        )}
        <div>
          <p className="avis-label">{d.titreCouverture}</p>
          <span className="avis-filet" aria-hidden />
          {d.adresse ? (
            <p style={{ margin: 0, fontSize: '2.4rem', fontWeight: 700, lineHeight: 1.12, maxWidth: '16ch' }}>
              {d.adresse}
            </p>
          ) : null}
          {client ? (
            <p style={{ margin: '1.2rem 0 0', fontSize: '1rem' }}>
              À la demande de <strong>{client}</strong>
            </p>
          ) : null}
          {date ? <p className="avis-muted" style={{ margin: '0.4rem 0 0' }}>{date}</p> : null}
        </div>
        <p className="avis-valeur">{d.agence.nomCommercial}</p>
      </div>
    </GabaritPage>
  );
}

export function PageVotreBien({ d, accent }: { d: DossierRapport; accent: string }) {
  const titre = intituleBien(d) ?? 'Votre bien';
  const photo = d.photoCouverture ?? d.photos.find((p) => p.kind === 'photo') ?? null;
  const dpe = parseDpeLetter(d.dpeClass);
  return (
    <GabaritPage titre={titre} accent={accent}>
      <div className="avis-grille avis-grille-2" style={{ flex: 1, minHeight: 0 }}>
        <Carte flex>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt=""
              style={{ width: '100%', flex: 1, minHeight: 140, objectFit: 'cover', borderRadius: 12 }}
            />
          ) : null}
          {d.adresse ? <p style={{ margin: '0.7rem 0 0.5rem', fontSize: '0.95rem' }}>{d.adresse}</p> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {d.propertyType ? (
              <Pastille label="Type" valeur={d.propertyType === 'maison' ? 'Maison' : 'Appartement'} />
            ) : null}
            {d.surfaceM2 != null ? <Pastille label="Surface" valeur={formatSurface(d.surfaceM2)} /> : null}
            {d.rooms != null ? <Pastille label="Pièces" valeur={String(d.rooms)} /> : null}
            {libelleEtageAffiche(d.floor) ? <Pastille label="Étage" valeur={libelleEtageAffiche(d.floor)!} /> : null}
            {dpe ? (
              <Pastille label="DPE" valeur={dpe} />
            ) : null}
          </div>
        </Carte>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BlocAgence d={d} />
          <CarteAgent d={d} />
        </div>
      </div>
    </GabaritPage>
  );
}

export function PageImmeuble({ d, accent }: { d: DossierRapport; accent: string }) {
  const immeuble: Array<[string, string, ReactNode]> = [];
  const etages = libelleEtagesImmeubleAffiche(d.etagesImmeuble);
  if (etages) immeuble.push(['Étages', etages, <Layers {...icone} />]);
  if (d.anneeConstruction != null) {
    immeuble.push(['Construction', String(d.anneeConstruction), <Calendar {...icone} />]);
  }
  const appart: Array<[string, string, ReactNode]> = [];
  const etage = libelleEtageAffiche(d.floor);
  if (etage) appart.push(['Étage', etage, <Building2 {...icone} />]);
  const asc = libelleAscenseur(d.ascenseur);
  if (asc) appart.push(['Ascenseur', asc, <DoorOpen {...icone} />]);
  if (d.rooms != null) appart.push(['Pièces', String(d.rooms), <User {...icone} />]);
  if (d.chambres != null) appart.push(['Chambres', String(d.chambres), <User {...icone} />]);
  appart.push(['Occupation', libelleOccupation(d.occupation), <User {...icone} />]);
  const synthese = phraseComparaisonSecteur({
    typeMajoritaire:
      d.iris && d.iris.partAppartements != null
        ? d.iris.partAppartements >= 50
          ? 'appartement'
          : 'maison'
        : null,
    piecesDominant: d.iris?.piecesDominant ?? null,
    epoque: d.iris?.epoque ?? null,
  });
  return (
    <GabaritPage titre="L’immeuble et l’appartement" accent={accent}>
      <div className="avis-grille avis-grille-2" style={{ flex: 1 }}>
        {immeuble.length > 0 ? (
          <Carte flex>
            <p className="avis-label">Immeuble</p>
            {immeuble.map(([l, v, i]) => (
              <LigneFait key={l} icone={i} label={l} valeur={v} />
            ))}
          </Carte>
        ) : null}
        <Carte flex>
          <p className="avis-label">Appartement</p>
          {appart.map(([l, v, i]) => (
            <LigneFait key={l} icone={i} label={l} valeur={v} />
          ))}
        </Carte>
      </div>
      <Carte>
        <p className="avis-label">Surfaces</p>
        <table className="avis-table">
          <tbody>
            {d.surfaceM2 != null ? (
              <tr>
                <td>Habitable</td>
                <td className="num">{formatSurface(d.surfaceM2)}</td>
              </tr>
            ) : null}
            {d.surfaceCarrez != null ? (
              <tr>
                <td>Carrez</td>
                <td className="num">{formatSurface(d.surfaceCarrez)}</td>
              </tr>
            ) : null}
            {d.annexes
              .filter((a) => a.surfaceM2 != null)
              .map((a) => (
                <tr key={a.libelle}>
                  <td>{a.libelle}</td>
                  <td className="num">{formatSurface(a.surfaceM2!)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {synthese ? <p className="avis-muted" style={{ margin: '0.7rem 0 0', fontSize: '0.8rem' }}>{synthese}</p> : null}
      </Carte>
    </GabaritPage>
  );
}

export function PageComparables({ d, accent }: { d: DossierRapport; accent: string }) {
  const avecM2 = d.comparables.filter((v) => v.prixM2 != null);
  const mediane =
    avecM2.length > 0
      ? [...avecM2].sort((a, b) => a.prixM2! - b.prixM2!)[Math.floor(avecM2.length / 2)]!.prixM2!
      : null;
  const nuage = avecM2.map((v) => ({ x: Date.parse(v.date), y: v.prixM2! }));
  const bien =
    d.pricePerM2 != null && d.dateEvaluation
      ? { x: Date.parse(d.dateEvaluation), y: d.pricePerM2 }
      : d.pricePerM2 != null
        ? { x: Date.now(), y: d.pricePerM2 }
        : null;
  return (
    <GabaritPage titre="Ventes comparables" accent={accent}>
      <Carte flex>
        <table className="avis-table">
          <thead>
            <tr>
              <th>Type</th>
              <th className="num">Surface</th>
              <th className="num">Pièces</th>
              <th className="num">Prix</th>
              <th className="num">Prix au m²</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {d.comparables.map((v) => (
              <tr key={v.id}>
                <td>{libelleTypeLocal(v.typeLocal) ?? '—'}</td>
                <td className="num">{formatSurface(v.surfaceM2)}</td>
                <td className="num">{v.pieces != null ? String(v.pieces) : ''}</td>
                <td className="num">{formatEuro(v.prix)}</td>
                <td className="num">{v.prixM2 != null ? formatPrixM2(v.prixM2) : ''}</td>
                <td>{formatDateCourte(v.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Carte>
      {nuage.length >= 2 ? (
        <Carte>
          <p className="avis-label">Prix au m² dans le temps</p>
          <NuageComparables points={nuage} bien={bien} mediane={mediane} accent={accent} />
        </Carte>
      ) : null}
    </GabaritPage>
  );
}

export function PageEstimation({ d, accent }: { d: DossierRapport; accent: string }) {
  const dpe = parseDpeLetter(d.dpeClass);
  const mediane =
    d.comparables.filter((v) => v.prixM2 != null).length > 0
      ? (() => {
          const vals = d.comparables.map((v) => v.prixM2).filter((n): n is number => n != null).sort((a, b) => a - b);
          return vals[Math.floor(vals.length / 2)]!;
        })()
      : null;
  const ecart =
    d.pricePerM2 != null && mediane != null && mediane > 0
      ? ((d.pricePerM2 - mediane) / mediane) * 100
      : null;
  const maxJauge = Math.max(d.pricePerM2 ?? 0, mediane ?? 0, 1);
  return (
    <GabaritPage titre="Notre estimation" accent={accent}>
      {d.priceValue != null ? (
        <p style={{ margin: 0, fontSize: '3.1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
          {formatEuro(d.priceValue)}
        </p>
      ) : null}
      {d.priceLow != null && d.priceHigh != null && d.priceValue != null ? (
        <Carte>
          <div className="avis-grille avis-grille-2" style={{ marginBottom: 6 }}>
            <Fait label="Fourchette basse" valeur={formatEuro(d.priceLow)} />
            <Fait label="Fourchette haute" valeur={formatEuro(d.priceHigh)} />
          </div>
          <BarreFourchette low={d.priceLow} mid={d.priceValue} high={d.priceHigh} accent={accent} />
        </Carte>
      ) : null}
      <div className="avis-grille avis-grille-3">
        {d.pricePerM2 != null && d.surfacePrixLibelle ? (
          <Carte>
            <JaugeCirculaire
              valeur={d.pricePerM2}
              max={maxJauge}
              label={`Prix au m² (${d.surfacePrixLibelle})`}
              accent={accent}
              format={formatPrixM2}
            />
          </Carte>
        ) : null}
        {mediane != null ? (
          <Carte>
            <JaugeCirculaire
              valeur={mediane}
              max={maxJauge}
              label="Médiane des comparables"
              accent="#3D5A80"
              format={formatPrixM2}
            />
          </Carte>
        ) : null}
        {ecart != null ? (
          <Carte>
            <JaugeCirculaire
              valeur={Math.abs(ecart)}
              max={30}
              label="Écart"
              accent={accent}
              format={(n) => `${ecart < 0 ? '−' : '+'}${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}\u202f%`}
            />
          </Carte>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        <Fait label="Occupation" valeur={libelleOccupation(d.occupation)} />
        {dpe ? (
          <span
            aria-label={`DPE ${dpe}`}
            style={{
              display: 'inline-flex',
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              background: DPE_PALETTE[dpe],
              color: dpe === 'D' || dpe === 'C' ? '#0A0D11' : '#fff',
              fontWeight: 700,
            }}
          >
            {dpe}
          </span>
        ) : null}
      </div>
      {d.remarquesExpert ? (
        <Carte>
          <p className="avis-label">Remarques de l’expert</p>
          <p style={{ margin: 0, fontSize: '0.88rem', textWrap: 'pretty' }}>{d.remarquesExpert}</p>
        </Carte>
      ) : null}
    </GabaritPage>
  );
}

export function PageProchaineEtape({ d, accent }: { d: DossierRapport; accent: string }) {
  return (
    <GabaritPage titre="Prochaine étape" accent={accent}>
      <p className="avis-cta">{d.ctaProchaineEtape}</p>
      <div className="avis-grille avis-grille-2" style={{ flex: 1 }}>
        <CarteAgent d={d} />
        <BlocAgence d={d} />
      </div>
    </GabaritPage>
  );
}

export function PageDescription({ d, accent }: { d: DossierRapport; accent: string }) {
  const visuels = d.photos.filter((p) => p.kind === 'photo').slice(0, 6);
  const dpe = parseDpeLetter(d.dpeClass);
  return (
    <GabaritPage titre="Description du bien" accent={accent}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        {d.commentairesPublics ? (
          <Carte flex>
            <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.5, textWrap: 'pretty' }}>
              {d.commentairesPublics}
            </p>
          </Carte>
        ) : null}
        {dpe ? (
          <span
            aria-label={`DPE ${dpe}`}
            style={{
              display: 'inline-flex',
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              background: DPE_PALETTE[dpe],
              color: dpe === 'D' || dpe === 'C' ? '#0A0D11' : '#fff',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {dpe}
          </span>
        ) : null}
      </div>
      {visuels.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: visuels.length > 3 ? '1fr 1fr 1fr' : '1fr 1fr', gap: 8, flex: 1 }}>
          {visuels.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.url} src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
          ))}
        </div>
      ) : null}
    </GabaritPage>
  );
}

export function PageSecteur({ d, accent }: { d: DossierRapport; accent: string }) {
  const iris = d.iris;
  const phrase = iris
    ? phraseSecteur({
        commune: iris.commune,
        partAppartements: iris.partAppartements,
        piecesDominant: iris.piecesDominant,
        epoque: iris.epoque,
        partProprietaires: iris.partProprietaires,
        partLocataires: iris.partLocataires,
      })
    : null;
  return (
    <GabaritPage titre="Le secteur" accent={accent}>
      <div className="avis-grille avis-grille-2" style={{ flex: 1 }}>
        {iris ? (
          <Carte flex>
            {iris.partAppartements != null ? <Fait label="Part d’appartements" valeur={formatPct(iris.partAppartements)} /> : null}
            {iris.piecesDominant != null ? <Fait label="Pièces dominantes" valeur={String(iris.piecesDominant)} /> : null}
            {iris.epoque ? <Fait label="Époque dominante" valeur={iris.epoque} /> : null}
            {iris.partProprietaires != null ? <Fait label="Propriétaires" valeur={formatPct(iris.partProprietaires)} /> : null}
            {iris.partLocataires != null ? <Fait label="Locataires" valeur={formatPct(iris.partLocataires)} /> : null}
            {phrase ? <p className="avis-muted" style={{ marginTop: 'auto', fontSize: '0.82rem' }}>{phrase}</p> : null}
          </Carte>
        ) : null}
        {d.latitude != null && d.longitude != null ? (
          <Carte flex>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlCarteIgn({ latitude: d.latitude, longitude: d.longitude, couche: 'plan' })}
              alt=""
              style={{ width: '100%', flex: 1, minHeight: 160, objectFit: 'cover', borderRadius: 12 }}
            />
            <p className="avis-muted" style={{ margin: '0.45rem 0 0', fontSize: '0.68rem' }}>
              {ATTRIBUTION_IGN}
            </p>
          </Carte>
        ) : null}
      </div>
    </GabaritPage>
  );
}

export function PagePointsInteret({ d, accent }: { d: DossierRapport; accent: string }) {
  const cats = ['administration', 'enseignement', 'transports', 'sante'] as const;
  const lib = { administration: 'Administration', enseignement: 'Enseignement', transports: 'Transports', sante: 'Santé' };
  const resume = cats
    .map((c) => {
      const items = d.equipements.filter((e) => e.categorie === c);
      if (items.length === 0) return null;
      return { categorie: c, count: items.length, plusProcheM: items[0]!.distanceM };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  const phrase = phrasePointsInteret({ categories: resume });
  return (
    <GabaritPage titre="Points d’intérêt" accent={accent}>
      <div className="avis-grille avis-grille-2" style={{ flex: 1 }}>
        {cats.map((c) => {
          const items = d.equipements.filter((e) => e.categorie === c);
          if (items.length === 0) return null;
          return (
            <Carte key={c} flex>
              <p className="avis-label">{lib[c]}</p>
              {items.slice(0, 5).map((e) => (
                <LigneFait key={e.id} icone={<Ruler {...icone} />} label={e.nom} valeur={formatDistance(e.distanceM)} />
              ))}
            </Carte>
          );
        })}
      </div>
      {phrase ? <Carte><p style={{ margin: 0, fontSize: '0.85rem' }}>{phrase}</p></Carte> : null}
    </GabaritPage>
  );
}

export function PageConnectivite({ d, accent }: { d: DossierRapport; accent: string }) {
  const niveaux: Record<string, string> = {
    tres_bonne: 'Très bonne',
    bonne: 'Bonne',
    moyenne: 'Moyenne',
    limitee: 'Limitée',
    nulle: 'Nulle',
  };
  return (
    <GabaritPage titre="Connectivité" accent={accent}>
      <div className="avis-grille avis-grille-2" style={{ flex: 1 }}>
        {d.fixe.length > 0 ? (
          <Carte flex>
            <p className="avis-label">Internet fixe</p>
            <table className="avis-table">
              <tbody>
                {d.fixe.map((l, i) => (
                  <tr key={`${l.operateur}-${i}`}>
                    <td>{l.operateur}</td>
                    <td>{l.technologie.toUpperCase()}</td>
                    <td>{l.eligible ? 'Éligible' : 'Non éligible'}</td>
                    <td className="num">{l.debitMaxMbps != null ? `${l.debitMaxMbps}${'\u202f'}Mbit/s` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Carte>
        ) : null}
        {d.mobile.length > 0 ? (
          <Carte flex>
            <p className="avis-label">Couverture mobile</p>
            <table className="avis-table">
              <tbody>
                {d.mobile.map((l, i) => (
                  <tr key={`${l.operateur}-${i}`}>
                    <td>{l.operateur}</td>
                    <td>{l.generation.toUpperCase()}</td>
                    <td>{niveaux[l.niveau] ?? l.niveau}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Carte>
        ) : null}
      </div>
    </GabaritPage>
  );
}

export function PagePermis({ d, accent }: { d: DossierRapport; accent: string }) {
  return (
    <GabaritPage titre="Permis de construire" accent={accent}>
      <Carte flex>
        <ol style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
          {d.permis.map((p, i) => (
            <li key={p.id} style={{ marginBottom: 8 }}>
              <strong>{i + 1}.</strong> {p.numero}
              {p.type ? ` · ${p.type}` : ''}
              {p.dateDecision ? ` · ${formatDateCourte(p.dateDecision)}` : ''}
              {p.distanceM != null ? ` · ${formatDistance(p.distanceM)}` : ''}
              {p.adresse ? <span className="avis-muted" style={{ display: 'block' }}>{p.adresse}</span> : null}
            </li>
          ))}
        </ol>
      </Carte>
    </GabaritPage>
  );
}

export function PageConcurrentiel({ d, accent }: { d: DossierRapport; accent: string }) {
  const surfaces = d.annonces.map((a) => a.surfaceM2).filter((x): x is number => x != null);
  const prix = d.annonces.map((a) => a.prix).filter((x): x is number => x != null);
  const surfaceMoy = surfaces.length ? surfaces.reduce((s, x) => s + x, 0) / surfaces.length : null;
  const prixMoy = prix.length ? prix.reduce((s, x) => s + x, 0) / prix.length : null;
  const criteres = phraseCriteresConcurrentiels({ propertyType: d.propertyType, postalCode: d.postalCode });
  return (
    <GabaritPage titre="Étude concurrentielle" accent={accent}>
      <p style={{ margin: 0, fontSize: '0.88rem' }}>
        {phrasePerimetreConcurrentiel({ count: d.annonces.length, surfaceMoyenne: surfaceMoy, prixMoyen: prixMoy })}
      </p>
      {criteres ? <p className="avis-muted" style={{ margin: 0, fontSize: '0.8rem' }}>{criteres}</p> : null}
      <Carte flex>
        <table className="avis-table">
          <thead>
            <tr>
              <th>Type</th>
              <th className="num">Surface</th>
              <th className="num">Pièces</th>
              <th className="num">Prix</th>
              <th className="num">Prix au m²</th>
              <th>Relevé</th>
            </tr>
          </thead>
          <tbody>
            {d.annonces.slice(0, 8).map((a) => (
              <tr key={a.id}>
                <td>{libelleTypeLocal(a.typeLocal) ?? ''}</td>
                <td className="num">{a.surfaceM2 != null ? formatSurface(a.surfaceM2) : ''}</td>
                <td className="num">{a.pieces != null ? String(a.pieces) : ''}</td>
                <td className="num">{a.prix != null ? formatEuro(a.prix) : ''}</td>
                <td className="num">{a.prixM2 != null ? formatPrixM2(a.prixM2) : ''}</td>
                <td>{formatDateCourte(a.dateReleve)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Carte>
    </GabaritPage>
  );
}

export function PageIndices({ d, accent }: { d: DossierRapport; accent: string }) {
  const effort =
    d.effort?.secteur != null
      ? phraseEffortAchat({
          secteur: d.effort.secteur,
          departement: d.effort.departement,
          france: d.effort.france,
        })
      : null;
  return (
    <GabaritPage titre="Indices du marché" accent={accent}>
      {d.oat.length > 0 ? (
        <Carte flex>
          <p className="avis-label">Taux OAT</p>
          <table className="avis-table">
            <tbody>
              {d.oat.slice(-8).map((p) => (
                <tr key={p.date}>
                  <td>{p.date.slice(0, 4)}</td>
                  <td className="num">{formatPct(p.taux, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Carte>
      ) : null}
      {effort ? <Carte><p style={{ margin: 0, fontSize: '0.9rem' }}>{effort}</p></Carte> : null}
      {d.fluiditeJoursMedian != null ? (
        <Fait label="Délai médian constaté" valeur={`${Math.round(d.fluiditeJoursMedian)}${'\u202f'}jours`} />
      ) : null}
    </GabaritPage>
  );
}
