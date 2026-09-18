'use client';

import Select, { type SelectOption } from '@/components/ui/Select';

export type AssigneeOption = {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
};

export function assigneeSelectAvatar(m: AssigneeOption): SelectOption['avatar'] {
  const firstName = (m.firstName ?? '').trim();
  const lastName = (m.lastName ?? '').trim();
  if (firstName || lastName) {
    return { firstName, lastName, url: m.avatarUrl ?? null };
  }
  const parts = m.fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    url: m.avatarUrl ?? null,
  };
}

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
  const options: SelectOption[] = [
    ...(includeUnassigned ? [{ value: '', label: unassignedLabel }] : []),
    ...members.map((m) => ({
      value: m.id,
      label: m.id === currentUserId ? `${m.fullName} (moi)` : m.fullName,
      avatar: assigneeSelectAvatar(m),
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
