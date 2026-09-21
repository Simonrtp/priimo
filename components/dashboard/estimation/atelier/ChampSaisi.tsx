'use client';

import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { TextArea, TextInput } from '@/components/dashboard/workspace/Field';

/**
 * Pendant la saisie, le texte affiché est local.
 * Une réponse serveur plus lente ne peut pas recoller ce qu’on vient d’effacer.
 */
export function ChampSaisi({
  value,
  onCommit,
  ...rest
}: {
  value: string;
  onCommit: (raw: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  return (
    <TextInput
      {...rest}
      value={editing ? local : value}
      onFocus={(e) => {
        setEditing(true);
        setLocal(value);
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setLocal(raw);
        onCommit(raw);
      }}
      onBlur={(e) => {
        setEditing(false);
        onCommit(local);
        rest.onBlur?.(e);
      }}
    />
  );
}

export function ZoneSaisie({
  value,
  onCommit,
  ...rest
}: {
  value: string;
  onCommit: (raw: string) => void;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  return (
    <TextArea
      {...rest}
      value={editing ? local : value}
      onFocus={(e) => {
        setEditing(true);
        setLocal(value);
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setLocal(raw);
        onCommit(raw);
      }}
      onBlur={(e) => {
        setEditing(false);
        onCommit(local);
        rest.onBlur?.(e);
      }}
    />
  );
}

export function texteNombre(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}
