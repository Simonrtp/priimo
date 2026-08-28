'use client';

import { useState } from 'react';
import { Check, ChevronDown, Code2, Copy, ExternalLink, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { PLATEFORMES } from '@/lib/widget/snippet';
import { phraseDepuis } from '@/lib/widget/install-state';

/**
 * Deux façons d'installer le formulaire, présentées comme un choix explicite.
 *
 * La plupart des agences n'éditent pas leur site : elles ont un prestataire,
 * une agence web ou l'éditeur d'un logiciel métier. Pour elles, la bonne action
 * n'est pas « copier le code » mais « faire suivre à la bonne personne ».
 * Les directeurs à l'aise avec le HTML, eux, veulent le code tout de suite —
 * les deux chemins sont donc au même niveau, aucun n'est un repli de l'autre.
 */

type Voie = 'prestataire' | 'moi';

const inputClass =
  'w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

function Onglet({
  actif,
  onClick,
  Icone,
  titre,
  sous,
}: {
  actif: boolean;
  onClick: () => void;
  Icone: typeof Mail;
  titre: string;
  sous: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`flex flex-1 items-start gap-3 rounded-clay border p-3.5 text-left transition ${
        actif
          ? 'border-accent bg-accent/[0.06] shadow-clay-sm'
          : 'border-black/10 bg-white hover:bg-black/[0.02]'
      }`}
    >
      <Icone
        className={`mt-0.5 size-5 shrink-0 ${actif ? 'text-accent' : 'text-text-subtle'}`}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-ink">{titre}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-text-muted">{sous}</span>
      </span>
    </button>
  );
}

