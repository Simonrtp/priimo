import type { CSSProperties, ReactNode } from 'react';
import { Ruler } from 'lucide-react';
import { formatDateRapport, joindreSansVide } from '@/lib/rapport/identite';
import { ATTRIBUTION_IGN, urlCarteIgn } from '@/lib/rapport/genere/carte-ign';
import { COMPARABLES_RAYON_M } from '@/lib/rapport/genere/comparables';
import { prixAuM2, surfacePourPrixM2 } from '@/lib/rapport/genere/fourchette';
import { DPE_LETTERS, parseDpeLetter, type DpeLetter } from '@/lib/carte/dpe-public';
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
  phraseEffortAchat,
  phrasePerimetreConcurrentiel,
  phraseCriteresConcurrentiels,
  phrasePointsInteret,
  phraseSecteur,
} from '@/lib/rapport/genere/phrases';
import { BlocAgence, CarteAgent } from './Contacts';
import { Carte, Fait, GabaritPage, LogoSlot, LigneFait } from './Gabarit';

const icone = { size: 14, strokeWidth: 1.6 } as const;

const DPE_BAR: Record<DpeLetter, { w: string; bg: string; ink: string }> = {
  A: { w: '28%', bg: '#009C6D', ink: '#fff' },
  B: { w: '36%', bg: '#52B153', ink: '#fff' },
  C: { w: '44%', bg: '#78BD76', ink: '#0A0D11' },
  D: { w: '52%', bg: '#F4E70F', ink: '#0A0D11' },
  E: { w: '60%', bg: '#F0B40F', ink: '#0A0D11' },
  F: { w: '68%', bg: '#EB8235', ink: '#fff' },
  G: { w: '76%', bg: '#D7221F', ink: '#fff' },
};

const GES_BAR: Record<DpeLetter, { w: string; bg: string; ink: string }> = {
  A: { w: '28%', bg: '#A4DBF8', ink: '#0A0D11' },
  B: { w: '36%', bg: '#8CB4D3', ink: '#0A0D11' },
  C: { w: '44%', bg: '#7792B1', ink: '#fff' },
  D: { w: '52%', bg: '#5F6F8F', ink: '#fff' },
  E: { w: '60%', bg: '#4A4D6F', ink: '#fff' },
  F: { w: '68%', bg: '#373153', ink: '#fff' },
  G: { w: '76%', bg: '#1E1636', ink: '#fff' },
};

const CLIP: CSSProperties = {
  clipPath: 'polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%)',
  display: 'flex',
  alignItems: 'center',
  paddingLeft: 6,
  boxSizing: 'border-box',
  fontSize: 10,
  fontWeight: 700,
};

const CLIP_ON: CSSProperties = {
  clipPath: 'polygon(0 0, calc(100% - 9px) 0, 100% 50%, calc(100% - 9px) 100%, 0 100%)',
  display: 'flex',
  alignItems: 'center',
  paddingLeft: 7,
  boxSizing: 'border-box',
  fontSize: 13,
  fontWeight: 700,
};

function rueEtVille(d: DossierRapport): { rue: string | null; ville: string | null } {
  const ville = joindreSansVide([d.postalCode, d.city], ' ');
  let rue = d.adresse?.trim() || null;
  if (rue && ville && rue.includes(ville)) {
    rue = rue.replace(ville, '').replace(/,\s*$/, '').trim() || rue;
  }
  return { rue, ville };
}

function BarreLettre({
  lettre,
  active,
  palette,
  haut,
}: {
  lettre: DpeLetter;
  active: boolean;
  palette: Record<DpeLetter, { w: string; bg: string; ink: string }>;
  haut: number;
}) {
  const p = palette[lettre];
  return (
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative', height: active ? haut + 8 : haut }}>
      {active ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: `calc(${p.w} - 7px)`,
            top: -8,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '8px solid #0A0D11',
          }}
        />
      ) : null}
      <div
        style={{
          width: p.w,
          height: '100%',
          background: p.bg,
          color: p.ink,
          boxShadow: active ? '0 0 0 2px #fff, 0 0 0 3.5px #0A0D11' : undefined,
          ...(active ? CLIP_ON : CLIP),
        }}
      >
        {lettre}
      </div>
    </div>
  );
}

function EchelleDpeGes({
  dpe,
  ges,
  compact,
}: {
  dpe: DpeLetter | null;
  ges?: DpeLetter | null;
  compact?: boolean;
}) {
  const h = compact ? 15 : 16;
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)', marginBottom: 6 }}>
          Énergie · DPE
        </div>
        {DPE_LETTERS.map((l) => (
          <BarreLettre key={l} lettre={l} active={dpe === l} palette={DPE_BAR} haut={h} />
        ))}
        <div style={{ fontSize: 10.5, color: '#3D5A80', marginTop: 6 }}>kWh/m²·an</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)', marginBottom: 6 }}>
          Climat · GES
        </div>
        {DPE_LETTERS.map((l) => (
          <BarreLettre key={l} lettre={l} active={ges === l} palette={GES_BAR} haut={h} />
        ))}
        <div style={{ fontSize: 10.5, color: '#3D5A80', marginTop: 6 }}>kg CO₂/m²·an</div>
      </div>
    </>
  );
}

