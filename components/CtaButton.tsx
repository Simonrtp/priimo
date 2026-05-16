import { CALENDLY_URL } from "@/lib/calendly";

// === CTA BUTTON ===
// CTA centralisé. Tous les CTA de la landing pointent vers Calendly
// (réservation de démo). Ouvre dans un nouvel onglet.

type Props = {
  children: React.ReactNode;
  variant?: "primary" | "invert" | "ghost";
  size?: "md" | "lg";
  className?: string;
  href?: string;
};

export default function CtaButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  href = CALENDLY_URL,
}: Props) {
  const variantClass =
    variant === "invert"
      ? "btn-invert"
      : variant === "ghost"
      ? "btn-ghost"
      : "btn-primary";
  const sizeClass = size === "lg" ? "px-7 py-4 text-base" : "";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn ${variantClass} ${sizeClass} ${className}`}
    >
      {children}
    </a>
  );
}
