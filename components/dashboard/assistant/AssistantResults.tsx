'use client';

import Link from 'next/link';
import { CardEyebrow } from '@/components/dashboard/workspace/WorkspaceCard';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import type { AssistantSource } from '@/lib/assistant/collecte';

export type AssistantRepondrePayload = {
  reponse: string;
  sources: AssistantSource[];
  vide: boolean;
  inconnu: boolean;
  adresse: string | null;
  rechercheParTexte: boolean;
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(d);
}

export default function AssistantResults({
  loading,
  result,
  onClose,
}: {
  loading: boolean;
  result: AssistantRepondrePayload | null;
  onClose?: () => void;
}) {
  const { openCapture } = useVoiceCapture();

  if (loading) {
    return (
      <div className="flex justify-center px-4 py-4" role="status" aria-label="Recherche en cours">
        <span
          className="size-5 rounded-full border-2 border-black/10 border-t-[#E8743C] motion-safe:animate-spin"
          aria-hidden
        />
      </div>
    );
  }

  if (!result) return null;

  const startVoice = () => {
    onClose?.();
    openCapture();
  };

  return (
    <div className="px-4 py-3">
      <p className="text-pretty text-[14px] text-text" style={{ lineHeight: 1.55 }}>
        {result.reponse}
      </p>
      {result.rechercheParTexte ? (
        <p className="mt-2 text-[12.5px] text-mute">
          Recherche effectuée sur le texte de l&apos;adresse, pas sur l&apos;identifiant d&apos;immeuble.
        </p>
      ) : null}

      {result.vide && result.adresse ? (
        <div className="mt-3">
          <WorkspaceButton type="button" onClick={startVoice}>
            Créer une note vocale ici
          </WorkspaceButton>
        </div>
      ) : null}

      {result.sources.length > 0 ? (
        <div className="mt-4 border-t border-black/[0.06] pt-3">
          <CardEyebrow>Sources</CardEyebrow>
          <ul className="mt-2 flex max-h-[min(40vh,16rem)] flex-col gap-1.5 overflow-y-auto">
            {result.sources.map((s) => {
              const date = formatDate(s.date);
              const meta = [s.typeLabel, date, s.auteur].filter(Boolean).join(' · ');
              const inner = (
                <>
                  <span className="block truncate font-medium text-ink">{s.titre}</span>
                  <span className="block text-[12px] text-mute">{meta}</span>
                </>
              );
              return (
                <li key={`${s.kind}-${s.id}`}>
                  {s.href ? (
                    <Link
                      href={s.href}
                      onClick={onClose}
                      className="block rounded-xl border border-black/[0.06] bg-surface px-3 py-2 transition-colors hover:bg-black/[0.03]"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="rounded-xl border border-black/[0.06] bg-surface px-3 py-2">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
