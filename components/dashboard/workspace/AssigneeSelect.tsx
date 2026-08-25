'use client';

import Select from '@/components/ui/Select';

export type AssigneeOption = {
  id: string;
  fullName: string;
};

export default function AssigneeSelect({
  id,
  value,
  members,
  onChange,
  includeUnassigned = false,
  unassignedLabel = 'Non assigné',
  currentUserId,
  'aria-label': ariaLabel = 'Assigner à',
}: {
  id?: string;
  value: string | null;
  members: readonly AssigneeOption[];
  onChange: (id: string | null) => void;
  includeUnassigned?: boolean;
  unassignedLabel?: string;
  currentUserId?: string | null;
  'aria-label'?: string;
}) {
  const options = [
    ...(includeUnassigned ? [{ value: '', label: unassignedLabel }] : []),
    ...members.map((m) => ({
      value: m.id,
      label: m.id === currentUserId ? `${m.fullName} (moi)` : m.fullName,
    })),
  ];

  return (
    <Select
      id={id}
      aria-label={ariaLabel}
      value={value ?? ''}
      options={options}
      onChange={(v) => onChange(v === '' ? null : v)}
    />
  );
}
