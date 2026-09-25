import type { KindGeneree } from '@/lib/rapport/modele-defaut';

const ACCENT = '#E8743C';
const ARDOISE = '#1A2A56';
const CREME = '#FFF7F0';
const PAPIER = '#F7F4EF';

/** Miniature A4 — assez lisible pour reconnaître la page, assez petite pour se déplier. */
export default function ApercuPageRapport({
  kind,
  titre,
}: {
  kind: KindGeneree | 'bibliotheque';
  titre: string;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[3px] bg-white shadow-clay-sm"
      style={{ width: 124, height: 176 }}
      aria-hidden
    >
      <Interieur kind={kind} titre={titre} />
    </div>
  );
}

function Interieur({ kind, titre }: { kind: KindGeneree | 'bibliotheque'; titre: string }) {
  switch (kind) {
    case 'couverture':
      return <MiniCouverture />;
    case 'votre_bien':
    case 'description':
      return <MiniVotreBien />;
    case 'immeuble_appartement':
      return <MiniImmeuble />;
    case 'secteur':
      return <MiniSecteur />;
    case 'comparables':
      return <MiniComparables />;
    case 'concurrentiel':
      return <MiniConcurrentiel />;
    case 'prix':
      return <MiniEstimation />;
    case 'prochaine_etape':
      return <MiniCta />;
    default:
      return <MiniLibre titre={titre} />;
  }
}

function Entete({ titre }: { titre: string }) {
  return (
    <div className="flex items-end justify-between px-2 pt-2">
      <p className="font-display text-[7.5px] font-semibold leading-tight text-ink">{titre}</p>
      <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: ACCENT }} />
    </div>
  );
}

function MiniCouverture() {
  return (
    <div className="relative h-full bg-white">
      <div
        className="absolute inset-x-0 top-0 h-7"
        style={{
          background: ACCENT,
          clipPath: 'polygon(0 0, 100% 0, 100% 40%, 0 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-6"
        style={{
          background: ARDOISE,
          clipPath: 'polygon(0 0, 100% 0, 100% 28%, 0 86%)',
        }}
      />
      <div className="absolute left-2 top-9 right-2">
        <p className="font-display text-[13px] font-light leading-none" style={{ color: ARDOISE }}>
          Avis de
        </p>
        <p className="font-display text-[16px] font-bold leading-none" style={{ color: ACCENT }}>
          valeur
        </p>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-[46%]"
        style={{
          background: `repeating-linear-gradient(135deg, #E4E8EE 0 6px, #EEF1F5 6px 12px)`,
          clipPath: 'polygon(0 18%, 100% 0, 100% 100%, 0 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-11"
        style={{
          background: ACCENT,
          clipPath: 'polygon(0 28%, 62% 0, 62% 100%, 0 100%)',
        }}
      />
      <p className="absolute bottom-3 left-2 font-display text-[8px] font-bold text-white">
        Rue type
      </p>
    </div>
  );
}

function MiniVotreBien() {
  return (
    <div className="flex h-full flex-col bg-white">
      <Entete titre="Votre bien" />
      <div
        className="mx-2 mt-1.5 h-[58px] rounded-[3px]"
        style={{
          background: `repeating-linear-gradient(135deg, #E4E8EE 0 7px, #F0F3F7 7px 14px)`,
        }}
      />
      <div className="mt-1.5 flex flex-col gap-1 px-2">
        {['Appartement · 4 pièces', '87 m² · 3e étage', 'Ascenseur · cave'].map((l) => (
          <div key={l} className="flex items-center gap-1">
            <span className="size-1 rounded-full" style={{ backgroundColor: ACCENT }} />
            <span className="text-[6.5px] text-mute">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniImmeuble() {
  return (
    <div className="flex h-full flex-col bg-white">
      <Entete titre="L’immeuble" />
      <div className="mx-2 mt-1.5 grid flex-1 grid-cols-2 gap-1 pb-2">
        <div className="rounded-[3px] bg-[#D4E8F5]" />
        <div className="flex flex-col justify-center gap-1">
          {['1905', '12 lots', '2 ventes'].map((l) => (
            <span key={l} className="rounded-[2px] bg-black/[0.04] px-1 py-0.5 text-[6px] text-mute">
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniSecteur() {
  const hauteurs = [42, 68, 54, 78, 46];
  return (
    <div className="flex h-full flex-col bg-white">
      <Entete titre="Le quartier" />
      <div className="mx-2 mt-2 flex flex-1 items-end gap-1 pb-3">
        {hauteurs.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-[1px]"
            style={{
              height: `${h}%`,
              backgroundColor: i === 3 ? ACCENT : '#D4DFF0',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MiniComparables() {
  return (
    <div className="flex h-full flex-col bg-white">
      <Entete titre="Comparables" />
      <div className="mt-2 flex flex-col gap-1 px-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="size-4 shrink-0 rounded-[2px]"
              style={{ backgroundColor: i === 1 ? '#FFE0C4' : '#EEF2F7' }}
            />
            <span className="h-1 flex-1 rounded-full bg-black/[0.06]" />
            <span className="h-1 w-5 rounded-full" style={{ backgroundColor: ARDOISE, opacity: 0.35 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniConcurrentiel() {
  return (
    <div className="flex h-full flex-col bg-white">
      <Entete titre="En vente" />
      <div className="mt-2 flex flex-col gap-1.5 px-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-1.5 rounded-[3px] bg-black/[0.03] p-1">
            <span className="size-6 rounded-[2px]" style={{ backgroundColor: '#E4E8EE' }} />
            <span className="flex flex-1 flex-col justify-center gap-0.5">
              <span className="h-1 w-10 rounded-full bg-black/[0.1]" />
              <span className="h-1 w-6 rounded-full bg-black/[0.06]" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniEstimation() {
  return (
    <div className="flex h-full flex-col bg-white">
      <Entete titre="Estimation" />
      <div className="mx-2 mt-3 flex flex-1 flex-col items-center justify-center rounded-[4px] pb-4" style={{ backgroundColor: CREME }}>
        <p className="font-display text-[16px] font-bold tabular-nums" style={{ color: ACCENT }}>
          412 000 €
        </p>
        <p className="mt-0.5 text-[6.5px] text-mute">fourchette ± 6 %</p>
        <div className="mt-2 h-1 w-16 overflow-hidden rounded-full bg-black/[0.08]">
          <span className="block h-full w-2/3 rounded-full" style={{ backgroundColor: ACCENT }} />
        </div>
      </div>
    </div>
  );
}

function MiniCta() {
  return (
    <div className="flex h-full flex-col bg-white">
      <Entete titre="Ensuite" />
      <div className="mx-2 mt-3 flex-1 rounded-[4px] p-2" style={{ backgroundColor: ARDOISE }}>
        <p className="text-[6.5px] leading-snug text-white/90">Signature du mandat</p>
      </div>
    </div>
  );
}

function MiniLibre({ titre }: { titre: string }) {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: PAPIER }}>
      <Entete titre={titre} />
      <div className="mt-2 flex flex-col gap-1 px-2">
        <span className="h-1.5 w-16 rounded-full bg-black/[0.08]" />
        <span className="h-1 w-full rounded-full bg-black/[0.05]" />
        <span className="h-1 w-5/6 rounded-full bg-black/[0.05]" />
        <span className="h-1 w-2/3 rounded-full bg-black/[0.05]" />
      </div>
    </div>
  );
}
