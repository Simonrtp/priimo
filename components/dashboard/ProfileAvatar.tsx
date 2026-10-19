'use client';

/**
 * Avatar agent — photo / illustration, sinon initiales.
 * Remplace les pastilles initiales partout (TopBar, équipes…).
 */
export default function ProfileAvatar({
  firstName,
  lastName,
  avatarUrl,
  size = 36,
  fond,
  className = '',
}: {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  size?: number;
  /** Fond derrière une illustration. Une photo reste pleine. */
  fond?: string;
  className?: string;
}) {
  const a = firstName.trim().charAt(0).toUpperCase();
  const b = lastName.trim().charAt(0).toUpperCase();
  const initials = `${a}${b}` || '?';

  if (avatarUrl) {
    const icone = avatarUrl.startsWith('/avatars/');
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className={`rounded-full ${icone ? 'object-contain' : 'object-cover'} ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: icone ? (fond ?? 'rgba(26, 42, 86, 0.05)') : undefined,
          padding: icone ? Math.max(3, Math.round(size * 0.08)) : undefined,
        }}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold text-ink ${fond ? '' : 'bg-black/[0.08]'} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.32),
        backgroundColor: fond,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
