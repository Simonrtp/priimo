'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, MapPin, Trash2, UserPlus, X } from 'lucide-react';
import { mockAgents } from '@/lib/mock-data';

const inputClass =
  'w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

const labelClass = 'mb-1.5 block font-medium text-gray-700';

type TabId = 'agency' | 'team' | 'zone' | 'billing' | 'notifications' | 'security';

const TABS: { id: TabId; label: string }[] = [
  { id: 'agency', label: 'Mon agence' },
  { id: 'team', label: 'Mon équipe' },
  { id: 'zone', label: 'Ma zone' },
  { id: 'billing', label: 'Abonnement' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Sécurité' },
];

type TeamRole = 'Directeur' | 'Agent';
type TeamStatus = 'Actif' | 'Invité';

interface TeamRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: TeamRole;
  status: TeamStatus;
}

const AGENT_EMAILS: Record<string, string> = {
  'agent-1': 'marie.dupont@agencetest.fr',
  'agent-2': 'thomas.bernard@agencetest.fr',
  'agent-3': 'lea.martin@agencetest.fr',
  'agent-4': 'julien.petit@agencetest.fr',
};

function buildInitialTeam(): TeamRow[] {
  return mockAgents.map((a, i) => ({
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    email: AGENT_EMAILS[a.id] ?? `${a.id}@agencetest.fr`,
    role: (i === 0 ? 'Directeur' : 'Agent') as TeamRole,
    status: 'Actif' as TeamStatus,
  }));
}

