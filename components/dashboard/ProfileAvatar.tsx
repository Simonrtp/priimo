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
  className = '',
}: {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const a = firstName.trim().charAt(0).toUpperCase();
  const b = lastName.trim().charAt(0).toUpperCase();
  const initials = `${a}${b}` || '?';

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-black/[0.08] font-semibold text-ink ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