function Fiche({
  svg,
  label,
  valeur,
}: {
  svg: ReactNode;
  label: string;
  valeur: string | null;
}) {
  if (!valeur) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {svg}
      <div style={{ fontSize: 10.5, color: '#3D5A80' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{valeur}</div>
    </div>
  );
}

function PhotoSlot({ src, label, span }: { src?: string; label: string; span?: boolean }) {
  const base: CSSProperties = {
    borderRadius: span ? 16 : 14,
    background: 'repeating-linear-gradient(135deg, #EDE3D8 0 8px, #F5EDE4 8px 16px)',
    display: 'flex',
    alignItems: 'flex-end',
    padding: span ? '12px 14px' : '10px 12px',
    font: span ? '500 9.5px/1 ui-monospace, Menlo, monospace' : '500 9px/1 ui-monospace, Menlo, monospace',
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: '#3D5A80',
    overflow: 'hidden',
    position: 'relative',
    gridColumn: span ? 'span 2' : undefined,
  };
  if (src) {
    return (
      <div style={base}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  return <div style={base}>{label}</div>;
}

export function PageCouverture({ d, accent }: { d: DossierRapport; accent: string }) {
  const date = formatDateRapport(d.dateEvaluation);
  const client = nomPersonne(d.client.nom);
  const { rue, ville } = rueEtVille(d);
  const type = intituleBien({ propertyType: d.propertyType, rooms: d.rooms, city: null });
  const sousTitre = joindreSansVide([type, d.surfaceM2 != null ? formatSurface(d.surfaceM2) : null], ' · ');
  const etabli = client ? `Établi pour ${client}` : null;

  if (d.photoCouverture) {
    return (
      <GabaritPage d={d} accent={accent} plein>
        <div style={{ position: 'absolute', top: 40, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, fontSize: 42, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '.01em' }}>
              <span style={{ fontWeight: 300, color: 'var(--accent-2)' }}>Avis de</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>valeur</span>
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.5, color: '#3D5A80' }}>
              {etabli}
              {etabli && sousTitre ? <br /> : null}
              {sousTitre}
            </div>
          </div>
          {date ? (
            <div style={{ background: 'var(--accent)', color: '#fff', padding: '14px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.85 }}>Date</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{date}</div>
            </div>
          ) : null}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 176, height: 80, background: 'var(--accent)', clipPath: 'polygon(0 60px, 100% 0, 100% 20px, 0 80px)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 196, bottom: 0, clipPath: 'polygon(0 60px, 100% 0, 100% 100%, 0 100%)', background: 'repeating-linear-gradient(135deg, #E9EDF2 0 12px, #F2F5F8 12px 24px)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.photoCouverture.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 200, background: 'var(--accent)', clipPath: 'polygon(0 30px, 62% 0, 62% 100%, 0 100%)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 186, background: 'var(--accent-2)', clipPath: 'polygon(0 30px, 60% 0, 54% 100%, 0 100%)' }} />
        <div style={{ position: 'absolute', left: 56, bottom: 44, display: 'flex', flexDirection: 'column', gap: 8, color: '#fff' }}>
          {rue ? <div style={{ fontSize: 50, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1 }}>{rue}</div> : null}
          {ville ? <div style={{ fontSize: 24, fontWeight: 300 }}>{ville}</div> : null}
        </div>
        <div style={{ position: 'absolute', right: 56, bottom: 44, background: '#fff', borderRadius: 10, padding: '12px 14px', boxShadow: '0 4px 18px rgba(10,13,17,.12)' }}>
          <LogoSlot url={d.agence.logoUrl} large />
        </div>
      </GabaritPage>
    );
  }

  const situation = joindreSansVide([libelleEtageAffiche(d.floor), d.annexes[0]?.libelle ?? null], ', ');
  return (
    <GabaritPage d={d} accent={accent} plein>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130, background: 'var(--accent)', clipPath: 'polygon(0 0, 100% 0, 100% 40px, 0 110px)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, background: 'var(--accent-2)', clipPath: 'polygon(0 0, 100% 0, 100% 24px, 0 90px)' }} />
      <div style={{ position: 'absolute', top: 22, right: 56, background: '#fff', borderRadius: 10, padding: '10px 12px' }}>
        <LogoSlot url={d.agence.logoUrl} large />
      </div>
      <div style={{ position: 'absolute', left: 56, right: 56, top: 150, bottom: 210, display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 150, lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '-.02em' }}>
          <span style={{ fontWeight: 300, color: 'var(--accent-2)' }}>Avis de</span>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>valeur</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'right', paddingBottom: 16 }}>
          {date ? <div style={{ fontSize: 15, color: '#3D5A80' }}>{date}</div> : null}
          {rue ? <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1, color: '#0A0D11' }}>{rue}</div> : null}
          {ville ? <div style={{ fontSize: 22, fontWeight: 300, color: '#0A0D11' }}>{ville}</div> : null}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 176, background: 'var(--accent)', clipPath: 'polygon(0 40px, 100% 0, 100% 100%, 0 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 160, background: 'var(--accent-2)', clipPath: 'polygon(0 44px, 100% 8px, 100% 100%, 0 100%)' }} />
      <div style={{ position: 'absolute', left: 56, right: 56, bottom: 40, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, color: '#fff' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.8 }}>Le bien</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{type ?? ''}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.8 }}>Surface</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{d.surfaceM2 != null ? formatSurface(d.surfaceM2) : ''}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.8 }}>Situation</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{situation ?? ''}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.8 }}>Document</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{etabli ?? ''}</div>
        </div>
      </div>
    </GabaritPage>
  );
}