export default function SettingsDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('agency');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const showSaved = useCallback((msg = 'Modifications enregistrées') => {
    console.log('[Settings]', msg);
    setToast(msg);
  }, []);

  return (
    <div className="relative max-w-5xl">
      {toast && (
        <div
          className="fixed right-6 top-6 z-[200] flex items-center gap-2 rounded-lg px-4 py-3 font-medium text-white shadow-lg"
          style={{ backgroundColor: '#059669', fontSize: 14 }}
          role="status"
        >
          <Check size={18} strokeWidth={2} aria-hidden />
          {toast}
        </div>
      )}

      <header className="mb-6">
        <h1 className="font-semibold tracking-tight text-ink" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>
          Paramètres
        </h1>
        <p className="mt-1 text-mute" style={{ fontSize: 14 }}>
          Gérez votre agence, votre équipe et vos préférences.
        </p>
      </header>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-soft lg:flex-row">
        <nav
          className="flex flex-shrink-0 flex-col gap-0.5 border-b border-black/8 bg-soft-gray/40 p-3 lg:w-52 lg:border-b-0 lg:border-r"
          aria-label="Sections paramètres"
        >
          {TABS.map(({ id, label }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`rounded-lg px-3 py-2.5 text-left text-[14px] font-medium transition-colors ${
                  active ? 'bg-white text-ink shadow-sm ring-1 ring-black/6' : 'text-mute hover:bg-white/60 hover:text-ink'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 p-6 sm:p-8">
          {activeTab === 'agency' && <SectionAgency onSaved={showSaved} />}
          {activeTab === 'team' && <SectionTeam onSaved={showSaved} />}
          {activeTab === 'zone' && <SectionZone onSaved={showSaved} />}
          {activeTab === 'billing' && <SectionBilling onSaved={showSaved} />}
          {activeTab === 'notifications' && <SectionNotifications onSaved={showSaved} />}
          {activeTab === 'security' && <SectionSecurity onSaved={showSaved} />}
        </div>
      </div>
    </div>
  );
}

/* ——— Mon agence ——— */

function SectionAgency({ onSaved }: { onSaved: (msg?: string) => void }) {
  const [name, setName] = useState('Agence Test');
  const [address, setAddress] = useState('14 avenue d’Italie, 75013 Paris');
  const [phone, setPhone] = useState('01 42 86 12 34');
  const [email, setEmail] = useState('contact@agencetest.fr');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  };

  return (
    <section>
      <h2 className="mb-6 font-semibold text-ink" style={{ fontSize: 18 }}>
        Mon agence
      </h2>
      <div className="flex max-w-xl flex-col gap-5">
        <div>
          <label className={labelClass}>Nom de l&apos;agence</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Adresse postale</label>
          <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Téléphone</label>
          <input className={inputClass} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Email de contact</label>
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Logo</label>
          <div className="flex flex-wrap items-start gap-4">
            <label className="inline-flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-black/15 bg-soft-gray/50 px-6 py-8 text-center transition-colors hover:border-accent/40">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
              <span className="text-mute" style={{ fontSize: 13 }}>
                Cliquez pour simuler un envoi
              </span>
            </label>
            {logoPreview && (
              <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-black/10">
                <img src={logoPreview} alt="Aperçu logo" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        </div>
        <div>
          <label className={labelClass}>Numéro SIRET</label>
          <input
            className={`${inputClass} cursor-not-allowed bg-black/[0.03] text-mute`}
            readOnly
            value="879 123 456 00015"
          />
          <p className="mt-1 text-mute" style={{ fontSize: 12 }}>
            Ce champ est verrouillé. Contactez le support pour toute modification.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary mt-2 self-start"
          style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
          onClick={() => onSaved()}
        >
          Enregistrer les modifications
        </button>
      </div>
    </section>
  );
}

/* ——— Mon équipe ——— */

function SectionTeam({ onSaved }: { onSaved: (msg?: string) => void }) {
  const [rows, setRows] = useState<TeamRow[]>(buildInitialTeam);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('Agent');

  const remove = (id: string, name: string) => {
    if (!window.confirm(`Retirer ${name} de l’équipe ?`)) return;
    setRows((r) => r.filter((x) => x.id !== id));
    console.log('[Settings] Agent supprimé', id);
    onSaved('Agent retiré');
  };

  const submitInvite = () => {
    if (!inviteEmail.trim()) return;
    const id = `invite-${Date.now()}`;
    const local = inviteEmail.split('@')[0] ?? 'invité';
    setRows((r) => [
      ...r,
      {
        id,
        firstName: 'Invitation',
        lastName: 'en attente',
        email: inviteEmail.trim(),
        role: inviteRole,
        status: 'Invité',
      },
    ]);
    console.log('[Settings] Invitation envoyée', { email: inviteEmail, role: inviteRole });
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('Agent');
    onSaved('Invitation enregistrée');
  };

  return (
    <section>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-ink" style={{ fontSize: 18 }}>
          Mon équipe
        </h2>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:border-accent/40 hover:bg-soft-warm/50"
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus size={16} strokeWidth={2} aria-hidden />
          Inviter un agent
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/8">
        <table className="w-full min-w-[520px] text-left" style={{ fontSize: 13 }}>
          <thead>
            <tr className="border-b border-black/[0.06] bg-soft-gray/30 text-mute">
              <th className="px-4 py-3 font-medium">Prénom</th>
              <th className="px-3 py-3 font-medium">Nom</th>
              <th className="px-3 py-3 font-medium">Email</th>
              <th className="px-3 py-3 font-medium">Rôle</th>
              <th className="px-3 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-black/[0.05] last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{row.firstName}</td>
                <td className="px-3 py-3 text-ink">{row.lastName}</td>
                <td className="max-w-[200px] truncate px-3 py-3 text-mute">{row.email}</td>
                <td className="px-3 py-3 text-ink">{row.role}</td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      row.status === 'Actif' ? 'bg-emerald-500/10 text-emerald-800' : 'bg-amber-500/10 text-amber-900'
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[12px] font-medium text-red-700 transition-colors hover:bg-red-50"
                    onClick={() => remove(row.id, `${row.firstName} ${row.lastName}`)}
                  >
                    <Trash2 size={14} strokeWidth={2} aria-hidden />
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/25 p-4" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-md rounded-2xl border border-black/8 bg-white p-6 shadow-xl">
            <button
              type="button"
              className="absolute right-4 top-4 rounded-lg p-1 text-mute hover:bg-black/[0.05] hover:text-ink"
              onClick={() => setInviteOpen(false)}
              aria-label="Fermer"
            >
              <X size={18} strokeWidth={2} />
            </button>
            <h3 className="pr-8 font-semibold text-ink" style={{ fontSize: 17 }}>
              Inviter un agent
            </h3>
            <p className="mt-1 text-mute" style={{ fontSize: 13 }}>
              Un email d&apos;invitation sera envoyé (simulation).
            </p>
            <div className="mt-5 flex flex-col gap-4">
              <div>
                <label className={labelClass}>Email</label>
                <input
                  className={inputClass}
                  type="email"
                  placeholder="prenom.nom@exemple.fr"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Rôle</label>
                <select
                  className={inputClass}
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                >
                  <option value="Agent">Agent</option>
                  <option value="Directeur">Directeur</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-black/10 px-4 py-2 text-[13px] font-medium text-mute hover:bg-black/[0.03]"
                onClick={() => setInviteOpen(false)}
              >
                Annuler
              </button>
              <button type="button" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13, borderRadius: 10 }} onClick={submitInvite}>
                Envoyer l&apos;invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ——— Ma zone ——— */

function SectionZone({ onSaved }: { onSaved: (msg?: string) => void }) {
  const [center, setCenter] = useState('14 avenue d’Italie, 75013 Paris');
  const [radius, setRadius] = useState(5);

  return (
    <section>
      <h2 className="mb-6 font-semibold text-ink" style={{ fontSize: 18 }}>
        Ma zone
      </h2>
      <div className="flex max-w-xl flex-col gap-5">
        <div>
          <label className={labelClass}>Adresse du centre de la zone</label>
          <input className={inputClass} value={center} onChange={(e) => setCenter(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Rayon de prospection (km)</label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={15}
              step={1}
              value={radius}
              onChange={(e) => setRadius(+e.target.value)}
              className="h-2 flex-1 cursor-pointer accent-accent"
            />
            <input
              type="number"
              min={1}
              max={15}
              value={radius}
              onChange={(e) => setRadius(Math.min(15, Math.max(1, +e.target.value || 1)))}
              className={`${inputClass} w-20 tabular`}
            />
          </div>
        </div>

        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-black/8 bg-soft-gray text-mute"
          style={{ minHeight: 200 }}
        >
          <MapPin size={28} strokeWidth={2} className="text-mute opacity-80" aria-hidden />
          <p className="max-w-xs text-center" style={{ fontSize: 13, lineHeight: 1.5 }}>
            Aperçu de votre zone — bientôt disponible
          </p>
        </div>

        <ul className="rounded-xl border border-black/8 bg-soft-gray/40 px-4 py-3 text-[13px] text-ink">
          <li className="flex justify-between border-b border-black/[0.06] py-2 last:border-0">
            <span className="text-mute">Nombre de biens couverts</span>
            <span className="font-semibold tabular">~1 240</span>
          </li>
          <li className="flex justify-between border-b border-black/[0.06] py-2 last:border-0">
            <span className="text-mute">Part en SCI / SARL</span>
            <span className="font-semibold tabular">34 %</span>
          </li>
          <li className="flex items-center justify-between py-2">
            <span className="text-mute">Exclusivité</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
              <Check size={16} strokeWidth={2} className="text-emerald-600" aria-hidden />
              Aucune autre agence sur cette zone
            </span>
          </li>
        </ul>

        <button
          type="button"
          className="btn btn-primary self-start"
          style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
          onClick={() => onSaved()}
        >
          Enregistrer la zone
        </button>
      </div>
    </section>
  );
}

/* ——— Abonnement ——— */

function SectionBilling({ onSaved }: { onSaved: (msg?: string) => void }) {
  return (
    <section>
      <h2 className="mb-6 font-semibold text-ink" style={{ fontSize: 18 }}>
        Abonnement
      </h2>

      <div className="mb-8 rounded-2xl border border-accent/30 bg-soft-warm/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-bold text-ink" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>
              Plan Fondateur — 100&nbsp;€/mois
            </p>
            <p className="mt-2 text-mute" style={{ fontSize: 14 }}>
              Prochain renouvellement : <span className="font-medium text-ink">12 juin 2026</span>
            </p>
          </div>
          <span
            className="rounded-full font-semibold uppercase tracking-wide text-white"
            style={{ backgroundColor: '#E8743C', fontSize: 10, padding: '6px 12px', letterSpacing: '0.08em' }}
          >
            À vie
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '10px 18px', fontSize: 14, borderRadius: 10 }}
            onClick={() => {
              console.log('[Settings] Gérer mon abonnement → Stripe Customer Portal');
              onSaved('Préférences enregistrées');
            }}
          >
            Gérer mon abonnement
          </button>
          <button
            type="button"
            className="rounded-lg border border-black/15 bg-white px-4 py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-black/25"
            onClick={() => {
              console.log('[Settings] Voir mes factures');
              onSaved('Préférences enregistrées');
            }}
          >
            Voir mes factures
          </button>
        </div>
      </div>

      <h3 className="mb-4 font-semibold text-ink" style={{ fontSize: 15 }}>
        Comparer les offres
      </h3>
      <div className="grid gap-4 md:grid-cols-3">
        <PlanCard
          name="Standard"
          price="199 €/mois"
          highlight
          lines={['1 zone', '~15–30 leads / mois', 'Sans module SCI']}
          cta="Votre plan"
          ctaDisabled
        />
        <PlanCard
          name="Premium"
          price="349 €/mois"
          lines={['1 zone', '~15–30 leads / mois', 'Module SCI complet']}
          cta="Upgrade"
          onCta={() => {
            console.log('[Settings] Upgrade Premium');
            onSaved('Demande enregistrée');
          }}
        />
        <PlanCard
          name="Réseau"
          price="Sur devis"
          lines={['Multi-zones', 'Volume sur mesure', 'Module SCI + API']}
          cta="Contacter"
          onCta={() => {
            console.log('[Settings] Contacter commercial Réseau');
            onSaved('Demande enregistrée');
          }}
        />
      </div>
      <p className="mt-4 text-mute" style={{ fontSize: 12 }}>
        Votre tarif fondateur reste inchangé. Le comparatif reflète les offres publiques actuelles.
      </p>
    </section>
  );
}

function PlanCard({
  name,
  price,
  lines,
  cta,
  highlight,
  ctaDisabled,
  onCta,
}: {
  name: string;
  price: string;
  lines: string[];
  cta: string;
  highlight?: boolean;
  ctaDisabled?: boolean;
  onCta?: () => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border bg-white p-5 ${
        highlight ? 'border-2 border-accent shadow-md ring-1 ring-accent/20' : 'border border-black/8 shadow-soft'
      }`}
    >
      <p className="font-semibold text-ink" style={{ fontSize: 16 }}>
        {name}
      </p>
      <p className="mt-1 font-bold text-accent-dark" style={{ fontSize: 18 }}>
        {price}
      </p>
      <ul className="mt-4 flex flex-1 flex-col gap-2 text-mute" style={{ fontSize: 13, lineHeight: 1.5 }}>
        {lines.map((l) => (
          <li key={l}>• {l}</li>
        ))}
      </ul>
      <button
        type="button"
        disabled={ctaDisabled}
        className={`mt-6 w-full rounded-lg py-2.5 text-[13px] font-semibold transition-colors ${
          ctaDisabled
            ? 'cursor-default border border-accent/40 bg-accent/10 text-accent-dark'
            : 'btn btn-primary'
        }`}
        style={ctaDisabled ? { borderRadius: 10 } : { borderRadius: 10, padding: '10px 14px' }}
        onClick={() => {
          if (!ctaDisabled) onCta?.();
        }}
      >
        {cta}
      </button>
    </div>
  );
}

/* ——— Notifications ——— */

function SectionNotifications({ onSaved }: { onSaved: (msg?: string) => void }) {
  const [emailLeads, setEmailLeads] = useState(true);
  const [freq, setFreq] = useState('Hebdomadaire');
  const [alert90, setAlert90] = useState(true);
  const [alertEmail, setAlertEmail] = useState('contact@agencetest.fr');

  return (
    <section>
      <h2 className="mb-6 font-semibold text-ink" style={{ fontSize: 18 }}>
        Notifications
      </h2>
      <div className="flex max-w-xl flex-col gap-6">
        <ToggleRow
          label="Recevoir les nouveaux leads par email"
          checked={emailLeads}
          onChange={setEmailLeads}
        />
        <div>
          <label className={labelClass}>Fréquence des rapports</label>
          <select className={inputClass} value={freq} onChange={(e) => setFreq(e.target.value)}>
            <option>Quotidien</option>
            <option>Hebdomadaire</option>
            <option>Mensuel</option>
            <option>Désactivé</option>
          </select>
        </div>
        <ToggleRow label="Alerte immédiate pour les leads score ≥ 90" checked={alert90} onChange={setAlert90} />
        <div>
          <label className={labelClass}>Email de réception des alertes</label>
          <input className={inputClass} type="email" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn btn-primary self-start"
          style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
          onClick={() => onSaved()}
        >
          Enregistrer les préférences
        </button>
      </div>
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-black/8 bg-soft-gray/30 px-4 py-3">
      <span className="font-medium text-gray-700" style={{ fontSize: 14 }}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-black/15'}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'left-5' : 'left-0.5'}`}
        />
      </button>
    </label>
  );
}

/* ——— Sécurité ——— */

function SectionSecurity({ onSaved }: { onSaved: (msg?: string) => void }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const savePw = () => {
    console.log('[Settings] Changement mot de passe (simulation)', { oldPw: '***', newPw: '***' });
    setOldPw('');
    setNewPw('');
    setConfirmPw('');
    onSaved('Mot de passe mis à jour');
  };

  return (
    <section>
      <h2 className="mb-6 font-semibold text-ink" style={{ fontSize: 18 }}>
        Sécurité
      </h2>
      <div className="flex max-w-xl flex-col gap-8">
        <div>
          <h3 className="mb-4 font-medium text-ink" style={{ fontSize: 15 }}>
            Mot de passe
          </h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Mot de passe actuel</label>
              <input className={inputClass} type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Nouveau mot de passe</label>
              <input className={inputClass} type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Confirmer le nouveau mot de passe</label>
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary mt-4"
            style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
            onClick={savePw}
          >
            Mettre à jour le mot de passe
          </button>
        </div>

        <div className="h-px bg-black/[0.08]" />

        <div>
          <h3 className="mb-2 font-medium text-ink" style={{ fontSize: 15 }}>
            Sessions
          </h3>
          <p className="mb-3 text-mute" style={{ fontSize: 13, lineHeight: 1.55 }}>
            Déconnectez tous les appareils connectés à votre compte (ordinateurs, tablettes, mobiles).
          </p>
          <button
            type="button"
            className="rounded-lg border border-black/15 bg-white px-4 py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-black/25"
          onClick={() => {
            console.log('[Settings] Déconnexion de tous les appareils');
            onSaved('Sessions révoquées');
          }}
          >
            Se déconnecter de tous les appareils
          </button>
        </div>

        <div className="h-px bg-black/[0.08]" />

        <div>
          <button type="button" className="text-[13px] font-medium text-red-700 underline-offset-2 hover:underline" onClick={() => setDeleteOpen(true)}>
            Supprimer mon compte
          </button>
        </div>
      </div>

      {deleteOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/25 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-ink" style={{ fontSize: 17 }}>
              Suppression de compte
            </h3>
            <p className="mt-3 text-mute" style={{ fontSize: 14, lineHeight: 1.6 }}>
              Pour supprimer définitivement votre compte et vos données, contactez{' '}
              <a href="mailto:support@priimo.fr" className="font-medium text-accent-dark underline">
                support@priimo.fr
              </a>
              .
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '8px 18px', fontSize: 13, borderRadius: 10 }}
                onClick={() => setDeleteOpen(false)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
