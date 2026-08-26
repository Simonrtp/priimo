/**
 * Notifications standard Priimo.
 *
 * Design = pastille Sonner d’origine (`richColors`, top-right) — ne pas
 * restyler. Pour toute action agent à confirmer : `notifySuccess('…')`.
 * Anti-spam : passer un `id` stable pour dédupliquer les clics répétés.
 */
import { toast } from 'sonner';

type NotifyOpts = {
  id?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
};

/** Confirmation d’action — pastille verte Sonner (design d’origine). */
export function notifySuccess(message: string, opts?: NotifyOpts) {
  return toast.success(message, {
    id: opts?.id,
    duration: opts?.duration ?? 3200,
    action: opts?.action,
  });
}

export function notifyError(message: string, opts?: NotifyOpts) {
  return toast.error(message, {
    id: opts?.id,
    duration: opts?.duration ?? 4500,
  });
}

export function notifyInfo(message: string, opts?: NotifyOpts) {
  return toast.message(message, {
    id: opts?.id,
    duration: opts?.duration ?? 3500,
  });
}
