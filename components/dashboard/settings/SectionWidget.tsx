'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/hooks/useUser';
import { normalizeDomain } from '@/lib/widget/domains';

/**
 * Widget d'estimation — le code à coller sur le site de l'agence.
 *
 * C'est le seul mécanisme qui produit un numéro de particulier appelable
 * depuis l'interdiction du démarchage : la page l'explique, et n'active rien
 * tant qu'un domaine n'a pas été autorisé.
 */

type WidgetSettings = {
  publicId: string;
  enabled: boolean;
  displayName: string;
  accentColor: string;
  logoUrl: string | null;
  allowedDomains: string[];
  dailyCap: number;
  scriptUrl: string;
  pageUrl: string;
};

const inputClass =
  'w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

function integrationSnippet(s: WidgetSettings): string {
  return `<div id="priimo-estimation"></div>\n<script src="${s.scriptUrl}"\n        data-agency="${s.publicId}"></script>`;
}

export default function SectionWidget() {
  const { isDirector } = useUser();
  const [settings, setSettings] = useState<WidgetSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [nouveauDomaine, setNouveauDomaine] = useState('');
  const [apercuCle, setApercuCle] = useState(0);

  const charger = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/widget');
      if (!res.ok) return;
      setSettings((await res.json()) as WidgetSettings);
    } catch {
      /* réessai au prochain affichage */
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const enregistrer = useCallback(
    async (patch: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch('/api/dashboard/widget', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const data = (await res.json()) as WidgetSettings & { error?: string };
        if (!res.ok) {
          toast.error(data.error ?? 'Enregistrement impossible');
          return false;
        }
        setSettings(data);
        setApercuCle((k) => k + 1);
        return true;
      } catch {
        toast.error('Enregistrement impossible');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const snippet = useMemo(() => (settings ? integrationSnippet(settings) : ''), [settings]);

  if (!settings) {
    return (
      <section>
        <p className="text-[13px] text-text-muted">Chargement de la configuration…</p>
      </section>
    );
  }

  const ajouterDomaine = async () => {
    const domaine = normalizeDomain(nouveauDomaine);
    if (!domaine) {
      toast.error('Domaine invalide');
      return;
    }
    if (settings.allowedDomains.includes(domaine)) {
      setNouveauDomaine('');
      return;
    }
    const ok = await enregistrer({ allowedDomains: [...settings.allowedDomains, domaine] });
    if (ok) setNouveauDomaine('');
  };

  return (
    <section>
      <h2 className="mb-2 hidden font-semibold text-ink md:block" style={{ fontSize: 18 }}>
        Widget d’estimation
      </h2>
      <p className="mb-5 max-w-2xl text-pretty text-mute" style={{ fontSize: 14 }}>
        Deux lignes à coller sur votre site : le visiteur estime son bien, donne son accord
        explicite pour être rappelé, et la demande arrive dans Priimo avec sa preuve de
        consentement. Depuis l’interdiction du démarchage du 11 août, c’est la voie qui rend un
        numéro de particulier appelable.
      </p>

      <div className="flex max-w-2xl flex-col gap-4">
        {/* ------------------------------ activation ------------------------------ */}
        <div className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-semibold text-text-strong" style={{ fontSize: 15 }}>
                {settings.enabled ? 'Widget actif' : 'Widget désactivé'}
              </h3>
              <p className="mt-1 text-[13px] text-text-muted">
                {settings.enabled
                  ? 'Le formulaire répond sur les domaines autorisés ci-dessous.'
                  : 'Aucune demande n’est acceptée tant que le widget est coupé.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              aria-label={settings.enabled ? 'Couper le widget' : 'Activer le widget'}
              disabled={!isDirector || busy}
              onClick={() => void enregistrer({ enabled: !settings.enabled })}
              className="relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50"
              style={{ backgroundColor: settings.enabled ? '#0F7A4F' : 'rgba(0,0,0,0.18)' }}
            >
              <span
                className="absolute top-1 size-5 rounded-full bg-white transition-all"
                style={{ left: settings.enabled ? 26 : 4 }}
              />
            </button>
          </div>
        </div>

        {/* --------------------------- code d'intégration -------------------------- */}
        <div className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
          <h3 className="font-semibold text-text-strong" style={{ fontSize: 15 }}>
            Code d’intégration
          </h3>
          <p className="mt-1 text-[13px] text-text-muted">
            Le même code fonctionne sur Webflow, WordPress, Wix, Netty ou un site fait main.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/[0.04] p-3 text-[12.5px] leading-relaxed text-ink">
            <code>{snippet}</code>
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(snippet)
                  .then(() => toast.success('Code copié'));
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03]"
            >
              <Copy size={14} aria-hidden />
              Copier le code
            </button>
            <a
              href={settings.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03]"
            >
              <ExternalLink size={14} aria-hidden />
              Ouvrir en page complète
            </a>
          </div>
          <p className="mt-2 text-[12.5px] text-text-subtle">
            Lien direct, pour les agences qui préfèrent un bouton plutôt qu’un encart&nbsp;:{' '}
            <span className="break-all font-medium text-ink">{settings.pageUrl}</span>
          </p>
        </div>

        {/* ------------------------------- apparence ------------------------------- */}
        <div className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
          <h3 className="font-semibold text-text-strong" style={{ fontSize: 15 }}>
            Apparence
          </h3>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-[13px] font-medium text-gray-700">Nom affiché</span>
            <input
              defaultValue={settings.displayName}
              disabled={!isDirector}
              onBlur={(e) => {
                if (e.target.value.trim() !== settings.displayName) {
                  void enregistrer({ displayName: e.target.value });
                }
              }}
              className={inputClass}
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Couleur d’accent
            </span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.accentColor}
                disabled={!isDirector}
                onChange={(e) => void enregistrer({ accentColor: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-lg border border-black/10 bg-white p-1"
                aria-label="Couleur d’accent du widget"
              />
              <span className="tabular-nums text-[13px] text-text-muted">
                {settings.accentColor}
              </span>
            </div>
          </label>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Logo (adresse https)
            </span>
            <input
              defaultValue={settings.logoUrl ?? ''}
              disabled={!isDirector}
              placeholder="https://www.mon-agence.fr/logo.png"
              onBlur={(e) => {
                if (e.target.value.trim() !== (settings.logoUrl ?? '')) {
                  void enregistrer({ logoUrl: e.target.value });
                }
              }}
              className={inputClass}
            />
          </label>
        </div>

        {/* -------------------------------- aperçu -------------------------------- */}
        <div className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
          <h3 className="font-semibold text-text-strong" style={{ fontSize: 15 }}>
            Aperçu en direct
          </h3>
          <p className="mt-1 text-[13px] text-text-muted">
            Exactement ce que verra un propriétaire sur votre site.
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-black/10 bg-white">
            <iframe
              key={apercuCle}
              src={settings.pageUrl}
              title="Aperçu du widget d’estimation"
              className="h-[620px] w-full"
            />
          </div>
        </div>

        {/* --------------------------- domaines autorisés -------------------------- */}
        <div className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
          <h3 className="font-semibold text-text-strong" style={{ fontSize: 15 }}>
            Domaines autorisés
          </h3>
          <p className="mt-1 text-[13px] text-text-muted">
            Le serveur refuse toute demande venue d’un autre domaine. Sans cette liste, n’importe
            quel site pourrait embarquer votre formulaire. Les sous-domaines sont couverts&nbsp;:
            « mon-agence.fr » autorise aussi « www.mon-agence.fr ».
          </p>

          {settings.allowedDomains.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {settings.allowedDomains.map((domaine) => (
                <li
                  key={domaine}
                  className="inline-flex items-center gap-2 rounded-full bg-black/[0.05] px-3 py-1.5 text-[13px] text-ink"
                >
                  {domaine}
                  {isDirector ? (
                    <button
                      type="button"
                      aria-label={`Retirer ${domaine}`}
                      disabled={busy}
                      onClick={() =>
                        void enregistrer({
                          allowedDomains: settings.allowedDomains.filter((d) => d !== domaine),
                          // Retirer le dernier domaine coupe le widget : il ne
                          // servirait plus nulle part.
                          ...(settings.allowedDomains.length === 1 ? { enabled: false } : {}),
                        })
                      }
                      className="text-text-muted hover:text-ink"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
              Aucun domaine autorisé : le widget ne peut pas encore être activé.
            </p>
          )}

          {isDirector ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={nouveauDomaine}
                onChange={(e) => setNouveauDomaine(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void ajouterDomaine();
                  }
                }}
                placeholder="mon-agence.fr"
                className={`${inputClass} max-w-xs flex-1`}
                aria-label="Nouveau domaine autorisé"
              />
              <button
                type="button"
                disabled={busy || !nouveauDomaine.trim()}
                onClick={() => void ajouterDomaine()}
                className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03] disabled:opacity-50"
              >
                <Check size={14} aria-hidden />
                Ajouter
              </button>
            </div>
          ) : null}
        </div>

        {/* --------------------------------- garde-fou ----------------------------- */}
        <div className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
          <h3 className="font-semibold text-text-strong" style={{ fontSize: 15 }}>
            Plafond quotidien
          </h3>
          <p className="mt-1 text-[13px] text-text-muted">
            Au-delà de ce nombre d’estimations abouties dans une même journée, le formulaire
            répond qu’il est indisponible. Un garde-fou, pas une limite commerciale.
          </p>
          <label className="mt-3 block max-w-[160px]">
            <input
              type="number"
              min={1}
              max={5000}
              defaultValue={settings.dailyCap}
              disabled={!isDirector}
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (value !== settings.dailyCap) void enregistrer({ dailyCap: value });
              }}
              className={`${inputClass} tabular-nums`}
              aria-label="Plafond quotidien d’estimations"
            />
          </label>
        </div>

        {!isDirector ? (
          <p className="text-[12.5px] text-text-subtle">
            La configuration du widget est réservée au directeur de l’agence.
          </p>
        ) : null}
      </div>
    </section>
  );
}
