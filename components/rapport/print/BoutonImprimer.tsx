'use client';

export default function BoutonImprimer() {
  return (
    <button
      type="button"
      className="avis-no-print"
      onClick={() => window.print()}
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 20,
        minHeight: 44,
        padding: '0 16px',
        border: '1px solid rgba(10,13,17,0.12)',
        borderRadius: 12,
        background: '#fff',
        color: '#0A0D11',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Imprimer
    </button>
  );
}
