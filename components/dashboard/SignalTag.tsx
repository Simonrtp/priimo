interface SignalTagProps {
  label: string;
  color?: string;
}

export default function SignalTag({ label, color = '#2563EB' }: SignalTagProps) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-[4px] font-medium uppercase tracking-wider"
      style={{
        fontSize: '11px',
        backgroundColor: `${color}18`,
        color,
      }}
    >
      {label}
    </span>
  );
}
