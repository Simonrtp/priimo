type CapsuleGlyphKind = "bolt" | "ticket" | "chat";

/** Silhouettes pleines — pas de trait fin, intérieur blanc via currentColor. */
export default function CapsuleGlyph({
  kind,
  className,
}: {
  kind: CapsuleGlyphKind;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      fill="currentColor"
    >
      {kind === "chat" ? (
        <path d="M5.2 3.2h13.6A3.3 3.3 0 0 1 22 6.5v7.4a3.3 3.3 0 0 1-3.2 3.3h-5.15l-4.55 3.7c-.62.5-1.55.06-1.55-.72v-2.98H5.2A3.3 3.3 0 0 1 2 13.9V6.5A3.3 3.3 0 0 1 5.2 3.2z" />
      ) : kind === "ticket" ? (
        <path d="M4.4 5.2h15.2A2.7 2.7 0 0 1 22.3 7.9v1.35a2.05 2.05 0 1 0 0 3.5V16.1a2.7 2.7 0 0 1-2.7 2.7H4.4A2.7 2.7 0 0 1 1.7 16.1v-3.35a2.05 2.05 0 1 0 0-3.5V7.9A2.7 2.7 0 0 1 4.4 5.2z" />
      ) : (
        <path d="M13.9 1.4 4.2 14.2h7.15L8.7 22.6 20.3 9.3h-7.3L13.9 1.4z" />
      )}
    </svg>
  );
}
