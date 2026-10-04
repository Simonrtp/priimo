import Link from "next/link";
import { CALENDLY_URL } from "@/lib/calendly";
import CtaSparkles from "./CtaSparkles";

// === CTA BUTTON ===
// CTA centralisé marketing. Étoiles sur chaque instance.
// Lien interne → Next Link ; sinon Calendly (nouvel onglet).

type Props = {
  children: React.ReactNode;
  variant?: "primary" | "invert" | "ghost";
  size?: "md" | "lg";
  className?: string;
  href?: string;
};

function isInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

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
  const btnClass = `btn ${variantClass} ${sizeClass} ${className}`.trim();

  return (
    <span className="cta-spark-host">
      <span className="cta-cq">
        <CtaSparkles />
      </span>
      {isInternalHref(href) ? (
        <Link href={href} className={btnClass}>
          {children}
        </Link>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={btnClass}
        >
          {children}
        </a>
      )}
    </span>
  );
}