const SVG_SURF = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#3D5A80" style={{ strokeWidth: 1.5 }}><rect x="3" y="3" width="14" height="14" rx="1.5" /></svg>
);
const SVG_CARREZ = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#3D5A80" style={{ strokeWidth: 1.5 }}><path d="M2 14h16M5 14v-4M9 14v-2.5M13 14v-4M16 14v-2.5" /></svg>
);
const SVG_PIECES = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#3D5A80" style={{ strokeWidth: 1.5 }}><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" /><rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" /></svg>
);
const SVG_ETAGE = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#3D5A80" style={{ strokeWidth: 1.5 }}><path d="M2 17h4v-4h4v-4h4v-4h4" /></svg>
);
const SVG_EXT = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#3D5A80" style={{ strokeWidth: 1.5 }}><circle cx="10" cy="8" r="4" /><path d="M3 17h14" /></svg>
);
const SVG_ANNEXE = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#3D5A80" style={{ strokeWidth: 1.5 }}><rect x="3" y="6" width="14" height="11" rx="1.5" /><path d="M3 10h14" /></svg>
);
const SVG_ETAT = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#3D5A80" style={{ strokeWidth: 1.5 }}><circle cx="10" cy="10" r="7" /><path d="M6.8 10.2l2.2 2.2 4.2-4.6" /></svg>
);
const SVG_OCC = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#3D5A80" style={{ strokeWidth: 1.5 }}><rect x="5" y="2.5" width="10" height="15" rx="1" /><circle cx="12" cy="10" r="0.8" /></svg>
);

function fichesBien(d: DossierRapport) {
  const pieces =
    d.rooms != null
      ? joindreSansVide([`${d.rooms} pièce${d.rooms > 1 ? 's' : ''}`, d.chambres != null ? `${d.chambres} ch.` : null], ' · ')
      : d.chambres != null
        ? `${d.chambres} ch.`
        : null;
  const etageAsc = joindreSansVide(
    [libelleEtageAffiche(d.floor), d.ascenseur === true ? 'avec asc.' : d.ascenseur === false ? 'sans asc.' : null],
    ' · ',
  );
  const extAnnexe = d.annexes.find((a) => /terrasse|balcon|jardin|cour/i.test(a.libelle));
  const ext = extAnnexe?.libelle ?? (d.balconTerrasse ? 'Balcon / terrasse' : null);
  const autresAnnexes = d.annexes.filter((a) => !/terrasse|balcon|jardin|cour/i.test(a.libelle));
  const annexes =
    autresAnnexes.length > 0
      ? autresAnnexes.map((a) => (a.surfaceM2 != null ? `${a.libelle} de ${formatSurface(a.surfaceM2)}` : a.libelle)).join(', ')
      : null;
  return [
    { svg: SVG_SURF, label: 'Surface habitable', valeur: d.surfaceM2 != null ? formatSurface(d.surfaceM2) : null },
    { svg: SVG_CARREZ, label: 'Surface Carrez', valeur: d.surfaceCarrez != null ? formatSurface(d.surfaceCarrez) : null },
    { svg: SVG_PIECES, label: 'Pièces et chambres', valeur: pieces },
    { svg: SVG_ETAGE, label: 'Étage et ascenseur', valeur: etageAsc },
    { svg: SVG_EXT, label: 'Extérieur', valeur: ext },
    { svg: SVG_ANNEXE, label: 'Annexes', valeur: annexes },
    { svg: SVG_ETAT, label: 'État', valeur: d.etatLibelle },
    { svg: SVG_OCC, label: 'Occupation', valeur: libelleOccupation(d.occupation) },
  ].filter((f) => f.valeur);
}

