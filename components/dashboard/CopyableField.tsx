'use client';

interface CopyableFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  onCopied: () => void;
}

export default function CopyableField({ label, value, disabled, onCopied }: CopyableFieldProps) {
  const copy = async () => {
    if (!value || disabled) return;
    try {
      await navigator.clipboard.writeText(value);
      onCopied();
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <p className="text-mute mb-1" style={{ fontSize: 10, letterSpacing: '0.04em' }}>
        {label}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink tabular truncate min-w-0" style={{ fontSize: 13 }}>
          {value || '—'}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            copy();
          }}
          disabled={disabled || !value}
          className="text-xs font-medium text-accent-dark hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          Copier
        </button>
      </div>
    </div>
  );
}
