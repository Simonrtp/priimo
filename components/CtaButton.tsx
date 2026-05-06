"use client";

import { useBetaModal } from "./BetaModalContext";

// === CTA BUTTON ===
// Centralised CTA. Every secondary CTA on the page opens the BetaModal —
// the only exception is the header link, which scrolls to the inline form.

type Props = {
  children: React.ReactNode;
  variant?: "primary" | "invert" | "ghost";
  size?: "md" | "lg";
  className?: string;
};

export default function CtaButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
}: Props) {
  const { open } = useBetaModal();
  const variantClass =
    variant === "invert"
      ? "btn-invert"
      : variant === "ghost"
      ? "btn-ghost"
      : "btn-primary";
  const sizeClass = size === "lg" ? "px-7 py-4 text-base" : "";

  return (
    <button
      type="button"
      onClick={open}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
    >
      {children}
    </button>
  );
}
