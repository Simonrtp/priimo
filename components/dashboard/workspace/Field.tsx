'use client';

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

/** Aucun champ sans étiquette : la règle vaut pour tout l'espace de travail. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  /** Message d’erreur lié au champ (aria-describedby). */
  error?: string;
  children: ReactNode;
}) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className="min-w-0">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block font-medium text-text-muted"
        style={{ fontSize: 12.5 }}
      >
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-[12.5px] font-medium text-[#B42318]">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-text-subtle" style={{ fontSize: 12 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-black/[0.10] bg-surface px-3 py-2.5 text-text outline-none transition-colors placeholder:text-text-subtle focus:border-accent/50 focus:ring-2 focus:ring-accent/15';

export const INPUT_ERROR_CLASS =
  'border-[#E8A0A0] focus:border-[#B42318]/50 focus:ring-[#B42318]/15';

/** Même champ que TextInput, avec place pour l’icône pin de l’autocomplete BAN. */
export const ADDRESS_FIELD_INPUT_CLASS =
  'w-full rounded-xl border border-black/[0.10] bg-surface py-2.5 pl-10 pr-10 text-[14px] text-text outline-none transition-colors placeholder:text-text-subtle focus:border-accent/50 focus:ring-2 focus:ring-accent/15';

export function TextInput({
  className = '',
  invalid = false,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={`${inputClass} ${invalid ? INPUT_ERROR_CLASS : ''} ${className}`}
      style={{ fontSize: 14 }}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function TextArea({
  className = '',
  invalid = false,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={`${inputClass} resize-y ${invalid ? INPUT_ERROR_CLASS : ''} ${className}`}
      style={{ fontSize: 14, lineHeight: 1.6 }}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}
