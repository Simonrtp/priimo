'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/hooks/useUser';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import { isValidFrenchPostcode, normalizeFrenchPostcode } from '@/lib/agency-postal-codes';
import { FOUNDER_WHATSAPP_HREF } from '@/lib/founder-contact';
import { PLAN_BADGE_CLASSES, PLAN_LABEL } from '@/lib/plan-meta';
import type { NotificationPreferences } from '@/types/database';
import Modal from '@/components/ui/Modal';
import SectionTeam from './SectionTeam';

const inputClass =
  'w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

const labelClass = 'mb-1.5 block font-medium text-gray-700';

type SettingsTabId = 'agency' | 'team' | 'billing' | 'notifications' | 'profile' | 'security';

const DIRECTOR_TAB_LIST: { id: SettingsTabId; label: string }[] = [
  { id: 'agency', label: 'Mon agence' },
  { id: 'team', label: 'Mon équipe' },
  { id: 'billing', label: 'Abonnement' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'profile', label: 'Mon profil' },
  { id: 'security', label: 'Sécurité' },
];

const COLLABORATOR_TAB_LIST: { id: SettingsTabId; label: string }[] = [
  { id: 'profile', label: 'Mon profil' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Sécurité' },
];

function firstSettingsTab(isDirector: boolean): SettingsTabId {
  return isDirector ? 'agency' : 'profile';
}

export default function SettingsDashboard({ initialTab }: { initialTab?: SettingsTabId }) {
  const { isDirector } = useUser();
  const tabs = useMemo(() => (isDirector ? DIRECTOR_TAB_LIST : COLLABORATOR_TAB_LIST), [isDirector]);

  const fallback = firstSettingsTab(isDirector);
  const startTab = initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : fallback;
  const [activeTab, setActiveTab] = useState<SettingsTabId>(startTab);
  const [mobileOpen, setMobileOpen] = useState<SettingsTabId | null>(startTab);

  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab)) {
      setActiveTab(fallback);
      setMobileOpen(fallback);
    }
  }, [activeTab, fallback, tabs]);

  useEffect(() => {
    if (initialTab && tabs.some((t) => t.id === initialTab)) {
      setActiveTab(initialTab);
      setMobileOpen(initialTab);
    }
  }, [initialTab, tabs]);

  const renderSection = (id: SettingsTabId) => {
    switch (id) {
      case 'agency':
        return isDirector ? <SectionAgency /> : null;
      case 'team':
        return isDirector ? <SectionTeam /> : null;
      case 'billing':
        return isDirector ? <SectionBilling /> : null;
      case 'notifications':
        return <SectionNotifications />;
      case 'profile':
        return <SectionProfile />;
      case 'security':
        return <SectionSecurity />;
    }
  };

  return (
    <div className="relative w-full min-w-0 max-w-5xl max-md:pt-4">
      <header className="mb-4 md:mb-6">
        <h1
          className="max-md:hidden font-semibold tracking-tight text-ink"
          style={{ fontSize: 22, letterSpacing: '-0.02em' }}
        >
          Paramètres
        </h1>
        <p className="text-pretty text-mute max-md:mt-0 md:mt-1" style={{ fontSize: 14 }}>
          Gérez votre agence, votre équipe et vos préférences.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-0 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-soft md:hidden">
        {tabs.map(({ id, label }) => {
          const open = mobileOpen === id;
          return (
            <div key={id} className="border-b border-black/8 last:border-b-0">
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center justify-between px-3 py-3 text-left sm:px-4"
                onClick={() => setMobileOpen((o) => (o === id ? null : id))}
                aria-expanded={open}
              >
                <span className="font-semibold text-ink" style={{ fontSize: 16 }}>
                  {label}
                </span>
                <ChevronDown
                  size={20}
                  className={`shrink-0 text-mute transition-transform ${open ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
              {open && (
                <div className="overflow-x-hidden border-t border-black/[0.06] bg-white px-3 py-4 sm:px-4 sm:py-5">
                  {renderSection(id)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-soft md:flex md:flex-row">
        <nav
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-black/8 bg-soft-gray/40 p-2 [scrollbar-width:none] sm:p-3 lg:w-52 lg:flex-col lg:overflow-x-visible lg:border-b-0 lg:border-r [&::-webkit-scrollbar]:hidden"
          aria-label="Sections paramètres"
        >
          {tabs.map(({ id, label }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-[14px] font-medium transition-colors lg:w-full ${
                  active ? 'bg-white text-ink shadow-sm ring-1 ring-black/6' : 'text-mute hover:bg-white/60 hover:text-ink'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{renderSection(activeTab)}</div>
      </div>
    </div>
  );
}

function SectionAgency() {
  const { agency } = useUser();
  const router = useRouter();
  const [name, setName] = useState(agency.name);
  const [agencyAddress, setAgencyAddress] = useState<SelectedAddress | null>(() =>
    agency.address
      ? {
          label: agency.address,
          latitude: 0,
          longitude: 0,
          city: '',
          postcode: agency.codes_postaux?.[0] ?? '',
        }
      : null,
  );
  const [phone, setPhone] = useState(agency.phone ?? '');
  const [email, setEmail] = useState(agency.email ?? '');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const primaryPostcode =
    agencyAddress?.postcode?.trim() || agency.codes_postaux?.[0]?.trim() || null;
  const coveredPostalCodes = agency.codes_postaux ?? [];

  const save = async () => {
    const addressLabel = agencyAddress?.label?.trim() ?? '';
    if (!addressLabel || addressLabel.length < 5) {
      const err = "Sélectionnez l'adresse de l'agence dans la liste de suggestions.";
      setAddressError(err);
      toast.error(err);
      return;
    }
    const postcode = agencyAddress?.postcode
      ? normalizeFrenchPostcode(agencyAddress.postcode)
      : '';
    if (!isValidFrenchPostcode(postcode)) {
      const err = 'Adresse invalide : code postal manquant.';
      setAddressError(err);
      toast.error(err);
      return;
    }
    setAddressError(null);

    const initialPrimary = agency.codes_postaux?.[0] ?? null;
    const extraCodes = (agency.codes_postaux ?? []).filter((c) => c !== initialPrimary);
    const codesPostaux = [postcode, ...extraCodes.filter((c) => c !== postcode)];

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('agencies')
      .update({
        name: name.trim(),
        address: addressLabel,
        phone: phone.trim() || null,
        email: email.trim() || null,
        codes_postaux: codesPostaux,
        zone_type: null,
        zone_center_address: null,
        zone_latitude: null,
        zone_longitude: null,
        zone_radius_km: null,
        zone_postal_codes: null,
      })
      .eq('id', agency.id);
    setSaving(false);
    if (error) {
      toast.error('Erreur lors de la sauvegarde');
      return;
    }
    toast.success('Agence mise à jour');
    router.refresh();
  };

  return (
    <section>
      <h2 className="mb-4 hidden font-semibold text-ink md:block sm:mb-6" style={{ fontSize: 18 }}>
        Mon agence
      </h2>
      <div className="flex w-full max-w-xl flex-col gap-5">
        <div>
          <label htmlFor="agency-name" className={labelClass}>
            Nom de l&apos;agence
          </label>
          <input id="agency-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="agency-address" className={labelClass}>
            Adresse de l&apos;agence
          </label>
          <AddressAutocomplete
            id="agency-address"
            value={agencyAddress?.label ?? ''}
            onChange={(selected) => {
              setAgencyAddress(selected);
              setAddressError(null);
            }}
            placeholder="Ex : 12 rue de la Paix, Paris"
            inputClassName={`${inputClass} pl-10 pr-10`}
          />
          {primaryPostcode ? (
            <p className="mt-2 text-sm font-medium text-accent-dark">
              Secteur : <span className="tabular-nums">{primaryPostcode}</span>
            </p>
          ) : null}
          {addressError ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {addressError}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="agency-phone" className={labelClass}>
            Téléphone
          </label>
          <input
            id="agency-phone"
            className={inputClass}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="agency-email" className={labelClass}>
            Email de contact
          </label>
          <input
            id="agency-email"
            className={inputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {coveredPostalCodes.length > 0 ? (
          <div className="border-t border-black/[0.06] pt-5">
            <p className={labelClass}>Secteurs couverts</p>
            <p className="mb-3 text-xs text-mute">
              Vos prospects sont filtrés par code postal. Le secteur principal correspond à
              l&apos;adresse de votre agence.
            </p>
            <div className="flex flex-wrap gap-2">
              {coveredPostalCodes.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center rounded-lg border border-black/8 bg-soft-warm px-2.5 py-1 text-sm font-medium tabular-nums text-ink"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-black/[0.08] bg-soft-warm/40 px-4 py-3">
          <p className="text-sm text-ink" style={{ lineHeight: 1.55 }}>
            Pour ajouter ou modifier un code postal supplémentaire,{' '}
            <a
              href={FOUNDER_WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-dark underline underline-offset-2 hover:text-accent"
            >
              contactez-moi sur WhatsApp
            </a>
            .
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-start"
          style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
          onClick={save}
          disabled={saving || !name.trim()}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </div>
    </section>
  );
}

function SectionBilling() {
  const { agency } = useUser();
  return (
    <section>
      <h2 className="mb-4 hidden font-semibold text-ink md:block sm:mb-6" style={{ fontSize: 18 }}>
        Abonnement
      </h2>
      <div className="flex w-full max-w-xl flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-mute uppercase tracking-widest" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
            Plan actuel
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span
              className={`inline-flex w-fit items-center rounded-full px-3 py-1 font-semibold ${PLAN_BADGE_CLASSES[agency.plan]}`}
              style={{ fontSize: 12 }}
            >
              {PLAN_LABEL[agency.plan]}
            </span>
            <p className="text-mute" style={{ fontSize: 14 }}>
              La gestion de l&apos;abonnement et la tarification arrivent bientôt.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-mute uppercase tracking-widest" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
            Prochain renouvellement
          </p>
          <p className="text-ink" style={{ fontSize: 14 }}>
            À venir
          </p>
        </div>
        <button
          type="button"
          disabled
          className="w-full rounded-lg border border-black/10 bg-soft-gray/60 px-4 py-2 font-medium text-mute sm:w-auto sm:self-start"
          style={{ fontSize: 13 }}
        >
          Gérer mon abonnement — Disponible bientôt
        </button>
      </div>
    </section>
  );
}

function SectionNotifications() {
  const { user, profile } = useUser();
  const router = useRouter();
  const initial = useMemo<NotificationPreferences>(() => {
    const p = profile.preferences as Partial<NotificationPreferences>;
    return {
      newLeads: p.newLeads ?? true,
      weeklyDigest: p.weeklyDigest ?? true,
      productTips: p.productTips ?? false,
    };
  }, [profile.preferences]);
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial);
  const [saving, setSaving] = useState(false);

  const update = async (next: NotificationPreferences) => {
    setPrefs(next);
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const merged = { ...(profile.preferences ?? {}), ...next };
    const { error } = await supabase.from('profiles').update({ preferences: merged }).eq('id', user.id);
    setSaving(false);
    if (error) {
      toast.error(`Impossible d'enregistrer : ${error.message}`);
      setPrefs(initial);
      return;
    }
    toast.success('Préférences mises à jour');
    router.refresh();
  };

  return (
    <section>
      <h2 className="mb-4 hidden font-semibold text-ink md:block sm:mb-6" style={{ fontSize: 18 }}>
        Notifications
      </h2>
      <ul className="flex w-full max-w-xl flex-col gap-2">
        <ToggleRow
          label="Recevoir un email quand de nouveaux prospects sont disponibles"
          checked={prefs.newLeads}
          disabled={saving}
          onChange={(v) => update({ ...prefs, newLeads: v })}
        />
        <ToggleRow
          label="Recevoir un récapitulatif hebdomadaire"
          checked={prefs.weeklyDigest}
          disabled={saving}
          onChange={(v) => update({ ...prefs, weeklyDigest: v })}
        />
        <ToggleRow
          label="Recevoir des conseils produit"
          checked={prefs.productTips}
          disabled={saving}
          onChange={(v) => update({ ...prefs, productTips: v })}
        />
      </ul>
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-black/[0.06] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="min-w-0 text-pretty text-ink" style={{ fontSize: 13.5 }}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 self-end items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:self-center ${
          checked ? 'bg-accent' : 'bg-black/15'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-soft transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </li>
  );
}

function SectionProfile() {
  const { user, profile } = useUser();
  const router = useRouter();
  const [firstName, setFirstName] = useState(profile.first_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [saving, setSaving] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);

  const save = async () => {
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: firstName.trim(), last_name: lastName.trim() })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      toast.error('Erreur lors de la sauvegarde');
      return;
    }
    toast.success('Profil mis à jour');
    router.refresh();
  };

  return (
    <section>
      <h2 className="mb-4 hidden font-semibold text-ink md:block sm:mb-6" style={{ fontSize: 18 }}>
        Mon profil
      </h2>
      <div className="flex w-full max-w-xl flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-firstName" className={labelClass}>
              Prénom
            </label>
            <input
              id="profile-firstName"
              className={inputClass}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="profile-lastName" className={labelClass}>
              Nom
            </label>
            <input
              id="profile-lastName"
              className={inputClass}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label htmlFor="profile-email" className={labelClass}>
            Email
          </label>
          <input id="profile-email" className={`${inputClass} bg-soft-gray/40`} value={user.email} readOnly />
          <p className="mt-1 text-mute" style={{ fontSize: 12 }}>
            Pour modifier votre adresse, contactez le support.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <button
            type="button"
            className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
            onClick={save}
            disabled={saving || !firstName.trim() || !lastName.trim()}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={() => setPwdModalOpen(true)}
            className="w-full rounded-lg border border-black/10 bg-white px-4 py-2 font-medium text-ink transition-colors hover:bg-black/[0.04] sm:w-auto"
            style={{ fontSize: 13 }}
          >
            Changer mon mot de passe
          </button>
        </div>
      </div>

      <ChangePasswordModal open={pwdModalOpen} onClose={() => setPwdModalOpen(false)} />
    </section>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewPwd('');
      setConfirm('');
    }
  }, [open]);

  const submit = async () => {
    if (newPwd.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (newPwd !== confirm) {
      toast.error('Les mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSaving(false);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    toast.success('Mot de passe mis à jour');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Changer mon mot de passe" maxWidth="sm">
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="new-password" className={labelClass}>
            Nouveau mot de passe
          </label>
          <input
            id="new-password"
            className={inputClass}
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className={labelClass}>
            Confirmer
          </label>
          <input
            id="confirm-password"
            className={inputClass}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg px-4 py-2 font-medium text-ink hover:bg-black/[0.04] sm:w-auto"
            style={{ fontSize: 13 }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !newPwd || !confirm}
            className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            style={{ padding: '8px 18px', fontSize: 13, borderRadius: 10 }}
          >
            {saving ? 'Enregistrement…' : 'Mettre à jour'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SectionSecurity() {
  const [signingOut, setSigningOut] = useState(false);

  const signOutEverywhere = useCallback(async () => {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    setSigningOut(false);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    window.location.href = '/login';
  }, []);

  return (
    <section>
      <h2 className="mb-4 hidden font-semibold text-ink md:block sm:mb-6" style={{ fontSize: 18 }}>
        Sécurité
      </h2>
      <div className="flex w-full max-w-xl flex-col gap-4">
        <div className="rounded-xl border border-black/[0.08] bg-white px-4 py-3">
          <p className="font-medium text-ink" style={{ fontSize: 14 }}>
            Se déconnecter de tous les appareils
          </p>
          <p className="mt-1 text-mute" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
            Termine toutes les sessions actives sur tous vos appareils.
          </p>
          <button
            type="button"
            onClick={signOutEverywhere}
            disabled={signingOut}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 font-medium text-ink transition-colors hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ fontSize: 13 }}
          >
            <LogOut size={16} strokeWidth={2} aria-hidden />
            {signingOut ? 'Déconnexion…' : 'Se déconnecter partout'}
          </button>
        </div>
        <div className="rounded-xl border border-black/[0.08] bg-white px-4 py-3">
          <p className="font-medium text-ink" style={{ fontSize: 14 }}>
            Supprimer mon compte
          </p>
          <p className="mt-1 text-mute" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
            Pour supprimer définitivement votre compte, contactez{' '}
            <a className="text-accent-dark underline" href="mailto:contact@priimo.fr">
              contact@priimo.fr
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
