'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, LogOut, Trash2, UserPlus, X } from 'lucide-react';
import { mockAgents } from '@/lib/mock-data';
import { useDashboardRole } from '@/components/dashboard/DashboardRoleContext';

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

const AGENT_TAB_LIST: { id: SettingsTabId; label: string }[] = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'profile', label: 'Mon profil' },
  { id: 'security', label: 'Sécurité' },
];

function firstSettingsTab(isDirector: boolean): SettingsTabId {
  return isDirector ? 'agency' : 'notifications';
}

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
  const { isDirector } = useDashboardRole();
  const tabs = useMemo(() => (isDirector ? DIRECTOR_TAB_LIST : AGENT_TAB_LIST), [isDirector]);

  const [activeTab, setActiveTab] = useState<SettingsTabId>('agency');
  const [mobileOpen, setMobileOpen] = useState<SettingsTabId | null>('agency');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const first = firstSettingsTab(isDirector);
    setActiveTab(first);
    setMobileOpen(first);
  }, [isDirector]);

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
          className="fixed right-4 top-6 z-[200] flex items-center gap-2 rounded-lg px-4 py-3 font-medium text-white shadow-lg max-md:right-4 max-md:top-auto max-md:bottom-24"
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

      <div className="mb-6 flex flex-col gap-0 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-soft md:hidden">
        {tabs.map(({ id, label }) => {
          const open = mobileOpen === id;
          return (
            <div key={id} className="border-b border-black/8 last:border-b-0">
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center justify-between px-4 py-3 text-left"
                onClick={() => setMobileOpen((o) => (o === id ? null : id))}
                aria-expanded={open}
              >
                <span className="font-semibold text-ink" style={{ fontSize: 16 }}>
                  {label}
                </span>
                <ChevronDown size={20} className={`text-mute transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {open && (
                <div className="border-t border-black/[0.06] bg-white px-4 py-5">
                  {id === 'agency' && <SectionAgency onSaved={showSaved} />}
                  {id === 'team' && <SectionTeam onSaved={showSaved} />}
                  {id === 'billing' && <SectionBilling onSaved={showSaved} />}
                  {id === 'notifications' && <SectionNotifications onSaved={showSaved} />}
                  {id === 'profile' && <SectionProfile onSaved={showSaved} />}
                  {id === 'security' && <SectionSecurity onSaved={showSaved} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-soft md:flex md:flex-row">
        <nav
          className="flex flex-shrink-0 flex-col gap-0.5 border-b border-black/8 bg-soft-gray/40 p-3 lg:w-52 lg:border-b-0 lg:border-r"
          aria-label="Sections paramètres"
        >
          {tabs.map(({ id, label }) => {
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
          {activeTab === 'billing' && <SectionBilling onSaved={showSaved} />}
          {activeTab === 'notifications' && <SectionNotifications onSaved={showSaved} />}
          {activeTab === 'profile' && <SectionProfile onSaved={showSaved} />}
          {activeTab === 'security' && <SectionSecurity onSaved={showSaved} />}
        </div>
      </div>

      <div className="mt-8 border-t border-black/8 pt-6">
        <button
          type="button"
          className="flex min-h-[48px] w-full max-w-xl items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-[15px] font-semibold text-red-700 transition-colors hover:bg-red-50"
          onClick={() => {
            console.log('[Settings] Déconnexion');
          }}
        >
          <LogOut size={20} strokeWidth={2} aria-hidden />
          Déconnexion
        </button>
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

  const remove = (row: TeamRow, displayName: string) => {
    if (row.role === 'Directeur') return;
    if (!window.confirm(`Retirer ${displayName} de l’équipe ?`)) return;
    setRows((r) => r.filter((x) => x.id !== row.id));
    console.log('[Settings] Agent supprimé', row.id);
    onSaved('Agent retiré');
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const submitInvite = () => {
    const trimmed = inviteEmail.trim();
    if (!trimmed || !EMAIL_RE.test(trimmed)) return;
    const id = `invite-${Date.now()}`;
    setRows((r) => [
      ...r,
      {
        id,
        firstName: 'Invitation',
        lastName: 'en attente',
        email: trimmed,
        role: 'Agent',
        status: 'Invité',
      },
    ]);
    console.log('[Settings] Invitation envoyée', { email: trimmed, role: 'Agent' });
    setInviteOpen(false);
    setInviteEmail('');
    onSaved('Invitation envoyée');
  };

  const statusLabel = (s: TeamStatus) => (s === 'Invité' ? 'Invitation envoyée' : s);

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
                    {statusLabel(row.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {row.role === 'Directeur' ? (
                    <span className="text-mute" style={{ fontSize: 12 }}>
                      —
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[12px] font-medium text-red-700 transition-colors hover:bg-red-50"
                      onClick={() => remove(row, `${row.firstName} ${row.lastName}`)}
                    >
                      <Trash2 size={14} strokeWidth={2} aria-hidden />
                      Supprimer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/25 p-4" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title">
          <div className="relative w-full max-w-md rounded-2xl border border-black/8 bg-white p-6 shadow-xl">
            <button
              type="button"
              className="absolute right-4 top-4 rounded-lg p-1 text-mute hover:bg-black/[0.05] hover:text-ink"
              onClick={() => setInviteOpen(false)}
              aria-label="Fermer"
            >
              <X size={18} strokeWidth={2} />
            </button>
            <h3 id="invite-dialog-title" className="pr-8 font-semibold text-ink" style={{ fontSize: 17 }}>
              Inviter un agent
            </h3>
            <p className="mt-1 text-mute" style={{ fontSize: 13 }}>
              Un email d&apos;invitation sera envoyé (simulation). Rôle : Agent.
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
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-black/10 px-4 py-2 text-[13px] font-medium text-mute hover:bg-black/[0.03]"
                onClick={() => setInviteOpen(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 10 }}
                onClick={submitInvite}
              >
                Envoyer l&apos;invitation
              </button>
            </div>
          </div>
        </div>
      )}

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

      <div className="max-w-xl rounded-2xl border border-black/8 bg-white p-6 shadow-soft">
        <p className="font-semibold text-ink" style={{ fontSize: 16 }}>
          Votre accès Priimo
        </p>
        <p className="mt-2 text-mute" style={{ fontSize: 14, lineHeight: 1.55 }}>
          Les formules et tarifs publics ne sont pas encore publiés. Vous êtes actuellement en{' '}
          <span className="font-medium text-ink">bêta privée</span>. Pour modifier votre abonnement,
          votre moyen de paiement ou consulter vos factures, utilisez le bouton ci-dessous : nous vous enverrons un{' '}
          <span className="font-medium text-ink">lien sécurisé Stripe</span> (portail client) par e-mail à l’adresse de
          votre agence.
        </p>
        <button
          type="button"
          className="btn btn-primary mt-6 w-full min-h-[48px] sm:w-auto"
          style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
          onClick={() => {
            console.log('[Settings] Envoi lien portail Stripe (simulation)');
            onSaved('Un lien Stripe vient de vous être envoyé par e-mail.');
          }}
        >
          Modifier mon abonnement
        </button>
      </div>
    </section>
  );
}

/* ——— Mon profil ——— */

function SectionProfile({ onSaved }: { onSaved: (msg?: string) => void }) {
  const [firstName, setFirstName] = useState('Alexandre');
  const [lastName, setLastName] = useState('Martin');
  const [email, setEmail] = useState('a.martin@agencetest.fr');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

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
        Mon profil
      </h2>
      <div className="flex max-w-xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Prénom</label>
            <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </div>
          <div>
            <label className={labelClass}>Nom</label>
            <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <button
            type="button"
            className="btn btn-primary self-start"
            style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
            onClick={() => onSaved('Profil enregistré')}
          >
            Enregistrer le profil
          </button>
        </div>

        <div className="h-px bg-black/[0.08]" />

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
      </div>
    </section>
  );
}

/* ——— Notifications ——— */

function SectionNotifications({ onSaved }: { onSaved: (msg?: string) => void }) {
  const [emailLeads, setEmailLeads] = useState(true);
  const [freq, setFreq] = useState('Hebdomadaire');
  const [alert90, setAlert90] = useState(true);
  const [notificationEmails, setNotificationEmails] = useState<string[]>(['contact@agencetest.fr']);
  const [newEmail, setNewEmail] = useState('');

  const addEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return;
    }
    if (notificationEmails.some((e) => e.toLowerCase() === trimmed)) {
      setNewEmail('');
      return;
    }
    setNotificationEmails((prev) => [...prev, trimmed]);
    setNewEmail('');
  };

  const removeEmail = (addr: string) => {
    setNotificationEmails((prev) => prev.filter((e) => e !== addr));
  };

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
          <label className={labelClass}>Adresses e-mail (équipe)</label>
          <p className="mb-3 text-mute" style={{ fontSize: 13, lineHeight: 1.45 }}>
            Ajoutez les adresses qui doivent recevoir les notifications (collaborateurs, direction, assistantes…).
            Les options ci-dessus s’appliquent à toutes ces adresses.
          </p>
          <ul className="mb-3 flex flex-col gap-2">
            {notificationEmails.map((addr) => (
              <li
                key={addr}
                className="flex min-h-[48px] items-center justify-between gap-3 rounded-lg border border-black/8 bg-soft-gray/30 px-3 py-2"
              >
                <span className="min-w-0 truncate font-medium text-ink" style={{ fontSize: 14 }}>
                  {addr}
                </span>
                <button
                  type="button"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-mute transition-colors hover:bg-red-50 hover:text-red-700"
                  aria-label={`Retirer ${addr}`}
                  onClick={() => removeEmail(addr)}
                >
                  <Trash2 size={18} strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              className={inputClass}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ex. prenom.nom@agence.fr"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addEmail();
                }
              }}
            />
            <button
              type="button"
              className="flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-lg border border-black/15 bg-white px-4 text-[14px] font-semibold text-ink transition-colors hover:border-accent/40 hover:bg-soft-warm/40"
              onClick={addEmail}
            >
              <UserPlus size={18} strokeWidth={2} aria-hidden />
              Ajouter
            </button>
          </div>
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
    <div className="flex cursor-default items-center justify-between gap-4 rounded-lg border border-black/8 bg-soft-gray/30 px-4 py-3">
      <span className="font-medium text-gray-700" style={{ fontSize: 14 }}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-black/15'}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'left-5' : 'left-0.5'}`}
        />
      </button>
    </div>
  );
}

/* ——— Sécurité ——— */

function SectionSecurity({ onSaved }: { onSaved: (msg?: string) => void }) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <section>
      <h2 className="mb-6 font-semibold text-ink" style={{ fontSize: 18 }}>
        Sécurité
      </h2>
      <div className="flex max-w-xl flex-col gap-8">
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
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/25 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-6 shadow-xl">
            <h3 id="delete-dialog-title" className="font-semibold text-ink" style={{ fontSize: 17 }}>
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
