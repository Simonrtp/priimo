'use client';

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

/** Aucun champ sans étiquette : la règle vaut pour tout l'espace de travail. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
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
      {hint ? (
        <p className="mt-1 text-text-subtle" style={{ fontSize: 12 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-black/[0.10] bg-surface px-3 py-2.5 text-text outline-none transition-colors placeholder:text-text-subtle focus:border-accent/50 focus:ring-2 focus:ring-accent/15';

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} ${className}`} style={{ fontSize: 14 }} {...rest} />;
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${inputClass} resize-y ${className}`}
      style={{ fontSize: 14, lineHeight: 1.6 }}
      {...rest}
    />
  );
}
