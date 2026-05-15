"use client";

import Link from "next/link";
import { useState } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState = {
  agencyName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

type Errors = Partial<Record<keyof FormState, string>>;

const INITIAL: FormState = {
  agencyName: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  passwordConfirm: "",
};

const INITIAL_TOUCHED: Record<keyof FormState, boolean> = {
  agencyName: false,
  firstName: false,
  lastName: false,
  email: false,
  password: false,
  passwordConfirm: false,
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a19.5 19.5 0 015.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a19.4 19.4 0 01-3.17 4.19" />
      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function SignupPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(INITIAL_TOUCHED);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = (
    name: keyof FormState,
    value: string,
    full: FormState
  ): string | undefined => {
    switch (name) {
      case "agencyName":
        if (!value.trim()) return "Le nom de l'agence est requis.";
        if (value.trim().length < 2) return "Nom d'agence trop court.";
        return undefined;
      case "firstName":
        if (!value.trim()) return "Votre prénom est requis.";
        if (value.trim().length < 2) return "Prénom trop court.";
        return undefined;
      case "lastName":
        if (!value.trim()) return "Votre nom est requis.";
        if (value.trim().length < 2) return "Nom trop court.";
        return undefined;
      case "email":
        if (!value.trim()) return "L'adresse email est requise.";
        if (!EMAIL_REGEX.test(value.trim())) return "Format d'email invalide.";
        return undefined;
      case "password":
        if (!value) return "Le mot de passe est requis.";
        if (value.length < 8) return "Le mot de passe doit faire au moins 8 caractères.";
        return undefined;
      case "passwordConfirm":
        if (!value) return "Veuillez confirmer le mot de passe.";
        if (value !== full.password) return "Les mots de passe ne correspondent pas.";
        return undefined;
      default:
        return undefined;
    }
  };

  const validateAll = (full: FormState): Errors => ({
    agencyName: validateField("agencyName", full.agencyName, full),
    firstName: validateField("firstName", full.firstName, full),
    lastName: validateField("lastName", full.lastName, full),
    email: validateField("email", full.email, full),
    password: validateField("password", full.password, full),
    passwordConfirm: validateField("passwordConfirm", full.passwordConfirm, full),
  });

  const handleChange =
    (name: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = { ...form, [name]: e.target.value };
      setForm(next);
      if (touched[name]) {
        setErrors((p) => ({ ...p, [name]: validateField(name, e.target.value, next) }));
      }
      // If password changes, re-check confirm field if it has been touched.
      if (name === "password" && touched.passwordConfirm) {
        setErrors((p) => ({
          ...p,
          passwordConfirm: validateField("passwordConfirm", next.passwordConfirm, next),
        }));
      }
    };

  const handleBlur = (name: keyof FormState) => () => {
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors((p) => ({ ...p, [name]: validateField(name, form[name], form) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = validateAll(form);
    setErrors(next);
    setTouched({
      agencyName: true,
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      passwordConfirm: true,
    });
    if (Object.values(next).some(Boolean)) return;

    setIsSubmitting(true);
    // TODO: brancher Supabase Auth + création agence + user Directeur.
    console.log("[signup:submit]", {
      agencyName: form.agencyName.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: form.password,
      passwordConfirm: form.passwordConfirm,
    });
    await new Promise((r) => setTimeout(r, 400));
    setIsSubmitting(false);
  };

  const inputClass =
    "w-full rounded-xl border bg-white border-black/10 text-gray-900 placeholder-gray-500/70 px-4 py-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15";

  return (
    <main className="min-h-dvh bg-canvas flex items-center justify-center px-4 py-10 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: [
            "radial-gradient(900px 700px at 18% 22%, rgba(232, 116, 60, 0.07), transparent 65%)",
            "radial-gradient(820px 620px at 84% 70%, rgba(232, 116, 60, 0.055), transparent 65%)",
          ].join(", "),
        }}
      />

      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-6">
          <Link
            href="/"
            className="font-sans text-3xl leading-none font-bold tracking-tight text-accent-dark"
          >
            Priimo
          </Link>
        </div>

        <div className="rounded-2xl bg-white border border-black/5 shadow-soft p-6 sm:p-8">
          <div className="text-center mb-6">
            <h1 className="font-sans text-2xl font-semibold text-gray-900 tracking-tight">
              Créez votre espace Priimo
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Essai gratuit · Sans engagement · Sans carte bancaire
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="agencyName" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
                Nom de l&apos;agence
              </label>
              <input
                id="agencyName"
                name="agencyName"
                type="text"
                autoComplete="organization"
                value={form.agencyName}
                onChange={handleChange("agencyName")}
                onBlur={handleBlur("agencyName")}
                aria-invalid={!!errors.agencyName}
                aria-describedby={errors.agencyName ? "agencyName-error" : undefined}
                placeholder="Agence Martin Immobilier"
                className={inputClass}
              />
              {errors.agencyName && (
                <p id="agencyName-error" className="mt-1.5 text-xs text-red-600">
                  {errors.agencyName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
                  Votre prénom
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={handleChange("firstName")}
                  onBlur={handleBlur("firstName")}
                  aria-invalid={!!errors.firstName}
                  aria-describedby={errors.firstName ? "firstName-error" : undefined}
                  placeholder="Marie"
                  className={inputClass}
                />
                {errors.firstName && (
                  <p id="firstName-error" className="mt-1.5 text-xs text-red-600">
                    {errors.firstName}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
                  Votre nom
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={handleChange("lastName")}
                  onBlur={handleBlur("lastName")}
                  aria-invalid={!!errors.lastName}
                  aria-describedby={errors.lastName ? "lastName-error" : undefined}
                  placeholder="Martin"
                  className={inputClass}
                />
                {errors.lastName && (
                  <p id="lastName-error" className="mt-1.5 text-xs text-red-600">
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
                Adresse email professionnelle
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange("email")}
                onBlur={handleBlur("email")}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                placeholder="marie@agence.fr"
                className={inputClass}
              />
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-xs text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange("password")}
                  onBlur={handleBlur("password")}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : "password-hint"}
                  placeholder="8 caractères minimum"
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-soft-gray transition"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {errors.password ? (
                <p id="password-error" className="mt-1.5 text-xs text-red-600">
                  {errors.password}
                </p>
              ) : (
                <p id="password-hint" className="mt-1.5 text-xs text-gray-500">
                  8 caractères minimum.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type={showPasswordConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.passwordConfirm}
                  onChange={handleChange("passwordConfirm")}
                  onBlur={handleBlur("passwordConfirm")}
                  aria-invalid={!!errors.passwordConfirm}
                  aria-describedby={errors.passwordConfirm ? "passwordConfirm-error" : undefined}
                  placeholder="Retapez votre mot de passe"
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-soft-gray transition"
                  aria-label={showPasswordConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  <EyeIcon open={showPasswordConfirm} />
                </button>
              </div>
              {errors.passwordConfirm && (
                <p id="passwordConfirm-error" className="mt-1.5 text-xs text-red-600">
                  {errors.passwordConfirm}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full disabled:cursor-wait disabled:opacity-90"
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" aria-hidden />
                  <span>Création en cours…</span>
                </>
              ) : (
                <span>Créer mon compte</span>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Déjà inscrit ?{" "}
          <Link href="/login" className="text-accent-dark font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
