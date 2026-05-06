"use client";

import { useState } from "react";

// === BETA FORM ===
// Self-contained inscription form. Used inline in the hero AND inside the
// modal — same component, identical behaviour. POSTs to `/api/beta`,
// shows an inline success state on 200, and a non-blocking error on 4xx/5xx.

type FormState = {
  prenom: string;
  email: string;
  telephone: string;
  nomAgence: string;
};

type Errors = Partial<Record<keyof FormState, string>>;

type ApiError = {
  error?: string;
  fields?: Errors;
};

type Props = {
  /**
   * Visual variant. `light` is the default for white surfaces; `inverse` is
   * tuned for dark surfaces (currently unused but ready for future blocks).
   */
  variant?: "light" | "inverse";
  /** Optional id used as the scroll anchor target. */
  id?: string;
  /** Optional callback after a successful submission. */
  onSuccess?: () => void;
  /** Show/hide the small reassurance copy under the submit button. */
  showMicrocopy?: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+33|0)[1-9](\d{2}){4}$/;

export default function BetaForm({
  variant = "light",
  id,
  onSuccess,
  showMicrocopy = true,
}: Props) {
  const [form, setForm] = useState<FormState>({
    prenom: "",
    email: "",
    telephone: "",
    nomAgence: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<keyof FormState, boolean>>({
    prenom: false,
    email: false,
    telephone: false,
    nomAgence: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ prenom: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // === VALIDATION ===
  const validateField = (name: keyof FormState, value: string): string | undefined => {
    if (name === "prenom") {
      if (!value.trim()) return "Votre prénom est requis.";
      if (value.trim().length < 2) return "Prénom trop court.";
      return undefined;
    }
    if (name === "email") {
      if (!value.trim()) return "Votre email est requis.";
      if (!EMAIL_REGEX.test(value.trim())) return "Format d'email invalide.";
      return undefined;
    }
    if (name === "telephone") {
      if (!value.trim()) return "Votre numéro de téléphone est requis.";
      const normalized = value.replace(/\s+/g, "");
      if (!PHONE_REGEX.test(normalized)) {
        return "Format invalide (ex: 06 12 34 56 78).";
      }
      return undefined;
    }
    if (name === "nomAgence") {
      if (!value.trim()) return "Le nom de l'agence est requis.";
      if (value.trim().length < 2) return "Nom d'agence trop court.";
      return undefined;
    }
    return undefined;
  };

  const validateAll = (): Errors => {
    return {
      prenom: validateField("prenom", form.prenom),
      email: validateField("email", form.email),
      telephone: validateField("telephone", form.telephone),
      nomAgence: validateField("nomAgence", form.nomAgence),
    };
  };

  // === HANDLERS ===
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Re-validate live only if field has already been touched (avoid noise)
    if (touched[name as keyof FormState]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateField(name as keyof FormState, value),
      }));
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateField(name as keyof FormState, value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const allErrors = validateAll();
    setErrors(allErrors);
    setTouched({ prenom: true, email: true, telephone: true, nomAgence: true });

    const hasError = Object.values(allErrors).some(Boolean);
    if (hasError) return;

    const payload: FormState = {
      prenom: form.prenom.trim(),
      email: form.email.trim(),
      telephone: form.telephone.replace(/\s+/g, ""),
      nomAgence: form.nomAgence.trim(),
    };

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/beta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Try to surface field-level errors returned by the API; otherwise
        // show a single generic error message.
        let data: ApiError = {};
        try {
          data = (await res.json()) as ApiError;
        } catch {
          /* ignore body parsing failures */
        }
        if (data.fields) setErrors(data.fields);
        setSubmitError(
          data.error ?? "Impossible d'envoyer votre inscription. Réessayez dans un instant."
        );
        return;
      }

      setSuccess({ prenom: payload.prenom });
      onSuccess?.();
    } catch {
      // Network failure / offline / aborted request.
      setSubmitError(
        "Connexion impossible. Vérifiez votre réseau et réessayez."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // === SUCCESS STATE ===
  if (success) {
    return (
      <div
        id={id}
        className="rounded-2xl border border-accent/20 bg-soft-warm p-6 sm:p-7 animate-fadeIn"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="font-display text-xl text-accent-dark font-semibold">
              Vous êtes sur la liste, {success.prenom}.
            </p>
            <p className="mt-1 text-sm text-mute">
              On vous contacte très vite avec votre accès bêta.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // === FORM ===
  const baseLabel =
    variant === "inverse" ? "text-white/90" : "text-ink";
  const baseHelp =
    variant === "inverse" ? "text-white/70" : "text-mute";
  const baseInput =
    variant === "inverse"
      ? "bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-white"
      : "bg-white border-black/10 text-ink placeholder-mute/70 focus:border-accent";

  // Single suffix shared by every input/label/error so we can never end up
  // with a mismatched aria-describedby (e.g. when `id` is undefined).
  const fid = id ?? "default";

  return (
    <form
      id={id}
      onSubmit={handleSubmit}
      noValidate
      className={`rounded-2xl ${
        variant === "inverse"
          ? "bg-white/5 backdrop-blur-sm border border-white/15"
          : "bg-white border border-black/5 shadow-soft"
      } p-5 sm:p-6 space-y-4`}
    >
      {/* Prénom */}
      <div>
        <label htmlFor={`prenom-${fid}`} className={`block text-sm font-medium mb-1.5 ${baseLabel}`}>
          Prénom <span className="text-accent">*</span>
        </label>
        <input
          id={`prenom-${fid}`}
          name="prenom"
          type="text"
          autoComplete="given-name"
          value={form.prenom}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!errors.prenom}
          aria-describedby={errors.prenom ? `prenom-error-${fid}` : undefined}
          placeholder="Marie"
          className={`w-full rounded-xl border ${baseInput} px-4 py-3 text-base outline-none transition focus:ring-2 focus:ring-accent/15`}
        />
        {errors.prenom && (
          <p id={`prenom-error-${fid}`} className="mt-1.5 text-xs text-red-600">
            {errors.prenom}
          </p>
        )}
      </div>

      {/* Email pro */}
      <div>
        <label htmlFor={`email-${fid}`} className={`block text-sm font-medium mb-1.5 ${baseLabel}`}>
          Email professionnel <span className="text-accent">*</span>
        </label>
        <input
          id={`email-${fid}`}
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? `email-error-${fid}` : undefined}
          placeholder="marie@agence.fr"
          className={`w-full rounded-xl border ${baseInput} px-4 py-3 text-base outline-none transition focus:ring-2 focus:ring-accent/15`}
        />
        {errors.email && (
          <p id={`email-error-${fid}`} className="mt-1.5 text-xs text-red-600">
            {errors.email}
          </p>
        )}
      </div>

      {/* Téléphone */}
      <div>
        <label htmlFor={`telephone-${fid}`} className={`block text-sm font-medium mb-1.5 ${baseLabel}`}>
          Téléphone <span className="text-accent">*</span>
        </label>
        <input
          id={`telephone-${fid}`}
          name="telephone"
          type="tel"
          autoComplete="tel"
          value={form.telephone}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!errors.telephone}
          aria-describedby={errors.telephone ? `telephone-error-${fid}` : undefined}
          placeholder="06 12 34 56 78"
          className={`w-full rounded-xl border ${baseInput} px-4 py-3 text-base outline-none transition focus:ring-2 focus:ring-accent/15`}
        />
        {errors.telephone && (
          <p id={`telephone-error-${fid}`} className="mt-1.5 text-xs text-red-600">
            {errors.telephone}
          </p>
        )}
      </div>

      {/* Nom de l'agence */}
      <div>
        <label htmlFor={`agence-${fid}`} className={`block text-sm font-medium mb-1.5 ${baseLabel}`}>
          Nom de l&apos;agence <span className="text-accent">*</span>
        </label>
        <input
          id={`agence-${fid}`}
          name="nomAgence"
          type="text"
          autoComplete="organization"
          value={form.nomAgence}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!errors.nomAgence}
          aria-describedby={errors.nomAgence ? `agence-error-${fid}` : undefined}
          placeholder="Agence Martin Immobilier"
          className={`w-full rounded-xl border ${baseInput} px-4 py-3 text-base outline-none transition focus:ring-2 focus:ring-accent/15`}
        />
        {errors.nomAgence && (
          <p id={`agence-error-${fid}`} className="mt-1.5 text-xs text-red-600">
            {errors.nomAgence}
          </p>
        )}
      </div>

      {/* Top-level error (network or non-field server error) */}
      {submitError && (
        <p
          role="alert"
          className={`-mt-1 text-xs ${
            variant === "inverse" ? "text-red-300" : "text-red-600"
          }`}
        >
          {submitError}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`btn ${variant === "inverse" ? "btn-invert" : "btn-primary"} w-full disabled:cursor-wait disabled:opacity-90`}
      >
        {isSubmitting ? (
          <>
            <span className={`spinner ${variant === "inverse" ? "spinner-dark" : ""}`} aria-hidden />
            <span>Inscription en cours…</span>
          </>
        ) : (
          <>
            <span>Je rejoins la bêta</span>
            <span aria-hidden>→</span>
          </>
        )}
      </button>

      {showMicrocopy && (
        <p className={`text-xs text-center ${baseHelp}`}>
          Gratuit · Sans CB · Désinscription en 1 clic
        </p>
      )}
    </form>
  );
}
