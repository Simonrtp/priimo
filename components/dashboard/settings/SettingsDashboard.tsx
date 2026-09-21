'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/hooks/useUser';
import { ACCUEIL_VUE_COOKIE, parseAccueilVue, type AccueilVue } from '@/lib/today/accueil-vue';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { validerEnFond } from '@/lib/ui/valider-en-fond';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import { isValidFrenchPostcode, normalizeFrenchPostcode } from '@/lib/agency-postal-codes';
import type { TeamSettingsData } from '@/lib/queries/team-settings';
import EquipeClient from '@/components/dashboard/equipe/EquipeClient';
import Modal from '@/components/ui/Modal';
import AvatarChooser from '@/components/dashboard/AvatarChooser';
import SectionRequestSector from './SectionRequestSector';
import SectionIntegrations from './SectionIntegrations';
import SectionModeleRapport from './SectionModeleRapport';
import SectionAbonnement from './SectionAbonnement';
import PhoneInput from '@/components/ui/PhoneInput';
import { formatPhoneDisplay } from '@/lib/import/normalize';

const inputClass =
  'w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

const labelClass = 'mb-1.5 block font-medium text-gray-700';

export type SettingsTabId = 'agency' | 'team' | 'billing' | 'integrations' | 'profile';

// Les secteurs ne sont pas ici : on les dessine depuis l'Accueil, là où le
// négociateur travaille. Un découpage n'est pas une préférence d'application.
const DIRECTOR_TAB_LIST: { id: SettingsTabId; label: string }[] = [
  { id: 'agency', label: 'Mon agence' },
  { id: 'team', label: 'Mon équipe' },
  { id: 'integrations', label: 'Connexions' },
  { id: 'billing', label: 'Abonnement' },
  { id: 'profile', label: 'Mon profil' },
];

const COLLABORATOR_TAB_LIST: { id: SettingsTabId; label: string }[] = [
  { id: 'integrations', label: 'Connexions' },
  { id: 'profile', label: 'Mon profil' },
];

function firstSettingsTab(isDirector: boolean): SettingsTabId {
  return isDirector ? 'agency' : 'profile';
}

