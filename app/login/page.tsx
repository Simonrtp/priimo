"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import { PriimoLogo } from "@/components/brand/PriimoLogo";
import { CALENDLY_URL } from "@/lib/calendly";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = {
  email?: string;
  password?: string;
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) return "L'adresse email est requise.";
    if (!EMAIL_REGEX.test(value.trim())) return "Format d'email invalide.";
    return undefined;
  };

  const validatePassword = (value: string): string | undefined => {
    if (!value) return "Le mot de passe est requis.";
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Errors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(next);
    setTouched({ email: true, password: true });
    if (next.email || next.password) return;

    setIsSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setErrors({ password: "Email ou mot de passe incorrect." });
      setIsSubmitting(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="min-h-dvh bg-canvas flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
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
          <Link href="/" className="inline-block">
            <PriimoLogo className="h-12" priority />
          </Link>
        </div>

        <div className="rounded-2xl bg-white border border-black/5 shadow-soft p-6 sm:p-8">
          <div className="text-center mb-6">
            <h1 className="font-sans text-2xl font-semibold text-gray-900 tracking-tight">
              Content de vous revoir
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Connectez-vous à votre espace Priimo
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900"
              >
                Adresse email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (touched.email) setErrors((p) => ({ ...p, email: validateEmail(e.target.value) }));
                }}
                onBlur={() => {
                  setTouched((p) => ({ ...p, email: true }));
                  setErrors((p) => ({ ...p, email: validateEmail(email) }));
                }}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                placeholder="vous@agence.fr"
                className="w-full rounded-xl border bg-white border-black/10 text-gray-900 placeholder-gray-500/70 px-4 py-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-xs text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium tracking-wide mb-1.5 text-gray-900"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (touched.password)
                      setErrors((p) => ({ ...p, password: validatePassword(e.target.value) }));
                  }}
                  onBlur={() => {
                    setTouched((p) => ({ ...p, password: true }));
                    setErrors((p) => ({ ...p, password: validatePassword(password) }));
                  }}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  placeholder="••••••••"
                  className="password-field-custom-toggle w-full rounded-xl border bg-white border-black/10 text-gray-900 placeholder-gray-500/70 px-4 py-3 pr-11 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
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
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-xs text-red-600">
                  {errors.password}
                </p>
              )}
              <div className="mt-2 text-right">
                <a
                  href="#"
                  className="text-xs text-gray-600 hover:text-accent-dark transition"
                >
                  Mot de passe oublié ?
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full disabled:cursor-wait disabled:opacity-90"
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" aria-hidden />
                  <span>Connexion en cours…</span>
                </>
              ) : (
                <span>Se connecter</span>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Pas encore client ?{" "}
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-dark font-medium hover:underline"
          >
            Réserver une démo
          </a>
        </p>
      </div>
      </div>
      <Footer />
    </main>
  );
}
