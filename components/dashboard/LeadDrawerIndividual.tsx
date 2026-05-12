'use client';

export default function LeadDrawerIndividual() {
  return (
    <div
      className="rounded-xl border border-black/[0.06] bg-soft-gray/60 px-4 py-4 text-mute"
      style={{ fontSize: 12.5, lineHeight: 1.6 }}
    >
      <p className="font-semibold text-ink mb-2" style={{ fontSize: 13 }}>
        🔒 Conformité RGPD
      </p>
      <p className="mb-2">
        Les coordonnées personnelles des particuliers ne sont jamais affichées.
      </p>
      <p className="text-ink/90">
        Action recommandée : porte-à-porte ou courrier ciblé à l’adresse ci-dessus.
      </p>
    </div>
  );
}