export default function SettingsDashboard({
  initialTab,
  team,
}: {
  initialTab?: SettingsTabId;
  team?: TeamSettingsData | null;
}) {
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
        return isDirector && team ? (
          <EquipeClient
            embedded
            currentUserId={team.currentUserId}
            initialMembers={team.members}
            initialInvitations={team.invitations}
            onboardingByMemberId={team.onboardingByMemberId}
          />
        ) : null;
      case 'billing':
        return isDirector ? <SectionAbonnement /> : null;
      case 'integrations':
        return <SectionIntegrations />;
      case 'profile':
        return <SectionProfile />;
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
          Gérez votre agence et vos préférences.
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

      <div className="hidden min-h-0 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-soft md:flex md:flex-row">
        <nav
          className="flex w-44 shrink-0 flex-col gap-1 self-stretch border-r border-black/8 bg-soft-gray/40 p-2 sm:w-48 sm:p-3"
          aria-label="Sections paramètres"
        >
          {tabs.map(({ id, label }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-[14px] font-medium transition-colors duration-fluid-subtle ease-in-out ${
                  active
                    ? 'bg-white text-ink shadow-sm ring-1 ring-black/6'
                    : 'text-mute hover:bg-white/60 hover:text-ink'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 overflow-x-hidden p-5 sm:p-6 lg:p-8">
          {renderSection(activeTab)}
        </div>
      </div>
    </div>
  );
}

function SectionAgency() {
  const { agency } = useUser();
  const router = useRouter();
  const [name, setName] = useState(agency.name);
  const [nomCommercial, setNomCommercial] = useState(agency.nom_commercial ?? '');
  const [siteWeb, setSiteWeb] = useState(agency.site_web ?? '');
  const [couleurPrincipale, setCouleurPrincipale] = useState(agency.couleur_principale ?? '#E8743C');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [agencyAddress, setAgencyAddress] = useState<SelectedAddress | null>(() =>
    agency.address
      ? {
          label: agency.address,
          latitude: agency.latitude ?? 0,
          longitude: agency.longitude ?? 0,
          city: '',
          postcode: agency.codes_postaux?.[0] ?? '',
        }
      : null,
  );
  const [phone, setPhone] = useState(formatPhoneDisplay(agency.phone ?? ''));
  const [email, setEmail] = useState(agency.email ?? '');
  const [frequenceSemaines, setFrequenceSemaines] = useState(
    Math.max(2, Math.round((agency.frequence_passage_jours ?? 84) / 7)),
  );
  const [addressError, setAddressError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/dashboard/agence/logo')
      .then((r) => r.json())
      .then((data: { url?: string | null }) => setLogoUrl(data.url ?? null))
      .catch(() => undefined);
  }, []);

  const primaryPostcode =
    agencyAddress?.postcode?.trim() || agency.codes_postaux?.[0]?.trim() || null;
  const coveredPostalCodes = agency.codes_postaux ?? [];

  const save = () => {
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

    const hasFreshCoords =
      agencyAddress &&
      Number.isFinite(agencyAddress.latitude) &&
      Number.isFinite(agencyAddress.longitude) &&
      !(agencyAddress.latitude === 0 && agencyAddress.longitude === 0);
    const latitude = hasFreshCoords ? agencyAddress!.latitude : agency.latitude;
    const longitude = hasFreshCoords ? agencyAddress!.longitude : agency.longitude;

    if (latitude == null || longitude == null) {
      const err = "Resélectionnez l'adresse de l'agence dans la liste de suggestions.";
      setAddressError(err);
      toast.error(err);
      return;
    }

    const payload = {
      name: name.trim(),
      nom_commercial: nomCommercial.trim() || null,
      site_web: siteWeb.trim() || null,
      couleur_principale: /^#[0-9A-Fa-f]{6}$/.test(couleurPrincipale.trim())
        ? couleurPrincipale.trim().toUpperCase()
        : '#E8743C',
      address: addressLabel,
      phone: phone.trim() || null,
      email: email.trim() || null,
      codes_postaux: codesPostaux,
      latitude,
      longitude,
      frequence_passage_jours: Math.min(365, Math.max(14, frequenceSemaines * 7)),
    };

    validerEnFond({
      succes: 'Agence mise à jour',
      echec: 'Erreur lors de la sauvegarde',
      ecrire: async () => {
        const supabase = createSupabaseBrowserClient();
        let { error } = await supabase.from('agencies').update(payload).eq('id', agency.id);
        if (error && /nom_commercial|site_web|couleur_principale/.test(error.message)) {
          const { nom_commercial: _n, site_web: _s, couleur_principale: _c, ...sansIdentite } = payload;
          ({ error } = await supabase.from('agencies').update(sansIdentite).eq('id', agency.id));
        }
        if (error && /frequence_passage/.test(error.message)) {
          const { frequence_passage_jours: _ignore, ...sansFrequence } = payload;
          ({ error } = await supabase.from('agencies').update(sansFrequence).eq('id', agency.id));
        }
        if (error) throw new Error('Erreur lors de la sauvegarde');
      },
      puis: () => router.refresh(),
    });
  };

  return (
    <section>
      <h2 className="mb-4 hidden font-semibold text-ink md:block sm:mb-6" style={{ fontSize: 18 }}>
        Mon agence
      </h2>
      <div className="flex w-full max-w-xl flex-col gap-5">
        <div>
          <p className={labelClass}>Logo du rapport</p>
          <div className="flex items-center gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/8 bg-soft-gray/40">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="size-full object-contain" />
              ) : (
                <span className="px-1 text-center text-[11px] text-mute">Aucun</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={logoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.append('file', file);
                  const res = await fetch('/api/dashboard/agence/logo', { method: 'POST', body: form });
                  const data = (await res.json()) as { url?: string; error?: string };
                  if (!res.ok) {
                    toast.error(data.error ?? 'Logo non enregistré');
                    return;
                  }
                  setLogoUrl(data.url ?? null);
                  toast.success('Logo enregistré');
                  router.refresh();
                  if (logoRef.current) logoRef.current.value = '';
                }}
              />
              <button
                type="button"
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.04]"
                onClick={() => logoRef.current?.click()}
              >
                Téléverser un logo
              </button>
              {logoUrl ? (
                <button
                  type="button"
                  className="text-left text-[12.5px] text-mute hover:text-ink"
                  onClick={async () => {
                    const res = await fetch('/api/dashboard/agence/logo', { method: 'DELETE' });
                    if (!res.ok) {
                      toast.error('Logo non retiré');
                      return;
                    }
                    setLogoUrl(null);
                    toast.success('Logo retiré');
                    router.refresh();
                  }}
                >
                  Retirer le logo
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="agency-name" className={labelClass}>
            Nom de l&apos;agence
          </label>
          <input id="agency-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="agency-nom-commercial" className={labelClass}>
            Nom commercial
          </label>
          <input
            id="agency-nom-commercial"
            className={inputClass}
            value={nomCommercial}
            onChange={(e) => setNomCommercial(e.target.value)}
            placeholder="Tel qu’il apparaît sur l’avis de valeur"
          />
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
          <PhoneInput
            id="agency-phone"
            className={inputClass}
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
        <div>
          <label htmlFor="agency-site" className={labelClass}>
            Site web
          </label>
          <input
            id="agency-site"
            className={inputClass}
            type="url"
            inputMode="url"
            value={siteWeb}
            onChange={(e) => setSiteWeb(e.target.value)}
            placeholder="https://www.agence.fr"
          />
        </div>
        <div>
          <label htmlFor="agency-couleur" className={labelClass}>
            Couleur principale
          </label>
          <div className="flex items-center gap-3">
            <input
              id="agency-couleur"
              type="color"
              className="size-11 shrink-0 cursor-pointer rounded-lg border border-black/10 bg-white p-1"
              value={/^#[0-9A-Fa-f]{6}$/.test(couleurPrincipale) ? couleurPrincipale : '#E8743C'}
              onChange={(e) => setCouleurPrincipale(e.target.value.toUpperCase())}
            />
            <input
              aria-label="Couleur principale en hexadécimal"
              className={`${inputClass} font-mono tabular-nums`}
              value={couleurPrincipale}
              onChange={(e) => setCouleurPrincipale(e.target.value)}
              placeholder="#E8743C"
            />
          </div>
          <p className="mt-1.5 text-pretty text-[12.5px] text-mute">
            Accent du rapport. Orange Priimo si le champ est vide ou invalide.
          </p>
        </div>

        <p className="flex items-center gap-2 text-[13px] text-mute">
          <label htmlFor="agency-frequence">Fréquence cible de passage</label>
          <input
            id="agency-frequence"
            type="number"
            min={2}
            max={52}
            className={`${inputClass} w-16 py-1.5`}
            value={frequenceSemaines}
            onChange={(e) =>
              setFrequenceSemaines(Number.parseInt(e.target.value, 10) || 12)
            }
          />
          <span>semaines</span>
        </p>

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

        <SectionModeleRapport />

        <SectionRequestSector />

        <button
          type="button"
          className="btn btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-start"
          style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
          onClick={save}
          disabled={!name.trim()}
        >
          Valider les modifications
        </button>
      </div>
    </section>
  );
}

function readAccueilVueCookie(): AccueilVue {
  if (typeof document === 'undefined') return 'directeur';
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACCUEIL_VUE_COOKIE}=([^;]*)`));
  return parseAccueilVue(match?.[1] ? decodeURIComponent(match[1]) : null);
}

function writeAccueilVueCookie(vue: AccueilVue) {
  const maxAge = 60 * 60 * 24 * 400;
  document.cookie = `${ACCUEIL_VUE_COOKIE}=${encodeURIComponent(vue)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function SectionProfile() {
  const { user, profile, isDirector } = useUser();
  const router = useRouter();
  const [firstName, setFirstName] = useState(profile.first_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [phone, setPhone] = useState(formatPhoneDisplay(profile.phone ?? ''));
  const [emailPro, setEmailPro] = useState(profile.email_pro ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url ?? null);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [accueilVue, setAccueilVue] = useState<AccueilVue>('directeur');

  useEffect(() => {
    setAccueilVue(readAccueilVueCookie());
  }, []);

  useEffect(() => {
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile.avatar_url]);

  const save = () => {
    const prenom = firstName.trim();
    const nom = lastName.trim();
    validerEnFond({
      succes: 'Profil mis à jour',
      echec: 'Erreur lors de la sauvegarde',
      ecrire: async () => {
        const supabase = createSupabaseBrowserClient();
        const payload = {
          first_name: prenom,
          last_name: nom,
          phone: phone.trim() || null,
          email_pro: emailPro.trim() || null,
        };
        let { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
        if (error && /email_pro/.test(error.message)) {
          const { email_pro: _e, ...sansEmail } = payload;
          ({ error } = await supabase.from('profiles').update(sansEmail).eq('id', user.id));
        }
        if (error) throw new Error('Erreur lors de la sauvegarde');
      },
      // Le nom se lit dans l'en-tête et le menu : la page les recale une fois
      // l'écriture passée.
      puis: () => router.refresh(),
    });
  };

  const initials =
    `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || '?';

  function enregistrerAvatar(url: string | null, opts?: { dejaEnregistre?: boolean }) {
    setAvatarUrl(url);
    if (opts?.dejaEnregistre) {
      toast.success('Avatar enregistré');
      router.refresh();
      return;
    }
    validerEnFond({
      succes: url ? 'Avatar enregistré' : 'Initiales rétablies',
      echec: 'Avatar non enregistré',
      ecrire: async () => {
        const res = await fetch('/api/dashboard/profile/avatar', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarUrl: url }),
        });
        if (!res.ok) throw new Error('Avatar non enregistré');
      },
      puis: () => router.refresh(),
    });
  }

  return (
    <section>
      <h2 className="mb-4 hidden font-semibold text-ink md:block sm:mb-6" style={{ fontSize: 18 }}>
        Mon profil
      </h2>
      <div className="flex w-full flex-col gap-5">
        <div className="max-w-xl">
          <p className={labelClass}>Photo</p>
          <AvatarChooser
            initials={initials}
            selected={avatarUrl}
            onChange={enregistrerAvatar}
          />
          <p className="mt-1.5 text-pretty text-mute" style={{ fontSize: 12 }}>
            Visible dans la barre et auprès de l’équipe. Le choix s’enregistre tout de suite.
          </p>
        </div>

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
            Email de connexion
          </label>
          <input id="profile-email" className={`${inputClass} bg-soft-gray/40`} value={user.email} readOnly />
          <p className="mt-1 text-mute" style={{ fontSize: 12 }}>
            Pour modifier votre adresse de connexion, contactez le support.
          </p>
        </div>
        <div>
          <label htmlFor="profile-email-pro" className={labelClass}>
            Email professionnel
          </label>
          <input
            id="profile-email-pro"
            className={inputClass}
            type="email"
            value={emailPro}
            onChange={(e) => setEmailPro(e.target.value)}
            placeholder={user.email}
          />
          <p className="mt-1 text-mute" style={{ fontSize: 12 }}>
            Affiché au pied de l’avis de valeur. Vide = e-mail de connexion.
          </p>
        </div>
        <div>
          <label htmlFor="profile-phone" className={labelClass}>
            Téléphone
          </label>
          <PhoneInput
            id="profile-phone"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <button
            type="button"
            className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
            onClick={save}
            disabled={!firstName.trim() || !lastName.trim()}
          >
            Valider
          </button>
          <button
            type="button"
            onClick={() => setPwdModalOpen(true)}
            className="w-full rounded-lg border border-black/10 bg-white px-4 py-2 font-medium text-ink transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] sm:w-auto"
            style={{ fontSize: 13 }}
          >
            Changer mon mot de passe
          </button>
        </div>

        {isDirector ? (
          <div className="rounded-xl border border-black/8 bg-soft-gray/30 px-4 py-3.5">
            <p className="font-medium text-ink" style={{ fontSize: 14 }}>
              Prévisualiser la vue Accueil agent
            </p>
            <p className="mt-1 text-pretty text-mute" style={{ fontSize: 13, lineHeight: 1.45 }}>
              Affiche l’Accueil comme un collaborateur : pile de tâches, pas le suivi d’équipe.
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-black/20 text-accent focus:ring-accent/30"
                checked={accueilVue === 'agent'}
                onChange={(e) => {
                  const next: AccueilVue = e.target.checked ? 'agent' : 'directeur';
                  setAccueilVue(next);
                  writeAccueilVueCookie(next);
                  toast.success(
                    next === 'agent'
                      ? 'Vue agent activée sur l’Accueil'
                      : 'Vue directeur rétablie sur l’Accueil',
                  );
                  router.refresh();
                }}
              />
              <span className="text-[13.5px] text-ink">Voir l’Accueil en tant qu’agent</span>
            </label>
          </div>
        ) : null}

        <div className="border-t border-black/8 pt-5">
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2.5 text-[13.5px] font-medium text-ink transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] sm:w-auto"
            >
              <LogOut size={16} strokeWidth={2} aria-hidden />
              Se déconnecter
            </button>
          </form>
        </div>
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
            {saving ? 'Validation…' : 'Mettre à jour'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
