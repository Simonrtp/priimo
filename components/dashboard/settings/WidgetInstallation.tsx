'use client';

import { useState } from 'react';
import { Check, Code2, Copy, ExternalLink, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  PLATEFORME_GROUPES,
  PLATEFORMES,
  type PlateformeInstall,
} from '@/lib/widget/snippet';
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

function LogoPlateforme({ plateforme }: { plateforme: PlateformeInstall }) {
  if (plateforme.logoSrc) {
    const scale = plateforme.logoScale ?? 'md';
    return (
      <span
        className={`relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ${plateforme.logoClass}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- logos locaux, pas d’optimisation nécessaire */}
        <img
          src={plateforme.logoSrc}
          alt=""
          width={40}
          height={40}
          className={
            scale === 'sm' ? 'size-[22px] object-contain' : 'size-[30px] object-contain'
          }
          decoding="async"
        />
      </span>
    );
  }

  if (plateforme.mark) {
    return (
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold tracking-tight text-white ${plateforme.logoClass}`}
        aria-hidden
      >
        {plateforme.mark}
      </span>
    );
  }

  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${plateforme.logoClass}`}
      aria-hidden
    >
      <Code2 className="size-5 text-white" strokeWidth={2} />
    </span>
  );
}

function BoutonPlateforme({
  plateforme,
  actif,
  onSelect,
}: {
  plateforme: PlateformeInstall;
  actif: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={actif}
      onClick={onSelect}
      className={`flex min-h-[52px] items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
        actif
          ? 'border-accent bg-accent/[0.06] shadow-clay-sm'
          : 'border-black/10 bg-white hover:bg-black/[0.02]'
      }`}
    >
      <LogoPlateforme plateforme={plateforme} />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold leading-tight text-ink">
          {plateforme.nom}
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-text-muted">
          {plateforme.ouColler}
        </span>
      </span>
    </button>
  );
}

function GuidePlateforme({ plateforme }: { plateforme: PlateformeInstall }) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white p-4">
      <div className="flex items-start gap-3">
        <LogoPlateforme plateforme={plateforme} />
        <div className="min-w-0">
          <h4 className="text-balance text-[15px] font-semibold text-ink">
            Installer sur {plateforme.nom}
          </h4>
          <p className="mt-0.5 text-[12.5px] font-medium text-accent-dark">
            {plateforme.ouColler}
          </p>
          <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-text-muted">
            {plateforme.intro}
          </p>
        </div>
      </div>

      <ol className="mt-4 flex flex-col gap-2.5 border-t border-black/[0.06] pt-4">
        {plateforme.etapes.map((etape, i) => (
          <li key={etape} className="flex gap-3 text-[13.5px] leading-snug text-ink">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[12px] font-semibold tabular-nums text-accent-dark"
              aria-hidden
            >
              {i + 1}
            </span>
            <span className="pt-0.5 text-pretty">{etape}</span>
          </li>
        ))}
      </ol>

      {plateforme.notes && plateforme.notes.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2 rounded-lg bg-black/[0.03] px-3 py-2.5">
          {plateforme.notes.map((note) => (
            <li
              key={note}
              className="flex gap-2 text-[12.5px] leading-relaxed text-text-muted"
            >
              <Check size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <span className="text-pretty">{note}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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
  const [plateformeId, setPlateformeId] = useState<string | null>(null);

  const plateformeActive = PLATEFORMES.find((p) => p.id === plateformeId) ?? null;

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
          sous="Choisissez votre plateforme"
        />
      </div>

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

      {voie === 'moi' ? (
        <div className="mt-4">
          <p className="text-[13px] leading-relaxed text-ink">
            Copiez le code, puis choisissez la plateforme de votre site pour le guide pas à pas.
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

          <p className="mt-5 text-[13px] font-medium text-gray-700">
            Sur quelle plateforme est votre site ?
          </p>

          <div className="mt-3 flex flex-col gap-4">
            {PLATEFORME_GROUPES.map((groupe) => {
              const items = PLATEFORMES.filter((p) => p.groupe === groupe.id);
              return (
                <div key={groupe.id}>
                  <div className="mb-2">
                    <p className="text-[12.5px] font-semibold text-text-muted">
                      {groupe.titre}
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-subtle">{groupe.sous}</p>
                  </div>
                  <div
                    className={
                      items.length === 1
                        ? 'grid grid-cols-1 gap-2 sm:max-w-sm'
                        : 'grid grid-cols-1 gap-2 sm:grid-cols-3'
                    }
                    role="listbox"
                    aria-label={groupe.titre}
                  >
                    {items.map((plateforme) => (
                      <BoutonPlateforme
                        key={plateforme.id}
                        plateforme={plateforme}
                        actif={plateformeId === plateforme.id}
                        onSelect={() =>
                          setPlateformeId((prev) =>
                            prev === plateforme.id ? null : plateforme.id,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {plateformeActive ? (
            <div className="mt-3">
              <GuidePlateforme plateforme={plateformeActive} />
            </div>
          ) : (
            <p className="mt-3 text-[12.5px] text-text-muted">
              Sélectionnez une plateforme pour afficher le guide d’installation détaillé.
            </p>
          )}

          <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-text-muted">
            <Check size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            Dès que la page sera en ligne, cette section indiquera que le formulaire s’est chargé.
          </p>
        </div>
      ) : null}
    </div>
  );
}
