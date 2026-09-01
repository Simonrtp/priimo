'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, BellOff } from 'lucide-react';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';

/**
 * Activation du brief du matin.
 *
 * Le navigateur ne redemande jamais l'autorisation une fois refusée : on ne
 * déclenche donc la demande que sur un clic explicite, jamais au chargement.
 * Une invite surgie toute seule se solde par un refus définitif.
 */

/** La clé publique VAPID voyage en base64url ; l'API attend des octets. */
function base64UrlEnOctets(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const brut = window.atob(base64);
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  return octets;
}

type Etat = 'inconnu' | 'indisponible' | 'refuse' | 'inactif' | 'actif';

export default function ActivationNotifications() {
  const [etat, setEtat] = useState<Etat>('inconnu');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;

    async function lireEtat() {
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      ) {
        if (!annule) setEtat('indisponible');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!annule) setEtat('refuse');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const abonnement = await registration.pushManager.getSubscription();
      if (!annule) setEtat(abonnement ? 'actif' : 'inactif');
    }

    void lireEtat();
    return () => {
      annule = true;
    };
  }, []);

  async function activer() {
    setEnCours(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setEtat(permission === 'denied' ? 'refuse' : 'inactif');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const abonnement = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlEnOctets(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''),
      });

      const res = await fetch('/api/dashboard/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(abonnement.toJSON()),
      });
      if (!res.ok) throw new Error('enregistrement');

      setEtat('actif');
      toast.success('Brief du matin activé sur cet appareil.');
    } catch {
      toast.error("Activation impossible sur cet appareil.");
    } finally {
      setEnCours(false);
    }
  }

  async function desactiver() {
    setEnCours(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const abonnement = await registration.pushManager.getSubscription();
      if (abonnement) {
        await fetch(`/api/dashboard/push?endpoint=${encodeURIComponent(abonnement.endpoint)}`, {
          method: 'DELETE',
        });
        await abonnement.unsubscribe();
      }
      setEtat('inactif');
      toast.success('Notifications coupées sur cet appareil.');
    } catch {
      toast.error('Opération impossible.');
    } finally {
      setEnCours(false);
    }
  }

  if (etat === 'inconnu' || etat === 'indisponible') return null;

  return (
    <WorkspaceCard className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        {etat === 'actif' ? (
          <Bell size={17} className="mt-0.5 shrink-0 text-text-subtle" aria-hidden />
        ) : (
          <BellOff size={17} className="mt-0.5 shrink-0 text-text-subtle" aria-hidden />
        )}
        <div>
          <p className="text-[14.5px] font-semibold text-text">Brief du matin</p>
          <p className="mt-0.5 max-w-md text-[13px] leading-relaxed text-text-subtle">
            {etat === 'actif'
              ? 'Une notification à 7 h, uniquement les jours où il y a quelque chose à faire.'
              : etat === 'refuse'
                ? 'Les notifications sont bloquées pour ce site. À réautoriser dans les réglages du navigateur.'
                : 'Recevez en une notification vos rendez-vous, vos promesses et ce qu’il y a à valider.'}
          </p>
        </div>
      </div>

      {etat === 'refuse' ? null : etat === 'actif' ? (
        <WorkspaceButton variant="secondary" disabled={enCours} onClick={desactiver}>
          Désactiver
        </WorkspaceButton>
      ) : (
        <WorkspaceButton disabled={enCours} onClick={activer}>
          Activer
        </WorkspaceButton>
      )}
    </WorkspaceCard>
  );
}
