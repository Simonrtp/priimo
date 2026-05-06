"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// === BETA MODAL CONTEXT ===
// Lets any CTA in the page open the inscription modal (except the inline
// hero form, which is always rendered). A single source of truth.

type BetaModalContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const BetaModalContext = createContext<BetaModalContextValue | null>(null);

export function BetaModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return (
    <BetaModalContext.Provider value={value}>
      {children}
    </BetaModalContext.Provider>
  );
}

export function useBetaModal() {
  const ctx = useContext(BetaModalContext);
  if (!ctx) {
    throw new Error("useBetaModal must be used within a BetaModalProvider");
  }
  return ctx;
}
