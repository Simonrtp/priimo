'use client';

import { FIELD } from '@/lib/today/field';
import { useOfflineQueue } from '@/components/dashboard/field/OfflineQueueProvider';

/** Pastille discrète : file hors-ligne en attente. */
export default function OfflineIndicator({ className = '' }: { className?: string }) {
  const { pending } = useOfflineQueue();
  if (pending <= 0) return null;

  return (
    <p
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${className}`}
      style={{ backgroundColor: FIELD.orangePastel, color: FIELD.orange }}
      role="status"
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: FIELD.orange }} aria-hidden />
      {pending} en attente de réseau
    </p>
  );
}
