'use client';

export default function AvisPublicBarre({ pdfHref }: { pdfHref: string }) {
  return (
    <div
      className="avis-no-print"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 20,
        display: 'flex',
        gap: 8,
      }}
    >
      <a
        href={pdfHref}
        style={{
          minHeight: 44,
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 16px',
          border: '1px solid rgba(10,13,17,0.12)',
          borderRadius: 12,
          background: '#fff',
          color: '#0A0D11',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Télécharger le PDF
      </a>
    </div>
  );
}
