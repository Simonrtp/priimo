'use client';

import { Component, type ReactNode } from 'react';

/** Une action ratée reste dans Priimo, avec un moyen de reprendre. */
export default function EcranReprise({
  onRetry,
  titre = 'Cette page n’a pas pu s’afficher.',
  detail = 'Rechargez pour reprendre. Vos données sont toujours là.',
  action = 'Recharger',
  lien,
}: {
  onRetry: () => void;
  titre?: string;
  detail?: string;
  action?: string;
  lien?: { href: string; libelle: string };
}) {
  return (
    <div
      role="alert"
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        width: '100%',
        minHeight: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#eef1fb',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 28,
          padding: '28px 24px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(26, 42, 86, 0.08)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1A2A56', lineHeight: 1.35 }}>{titre}</h1>
        <p style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.45, color: '#5c6578' }}>{detail}</p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 22,
            height: 44,
            padding: '0 22px',
            border: 0,
            borderRadius: 999,
            background: '#1A2A56',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14.5,
            cursor: 'pointer',
          }}
        >
          {action}
        </button>
        {lien ? (
          <a
            href={lien.href}
            style={{
              display: 'block',
              marginTop: 14,
              color: '#1A2A56',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'underline',
            }}
          >
            {lien.libelle}
          </a>
        ) : null}
      </div>
    </div>
  );
}

type LimiteProps = {
  children: ReactNode;
  titre?: string;
  detail?: string;
  action?: string;
};

type LimiteState = { erreur: boolean };

/** Filet local : un rendu cassé ne remplace pas toute l'application. */
export class LimiteErreur extends Component<LimiteProps, LimiteState> {
  state: LimiteState = { erreur: false };

  static getDerivedStateFromError(): LimiteState {
    return { erreur: true };
  }

  componentDidCatch(error: Error): void {
    console.error(error);
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <EcranReprise
        titre={this.props.titre ?? 'Ça n’a pas pu s’afficher.'}
        detail={this.props.detail ?? 'Réessayez. Rien n’est perdu.'}
        action={this.props.action ?? 'Réessayer'}
        onRetry={() => this.setState({ erreur: false })}
      />
    );
  }
}