export function PageVotreBien({ d, accent }: { d: DossierRapport; accent: string }) {
  const titre = intituleBien({ propertyType: d.propertyType, rooms: d.rooms, city: null });
  const photos = [
    d.photoCouverture,
    ...d.photos.filter((p) => p.kind === 'photo' && p.url !== d.photoCouverture?.url),
  ]
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 3);
  const dpe = parseDpeLetter(d.dpeClass);
  const ges = parseDpeLetter(d.gesClass);
  const { rue, ville } = rueEtVille(d);
  const ligne = joindreSansVide([joindreSansVide([rue, ville], ', '), libelleEtageAffiche(d.floor)], ' · ');
  const fiches = fichesBien(d);
  const avecPhotos = photos.length > 0;

  if (avecPhotos) {
    return (
      <GabaritPage d={d} titre="Votre bien" accent={accent}>
        <div style={{ flex: 1, minHeight: 0, padding: '18px 40px 16px', display: 'grid', gridTemplateColumns: '372px minmax(0, 1fr)', gap: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '228px 118px', gap: 10 }}>
              <PhotoSlot src={photos[0]?.url} label="photo principale" span />
              <PhotoSlot src={photos[1]?.url} label="photo" />
              <PhotoSlot src={photos[2]?.url} label="photo" />
            </div>
            <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <EchelleDpeGes dpe={dpe} ges={ges} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.1 }}>
                {titre}
                {titre && d.surfaceM2 != null ? ` — ${formatSurface(d.surfaceM2)}` : ''}
              </div>
              <div style={{ fontSize: 13, color: '#3D5A80' }}>{ligne}</div>
            </div>
            {d.commentairesPublics ? (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.62, color: '#0A0D11', textWrap: 'pretty' }}>{d.commentairesPublics}</p>
            ) : null}
            <div style={{ background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', rowGap: 16, columnGap: 18 }}>
              {fiches.map((f) => (
                <Fiche key={f.label} {...f} />
              ))}
            </div>
          </div>
        </div>
      </GabaritPage>
    );
  }

  return (
    <GabaritPage d={d} titre="Votre bien" accent={accent}>
      <div style={{ flex: 1, minHeight: 0, padding: '18px 40px 16px', display: 'grid', gridTemplateColumns: '380px minmax(0, 1fr)', gap: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '10px 0 4px' }}>
          <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1.02 }}>
            {titre}
            {titre && d.surfaceM2 != null ? ` — ${formatSurface(d.surfaceM2)}` : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--accent)' }} />
            <div style={{ fontSize: 14, color: '#3D5A80' }}>{ligne}</div>
          </div>
          {d.commentairesPublics ? (
            <p style={{ margin: 'auto 0 0', fontSize: 15.5, lineHeight: 1.62, textWrap: 'pretty' }}>{d.commentairesPublics}</p>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
          <div style={{ background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '18px 22px', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', rowGap: 18, columnGap: 18 }}>
            {fiches.map((f) => (
              <Fiche key={f.label} {...f} />
            ))}
          </div>
          <div style={{ background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
            <EchelleDpeGes dpe={dpe} ges={ges} compact />
          </div>
        </div>
      </div>
    </GabaritPage>
  );
}

export function PageImmeuble({ d, accent }: { d: DossierRapport; accent: string }) {
  const cats = ['transports', 'enseignement', 'administration', 'sante'] as const;
  const lib = { administration: 'Administration', enseignement: 'Écoles', transports: 'Transports', sante: 'Santé' };
  const proximite = cats
    .map((c) => {
      const items = d.equipements.filter((e) => e.categorie === c).slice(0, 2);
      return { c, items };
    })
    .filter((x) => x.items.length > 0);
  return (
    <GabaritPage d={d} titre="L’immeuble et son environnement" accent={accent}>
      <div style={{ flex: 1, minHeight: 0, padding: '18px 40px 16px', display: 'grid', gridTemplateColumns: proximite.length > 0 ? 'minmax(0, 1.1fr) minmax(0, 1fr)' : '1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>Extrait du plan cadastral</div>
            </div>
            <div style={{ flex: 1, minHeight: 0, borderRadius: 10, overflow: 'hidden', background: '#F6F0E8' }}>
              {d.latitude != null && d.longitude != null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlCarteIgn({ latitude: d.latitude, longitude: d.longitude, couche: 'cadastre' })}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 18, fontSize: 11, color: '#3D5A80' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, border: '2px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 20%, #fff)' }} />
                Parcelle de l&apos;immeuble
              </span>
              <span>{ATTRIBUTION_IGN}</span>
            </div>
          </div>
          <div style={{ background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>La copropriété</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.02em' }}>{libelleEtagesImmeubleAffiche(d.etagesImmeuble) ?? ''}</div>
                <div style={{ fontSize: 11.5, color: '#3D5A80' }}>étages</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderLeft: '1px solid rgba(61,90,128,.14)', paddingLeft: 18 }}>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.02em' }}>{d.anneeConstruction ?? ''}</div>
                <div style={{ fontSize: 11.5, color: '#3D5A80' }}>année de construction</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderLeft: '1px solid rgba(61,90,128,.14)', paddingLeft: 18 }}>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.02em' }}>{libelleAscenseur(d.ascenseur) ?? ''}</div>
                <div style={{ fontSize: 11.5, color: '#3D5A80' }}>ascenseur</div>
              </div>
            </div>
          </div>
        </div>
        {proximite.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>À proximité</div>
              <div style={{ fontSize: 11, color: '#3D5A80' }}>Distances à pied</div>
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: proximite.length === 1 ? '1fr' : '1fr 1fr', columnGap: 22, rowGap: 10 }}>
              {proximite.map(({ c, items }, i) => (
                <div key={c} style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: proximite.length > 2 && i > 1 ? '1px solid rgba(61,90,128,.12)' : undefined, paddingTop: proximite.length > 2 && i > 1 ? 10 : undefined }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{lib[c]}</div>
                  {items.map((e) => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, gap: 8 }}>
                      <span>{e.nom}</span>
                      <span style={{ color: '#3D5A80', whiteSpace: 'nowrap' }}>{formatDistance(e.distanceM)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        ) : null}
      </div>
    </GabaritPage>
  );
}

export function PageComparables({ d, accent }: { d: DossierRapport; accent: string }) {
  const avecM2 = d.comparables.filter((v) => v.prixM2 != null);
  const mediane =
    avecM2.length > 0
      ? [...avecM2].sort((a, b) => a.prixM2! - b.prixM2!)[Math.floor(avecM2.length / 2)]!.prixM2!
      : null;
  const rayon = d.comparables.length > 0 && d.comparables.every((c) => c.perimetre === 'rayon') ? COMPARABLES_RAYON_M : null;
  const maxM2 = Math.max(...avecM2.map((v) => v.prixM2!), d.pricePerM2 ?? 0, 1);
  const barres = [...avecM2].sort((a, b) => (a.prixM2 ?? 0) - (b.prixM2 ?? 0));
  const row: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '30px minmax(0, 1.5fr) 1fr .6fr .8fr 1.1fr 1fr',
    columnGap: 10,
    alignItems: 'center',
    fontSize: 12,
    height: 30,
    padding: '0 8px',
  };

  return (
    <GabaritPage d={d} titre="Les ventes comparables" accent={accent}>
      <div style={{ flex: 1, minHeight: 0, padding: '18px 40px 16px', display: 'grid', gridTemplateColumns: '392px minmax(0, 1fr)', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>Emplacement des ventes</div>
            <div style={{ flex: 1, minHeight: 0, borderRadius: 10, overflow: 'hidden', background: '#F2EBE2' }}>
              {d.latitude != null && d.longitude != null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urlCarteIgn({ latitude: d.latitude, longitude: d.longitude, couche: 'plan' })} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 10.5, color: '#3D5A80', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />Votre bien</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-2)' }} />Vente comparable</span>
              {rayon != null ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 0, borderTop: '1.5px dashed #3D5A80' }} />Rayon de {rayon} m</span>
              ) : null}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div style={{ background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.02em' }}>{mediane != null ? formatPrixM2(mediane).replace('/m²', '') : ''}</div>
              <div style={{ fontSize: 10.5, color: '#3D5A80', lineHeight: 1.35 }}>prix médian au m²</div>
            </div>
            <div style={{ background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.02em' }}>{d.comparables.length} vente{d.comparables.length > 1 ? 's' : ''}</div>
              <div style={{ fontSize: 10.5, color: '#3D5A80', lineHeight: 1.35 }}>retenues pour la comparaison</div>
            </div>
            <div style={{ background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.02em' }}>{rayon != null ? `${rayon} m` : ''}</div>
              <div style={{ fontSize: 10.5, color: '#3D5A80', lineHeight: 1.35 }}>sur les 12 derniers mois</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
          <div style={{ background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 20px 12px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)', marginBottom: 10 }}>Détail des ventes</div>
            <div style={{ ...row, fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#3D5A80', height: 'auto', padding: '0 8px 8px', borderBottom: '1px solid rgba(61,90,128,.16)' }}>
              <span>N°</span><span>Type</span><span>Date</span><span style={{ textAlign: 'right' }}>Pièces</span><span style={{ textAlign: 'right' }}>Surface</span><span style={{ textAlign: 'right' }}>Prix</span><span style={{ textAlign: 'right' }}>Prix/m²</span>
            </div>
            {d.comparables.map((v, i) => (
              <div key={v.id} style={{ ...row, borderRadius: 6, background: i % 2 === 0 ? 'rgba(61,90,128,.05)' : undefined }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent-2)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <span>{libelleTypeLocal(v.typeLocal) ?? ''}</span>
                <span>{formatDateCourte(v.date)}</span>
                <span style={{ textAlign: 'right' }}>{v.pieces != null ? String(v.pieces) : ''}</span>
                <span style={{ textAlign: 'right' }}>{formatSurface(v.surfaceM2)}</span>
                <span style={{ textAlign: 'right' }}>{formatEuro(v.prix)}</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{v.prixM2 != null ? formatPrixM2(v.prixM2).replace('/m²', '') : ''}</span>
              </div>
            ))}
          </div>
          {barres.length >= 2 ? (
            <div style={{ flex: 1, minHeight: 0, background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 20px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>Prix au m², du plus bas au plus haut</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {barres.map((v) => {
                  const i = d.comparables.findIndex((c) => c.id === v.id);
                  const pct = Math.max(8, Math.round(((v.prixM2 ?? 0) / maxM2) * 100));
                  return (
                    <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '134px 1fr 66px', alignItems: 'center', gap: 10, height: 18 }}>
                      <div style={{ fontSize: 11.5, display: 'flex', gap: 7, alignItems: 'center' }}>
                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent-2)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                        {libelleTypeLocal(v.typeLocal) ?? ''}
                      </div>
                      <div style={{ height: 12, background: 'rgba(61,90,128,.07)', borderRadius: 3 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-2)', borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{v.prixM2 != null ? formatPrixM2(v.prixM2).replace('/m²', '') : ''}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 'auto', fontSize: 10.5, color: '#3D5A80' }}>Source : ventes réelles publiées par l&apos;État (DVF)</div>
            </div>
          ) : null}
        </div>
      </div>
    </GabaritPage>
  );
}

export function PageEstimation({ d, accent }: { d: DossierRapport; accent: string }) {
  const mediane =
    d.comparables.filter((v) => v.prixM2 != null).length > 0
      ? (() => {
          const vals = d.comparables.map((v) => v.prixM2).filter((n): n is number => n != null).sort((a, b) => a - b);
          return vals[Math.floor(vals.length / 2)]!;
        })()
      : null;
  const low = d.priceLow;
  const mid = d.priceValue;
  const high = d.priceHigh;
  const span = low != null && high != null && high > low ? high - low : null;
  const curseur = mid != null && low != null && span != null && span > 0 ? Math.min(100, Math.max(0, ((mid - low) / span) * 100)) : 50;
  const surfPrix = surfacePourPrixM2({ surfaceM2: d.surfaceM2, surfaceCarrez: d.surfaceCarrez });
  const m2Low = prixAuM2(low, surfPrix?.m2);
  const m2High = prixAuM2(high, surfPrix?.m2);
  const agent = nomPersonne(d.agent.nom);
  const pts = [d.pricePerM2, mediane].filter((n): n is number => n != null);
  const minP = pts.length ? Math.min(...pts) * 0.92 : 0;
  const maxP = pts.length ? Math.max(...pts) * 1.08 : 1;
  const pos = (n: number) => `${((n - minP) / (maxP - minP)) * 100}%`;

  return (
    <GabaritPage d={d} titre="Notre estimation" accent={accent}>
      <div style={{ flex: 1, minHeight: 0, padding: '16px 40px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '400px minmax(0, 1fr)', gap: 16 }}>
          <div style={{ background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>Prix estimé</div>
              {d.priceValue != null ? (
                <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1, color: 'var(--accent)' }}>{formatEuro(d.priceValue)}</div>
              ) : null}
              {d.pricePerM2 != null ? (
                <div style={{ fontSize: 19, fontWeight: 600, color: '#0A0D11' }}>soit {formatPrixM2(d.pricePerM2)}</div>
              ) : null}
              <div style={{ fontSize: 11.5, color: '#3D5A80' }}>Estimation établie pour un bien {libelleOccupation(d.occupation).toLowerCase()}</div>
            </div>
            <div style={{ height: 1, background: 'rgba(61,90,128,.16)' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>Remarques de votre conseiller</div>
              {d.remarquesExpert ? (
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, textWrap: 'pretty' }}>{d.remarquesExpert}</p>
              ) : null}
              {agent ? <div style={{ marginTop: 'auto', fontSize: 12, fontWeight: 600 }}>{agent}</div> : null}
            </div>
          </div>
          <div style={{ background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '22px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 18 }}>
            {low != null && high != null && mid != null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>Fourchette d&apos;estimation</div>
                <div style={{ position: 'relative', paddingTop: 44 }}>
                  <div style={{ position: 'absolute', left: `${curseur}%`, top: 0, transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{formatEuro(mid)}</div>
                    <div style={{ fontSize: 10.5, color: '#3D5A80' }}>Estimée</div>
                  </div>
                  <div style={{ position: 'relative', height: 16, borderRadius: 8, background: 'linear-gradient(90deg, color-mix(in srgb, var(--accent) 22%, #fff), color-mix(in srgb, var(--accent) 60%, #fff), color-mix(in srgb, var(--accent) 22%, #fff))' }}>
                    <div style={{ position: 'absolute', left: `${curseur}%`, top: '50%', width: 26, height: 26, margin: '-13px 0 0 -13px', borderRadius: '50%', background: 'var(--accent)', border: '4px solid #fff', boxSizing: 'border-box', boxShadow: '0 1px 5px rgba(10,13,17,.22)' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3D5A80' }}>Basse</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{formatEuro(low)}</div>
                    {m2Low != null ? <div style={{ fontSize: 11, color: '#3D5A80' }}>{formatPrixM2(m2Low)}</div> : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3D5A80' }}>Haute</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{formatEuro(high)}</div>
                    {m2High != null ? <div style={{ fontSize: 11, color: '#3D5A80' }}>{formatPrixM2(m2High)}</div> : null}
                  </div>
                </div>
              </div>
            ) : null}
            {d.pricePerM2 != null && mediane != null ? (
              <>
                <div style={{ height: 1, background: 'rgba(61,90,128,.16)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>Prix au m² comparé</div>
                  <div style={{ position: 'relative', height: 96 }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 46, height: 3, borderRadius: 2, background: 'rgba(61,90,128,.18)' }} />
                    <div style={{ position: 'absolute', left: pos(d.pricePerM2), top: 38, width: 19, height: 19, marginLeft: -9.5, borderRadius: '50%', background: 'var(--accent)', border: '3px solid #fff', boxSizing: 'border-box' }} />
                    <div style={{ position: 'absolute', left: pos(d.pricePerM2), top: 0, transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{formatPrixM2(d.pricePerM2).replace('/m²', '')}</div>
                      <div style={{ fontSize: 10.5, color: '#3D5A80' }}>Votre bien</div>
                    </div>
                    <div style={{ position: 'absolute', left: pos(mediane), top: 40, width: 15, height: 15, marginLeft: -7.5, borderRadius: '50%', background: 'var(--accent-2)', border: '2px solid #fff', boxSizing: 'border-box' }} />
                    <div style={{ position: 'absolute', left: pos(mediane), top: 62, transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{formatPrixM2(mediane).replace('/m²', '')}</div>
                      <div style={{ fontSize: 10.5, color: '#3D5A80' }}>Médiane des comparables</div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
        <div style={{ background: 'var(--accent-2)', color: '#fff', borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ flex: 1, fontSize: 21, fontWeight: 600, letterSpacing: '-.015em' }}>
            <span style={{ fontWeight: 300 }}>Prochaine étape :</span> {d.ctaProchaineEtape}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {d.agent.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.agent.photoUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.18) 0 5px, rgba(255,255,255,.08) 5px 10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '500 7.5px/1 ui-monospace, Menlo, monospace', letterSpacing: '.08em', color: 'rgba(255,247,240,.55)', flex: 'none' }}>PHOTO</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: 'rgba(255,247,240,.78)' }}>
              {agent ? <div style={{ fontSize: 15, fontWeight: 600, color: '#FFF7F0' }}>{agent}</div> : null}
              {d.agent.telephone ? <div>{d.agent.telephone}</div> : null}
              {d.agent.email ? <div>{d.agent.email}</div> : null}
            </div>
          </div>
          <div style={{ background: '#FFF7F0', borderRadius: 8, padding: '8px 10px' }}>
            <LogoSlot url={d.agence.logoUrl} />
          </div>
        </div>
        <div style={{ fontSize: 9, color: '#3D5A80' }}>Avis de valeur indicatif, ne constituant pas une expertise</div>
      </div>
    </GabaritPage>
  );
}

export function PageProchaineEtape({ d, accent }: { d: DossierRapport; accent: string }) {
  return (
    <GabaritPage d={d} titre="Prochaine étape" accent={accent}>
      <div style={{ flex: 1, minHeight: 0, padding: '18px 40px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="avis-cta">{d.ctaProchaineEtape}</p>
        <div className="avis-grille avis-grille-2" style={{ flex: 1 }}>
          <CarteAgent d={d} />
          <BlocAgence d={d} />
        </div>
      </div>
    </GabaritPage>
  );
}

export function PageDescription({ d, accent }: { d: DossierRapport; accent: string }) {
  return <PageVotreBien d={d} accent={accent} />;
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
  const profil =
    iris != null &&
    (iris.partAppartements != null ||
      iris.piecesDominant != null ||
      Boolean(iris.epoque) ||
      iris.partProprietaires != null ||
      iris.partLocataires != null ||
      Boolean(phrase));
  return (
    <GabaritPage d={d} titre="Les prix dans votre quartier" accent={accent}>
      <div style={{ flex: 1, minHeight: 0, padding: '18px 40px 16px', display: 'grid', gridTemplateColumns: profil ? '540px minmax(0, 1fr)' : '1fr', gap: 16 }}>
        <div style={{ minHeight: 0, background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>Prix au m² autour du bien</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, borderRadius: 10, overflow: 'hidden', background: '#FCE3B8' }}>
            {d.latitude != null && d.longitude != null ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlCarteIgn({ latitude: d.latitude, longitude: d.longitude, couche: 'plan' })} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : null}
          </div>
          {d.pricePerM2 != null ? (
            <div style={{ fontSize: 10.5, color: '#3D5A80' }}>Votre bien · {formatPrixM2(d.pricePerM2)}</div>
          ) : null}
        </div>
        {profil ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>Profil du secteur</div>
            {iris?.partAppartements != null ? <Fait label="Part d’appartements" valeur={formatPct(iris.partAppartements)} /> : null}
            {iris?.piecesDominant != null ? <Fait label="Pièces dominantes" valeur={String(iris.piecesDominant)} /> : null}
            {iris?.epoque ? <Fait label="Époque dominante" valeur={iris.epoque} /> : null}
            {iris?.partProprietaires != null ? <Fait label="Propriétaires" valeur={formatPct(iris.partProprietaires)} /> : null}
            {iris?.partLocataires != null ? <Fait label="Locataires" valeur={formatPct(iris.partLocataires)} /> : null}
            {phrase ? <p className="avis-muted" style={{ marginTop: 'auto', fontSize: 12 }}>{phrase}</p> : null}
          </div>
        </div>
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
    <GabaritPage d={d} titre="Points d’intérêt" accent={accent}>
      <div style={{ flex: 1, minHeight: 0, padding: '18px 40px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="avis-grille avis-grille-2" style={{ flex: 1 }}>
          {cats.map((c) => {
            const items = d.equipements.filter((e) => e.categorie === c);
            if (items.length === 0) return null;
            return (
              <Carte key={c} flex>
                <p className="avis-kicker">{lib[c]}</p>
                {items.slice(0, 5).map((e) => (
                  <LigneFait key={e.id} icone={<Ruler {...icone} />} label={e.nom} valeur={formatDistance(e.distanceM)} />
                ))}
              </Carte>
            );
          })}
        </div>
        {phrase ? <Carte><p style={{ margin: 0, fontSize: '0.85rem' }}>{phrase}</p></Carte> : null}
      </div>
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
    <GabaritPage d={d} titre="Connectivité" accent={accent}>
      <div style={{ flex: 1, minHeight: 0, padding: '18px 40px 16px' }} className="avis-grille avis-grille-2">
        {d.fixe.length > 0 ? (
          <Carte flex>
            <p className="avis-kicker">Internet fixe</p>
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
            <p className="avis-kicker">Couverture mobile</p>
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
    <GabaritPage d={d} titre="Permis de construire" accent={accent}>
      <div style={{ flex: 1, minHeight: 0, padding: '18px 40px 16px' }}>
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
      </div>
    </GabaritPage>
  );
}

export function PageConcurrentiel({ d, accent }: { d: DossierRapport; accent: string }) {
  const lettres = 'ABCDEF';
  const cartes = d.annonces.slice(0, 5);
  const surf = d.annonces.map((a) => a.surfaceM2).filter((x): x is number => x != null);
  const prix = d.annonces.map((a) => a.prix).filter((x): x is number => x != null);
  const surfaceMoy = surf.length ? surf.reduce((s, x) => s + x, 0) / surf.length : null;
  const prixMoy = prix.length ? prix.reduce((s, x) => s + x, 0) / prix.length : null;
  const criteres = phraseCriteresConcurrentiels({ propertyType: d.propertyType, postalCode: d.postalCode });
  const ecart = d.negotiationPctMedian;
  return (
    <GabaritPage d={d} titre="Les biens en vente autour de vous" accent={accent}>
      <div style={{ flex: 1, minHeight: 0, padding: '18px 40px 16px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 470px', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(3, 1fr)', gap: 12, minHeight: 0 }}>
          {cartes.map((a, i) => (
            <div key={a.id} style={{ background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #3D5A80', color: '#3D5A80', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>{lettres[i]}</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{libelleTypeLocal(a.typeLocal) ?? ''}</div>
                  <div style={{ fontSize: 11.5, color: '#3D5A80' }}>
                    {joindreSansVide([a.pieces != null ? `${a.pieces} pièces` : null, a.surfaceM2 != null ? formatSurface(a.surfaceM2) : null], ' · ')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.02em' }}>{a.prix != null ? formatEuro(a.prix) : ''}</div>
                <div style={{ fontSize: 12, color: '#3D5A80' }}>{a.prixM2 != null ? formatPrixM2(a.prixM2) : ''}</div>
              </div>
            </div>
          ))}
          {ecart != null ? (
            <div style={{ background: 'var(--accent-2)', color: '#fff', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1, color: '#fff' }}>
                {ecart > 0 ? '+' : ''}{Math.round(ecart)}{'\u00a0'}%
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.4, fontWeight: 500 }}>
                {phrasePerimetreConcurrentiel({ count: d.annonces.length, surfaceMoyenne: surfaceMoy, prixMoyen: prixMoy })}
              </div>
            </div>
          ) : null}
        </div>
        <div style={{ minHeight: 0, background: '#F3F4F6', borderRadius: 16, boxShadow: '0 1px 2px rgba(10,13,17,.03)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-2)' }}>Surface et prix au m²</div>
            <div style={{ fontSize: 11, color: '#3D5A80' }}>{criteres}</div>
          </div>
          {d.latitude != null && d.longitude != null ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlCarteIgn({ latitude: d.latitude, longitude: d.longitude, couche: 'plan' })} alt="" style={{ flex: 1, minHeight: 0, width: '100%', objectFit: 'cover', borderRadius: 10 }} />
          ) : null}
        </div>
      </div>
    </GabaritPage>
  );
}

export function PageIndices({ d, accent }: { d: DossierRapport; accent: string }) {
  const effort =
    d.effort?.secteur != null
      ? phraseEffortAchat({ secteur: d.effort.secteur, departement: d.effort.departement, france: d.effort.france })
      : null;
  return (
    <GabaritPage d={d} titre="Indices du marché" accent={accent}>
      <div style={{ flex: 1, minHeight: 0, padding: '18px 40px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {d.oat.length > 0 ? (
          <Carte flex>
            <p className="avis-kicker">Taux OAT</p>
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
      </div>
    </GabaritPage>
  );
}
