import { getDirectorFollowupInfo } from '@/lib/utils/format';

const STATUS_CLASS: Record<ReturnType<typeof getDirectorFollowupInfo>['status'], string> = {
  upcoming: 'text-white/30',
  due: 'text-amber-400/75',
  overdue: 'text-amber-400/85',
};

export function DirectorFollowupHint({ registeredAt }: { registeredAt: string }) {
  const { status, label } = getDirectorFollowupInfo(registeredAt);

  return (
    <span className={`mt-0.5 block text-[10px] leading-tight ${STATUS_CLASS[status]}`} title="Relance fondateur J+14">
      {label}
    </span>
  );
}