export default function WidgetInstallation({
  snippet,
  pageUrl,
  allowedDomains,
  installEmailTo,
  installEmailSentAt,
  isDirector,
  onEmailSent,
}: {
  snippet: string;
  pageUrl: string;
  allowedDomains: readonly string[];
  installEmailTo: string | null;
  installEmailSentAt: string | null;
  isDirector: boolean;
  onEmailSent: (to: string, sentAt: string) => void;
}) {
  // Le directeur qui a déjà envoyé le code retrouve son onglet ; les autres
  // tombent sur la voie qui concerne la majorité.
  const [voie, setVoie] = useState<Voie>('prestataire');
  const [destinataire, setDestinataire] = useState(installEmailTo ?? '');
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [plateformeOuverte, setPlateformeOuverte] = useState<string | null>(PLATEFORMES[0]!.id);

  const envoyer = async () => {
    if (!destinataire.trim()) return;
    setEnvoi(true);
    try {
      const res = await fetch('/api/dashboard/widget/install-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: destinataire.trim(), message: message.trim() || null }),
      });
      const data = (await res.json()) as { sentTo?: string; sentAt?: string; error?: string };
      if (!res.ok || !data.sentTo || !data.sentAt) {
        toast.error(data.error ?? 'L’email n’a pas pu être envoyé');
        return;
      }
      toast.success(`Code envoyé à ${data.sentTo}`);
      setMessage('');
      onEmailSent(data.sentTo, data.sentAt);
    } catch {
      toast.error('L’email n’a pas pu être envoyé');
    } finally {
      setEnvoi(false);
    }
  };

  const dejaEnvoye = phraseDepuis(installEmailSentAt);

  return (
    <div className="rounded-clay border border-black/[0.06] bg-surface p-4 shadow-clay-sm">
      <h3 className="font-semibold text-text-strong" style={{ fontSize: 15 }}>
        Installer le formulaire sur votre site
      </h3>
      <p className="mt-1 text-[13px] text-text-muted">
        Deux lignes de code, à poser une fois. Choisissez qui s’en charge.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Onglet
          actif={voie === 'prestataire'}
          onClick={() => setVoie('prestataire')}
          Icone={Mail}
          titre="Confier à mon prestataire"
          sous="On lui envoie le code et les consignes"
        />
        <Onglet
          actif={voie === 'moi'}
          onClick={() => setVoie('moi')}
          Icone={Code2}
          titre="Je m’en occupe"
          sous="Le code, et où le coller"
        />
      </div>

      {/* --------------------------- voie prestataire --------------------------- */}
      {voie === 'prestataire' ? (
        <div className="mt-4">
          <p className="text-[13px] leading-relaxed text-ink">
            Nous envoyons à votre webmaster le code, les consignes de collage pour son outil et
            l’adresse d’aperçu. Il pourra répondre directement à cet email — il vous parviendra.
          </p>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Email de la personne qui gère le site
            </span>
            <input
              type="email"
              value={destinataire}
              onChange={(e) => setDestinataire(e.target.value)}
              placeholder="webmaster@mon-prestataire.fr"
              disabled={!isDirector}
              className={inputClass}
              autoComplete="off"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Mot d’accompagnement (facultatif)
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={800}
              disabled={!isDirector}
              placeholder="Ex. À placer sur la page « Estimer mon bien », sous le titre."
              className={`${inputClass} resize-y`}
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!isDirector || envoi || !destinataire.trim()}
              onClick={() => void envoyer()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-accent-dark disabled:opacity-50"
            >
              <Send size={15} aria-hidden />
              {envoi ? 'Envoi…' : 'Envoyer le code'}
            </button>
            {dejaEnvoye && installEmailTo ? (
              <p className="text-[12.5px] text-text-muted">
                Déjà envoyé à <span className="font-medium text-ink">{installEmailTo}</span>,{' '}
                {dejaEnvoye}.
              </p>
            ) : null}
          </div>

          {allowedDomains.length === 0 ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900">
              Aucun domaine n’est encore autorisé. L’email le signalera à votre prestataire, mais
              le formulaire ne s’affichera nulle part tant que l’adresse du site n’est pas
              déclarée plus bas.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------- voie moi ------------------------------- */}
      {voie === 'moi' ? (
        <div className="mt-4">
          <p className="text-[13px] leading-relaxed text-ink">
            Collez ces deux lignes à l’endroit exact où le formulaire doit apparaître. Aucune
            bibliothèque à charger, aucune dépendance à gérer : le script crée un cadre qui
            s’adapte tout seul à la largeur de la page et à sa hauteur.
          </p>

          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/[0.04] p-3 text-[12.5px] leading-relaxed text-ink">
            <code>{snippet}</code>
          </pre>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(snippet).then(() => toast.success('Code copié'));
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-accent-dark"
            >
              <Copy size={15} aria-hidden />
              Copier le code
            </button>
            <a
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.03]"
            >
              <ExternalLink size={14} aria-hidden />
              Voir le rendu
            </a>
          </div>

          <p className="mt-4 text-[13px] font-medium text-gray-700">Où le coller</p>
          <ul className="mt-2 overflow-hidden rounded-lg border border-black/[0.08]">
            {PLATEFORMES.map((plateforme) => {
              const ouverte = plateformeOuverte === plateforme.id;
              return (
                <li key={plateforme.id} className="border-b border-black/[0.06] last:border-0">
                  <button
                    type="button"
                    onClick={() => setPlateformeOuverte(ouverte ? null : plateforme.id)}
                    aria-expanded={ouverte}
                    className="flex w-full items-center justify-between gap-3 bg-white px-3.5 py-2.5 text-left hover:bg-black/[0.02]"
                  >
                    <span className="text-[13.5px] font-medium text-ink">{plateforme.nom}</span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-text-muted transition-transform ${ouverte ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {ouverte ? (
                    <ol className="bg-black/[0.015] px-3.5 pb-3 pt-1">
                      {plateforme.etapes.map((etape, i) => (
                        <li
                          key={etape}
                          className="flex gap-2.5 py-1 text-[13px] leading-snug text-text-muted"
                        >
                          <span className="w-4 shrink-0 tabular-nums text-text-subtle">
                            {i + 1}.
                          </span>
                          <span>{etape}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-text-muted">
            <Check size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            Dès que la page sera en ligne, cette section indiquera que le formulaire s’est chargé.
          </p>
        </div>
      ) : null}
    </div>
  );
}
