'use client';

import { useState } from 'react';
import { isValidFrenchPostcode, normalizeFrenchPostcode } from '@/lib/agency-postal-codes';

const inputClass =
  'w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

type Props = {
  postalCodes: string[];
  onChange: (codes: string[]) => void;
  onPrimaryFromAddress?: (code: string) => void;
  primaryPostcode?: string | null;
  labelClass?: string;
};

export default function PostalCodesEditor({
  postalCodes,
  onChange,
  primaryPostcode,
  labelClass = 'mb-1.5 block font-medium text-gray-700',
}: Props) {
  const [extraCodeInput, setExtraCodeInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const addCode = () => {
    const code = normalizeFrenchPostcode(extraCodeInput);
    if (!isValidFrenchPostcode(code)) {
      setLocalError('Code postal invalide (5 chiffres).');
      return;
    }
    if (postalCodes.includes(code)) {
      setExtraCodeInput('');
      return;
    }
    onChange([...postalCodes, code].sort());
    setExtraCodeInput('');
    setLocalError(null);
  };

  const removeCode = (code: string) => {
    if (postalCodes.length <= 1) return;
    onChange(postalCodes.filter((c) => c !== code));
  };

  return (
    <div>
      <p className={labelClass}>Codes postaux souhaités</p>
      {primaryPostcode ? (
        <p className="mb-2 text-xs text-mute">
          Secteur principal déduit de l&apos;adresse :{' '}
          <span className="font-medium tabular-nums text-accent-dark">{primaryPostcode}</span>
        </p>
      ) : null}
      {postalCodes.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {postalCodes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-lg border border-black/8 bg-soft-warm px-2.5 py-1 text-sm font-medium tabular-nums text-ink"
            >
              {code}
              {postalCodes.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeCode(code)}
                  className="ml-0.5 rounded p-0.5 text-mute hover:bg-black/5 hover:text-ink"
                  aria-label={`Retirer ${code}`}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={extraCodeInput}
          onChange={(e) => setExtraCodeInput(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCode();
            }
          }}
          placeholder="Ex : 75011"
          className={`${inputClass} flex-1`}
          aria-label="Ajouter un code postal"
        />
        <button type="button" onClick={addCode} className="btn btn-ghost shrink-0 min-h-[44px] px-4">
          Ajouter
        </button>
      </div>
      {localError ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {localError}
        </p>
      ) : null}
    </div>
  );
}

/** Sync postal codes when address postcode changes. */
export function postalCodesFromAddress(
  current: string[],
  postcode: string | null | undefined,
): string[] {
  if (!postcode || !isValidFrenchPostcode(postcode)) return current.length ? current : [];
  const code = normalizeFrenchPostcode(postcode);
  if (current.length === 0) return [code];
  if (current[0] === code) return current;
  const extras = current.filter((c) => c !== current[0]);
  return [code, ...extras.filter((c) => c !== code)].sort();
}
