import Link from "next/link";

// === CTA BUTTON ===
// Centralised CTA. Every CTA on the landing page links to `/signup`.

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
  href = "/signup",
}: Props) {
  const variantClass =
    variant === "invert"
      ? "btn-invert"
      : variant === "ghost"
      ? "btn-ghost"
      : "btn-primary";
  const sizeClass = size === "lg" ? "px-7 py-4 text-base" : "";

  return (
    <Link
      href={href}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
    >
      {children}
    </Link>
  );
}
