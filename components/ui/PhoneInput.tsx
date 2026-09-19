'use client';

import type { InputHTMLAttributes } from 'react';
import { formatPhoneAfterCountryCode, formatPhoneDisplay } from '@/lib/import/normalize';

type PhoneInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** national = 06 12 34 56 78 ; after33 = 6 12 34 56 78 (préfixe +33 déjà affiché) */
  grouping?: 'national' | 'after33';
};

export default function PhoneInput({
  value,
  onChange,
  grouping = 'national',
  ...rest
}: PhoneInputProps) {
  const format = grouping === 'after33' ? formatPhoneAfterCountryCode : formatPhoneDisplay;
  return (
    <input
      {...rest}
      type="tel"
      inputMode={rest.inputMode ?? 'tel'}
      autoComplete={rest.autoComplete ?? 'tel'}
      value={format(String(value ?? ''))}
      onChange={(e) => {
        e.target.value = format(e.target.value);
        onChange?.(e);
      }}
    />
  );
}
