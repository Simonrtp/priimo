export default function SubscriptionSection() {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-black/8 p-7">
      <p className="font-bold text-ink tracking-tight mb-5" style={{ fontSize: 17, letterSpacing: '-0.02em' }}>
        Mon abonnement
      </p>

      {/* Plan card */}
      <div className="bg-soft-warm border border-accent/20 rounded-2xl p-5 mb-5 flex items-center justify-between">
        <div>
          <p className="font-bold text-ink" style={{ fontSize: 15, letterSpacing: '-0.01em' }}>
            Plan Fondateur
          </p>
          <p className="text-mute mt-0.5" style={{ fontSize: 13 }}>149 €/mois</p>
        </div>
        <span
          className="bg-accent text-white font-semibold rounded-full"
          style={{ fontSize: 10.5, padding: '3px 10px', letterSpacing: '0.02em' }}
        >
          Tarif à vie
        </span>
      </div>

      <button
        disabled
        className="border border-black/10 rounded-xl text-mute font-medium opacity-50 cursor-not-allowed"
        style={{ padding: '9px 18px', fontSize: 13 }}
      >
        Gérer mon abonnement
      </button>

      <p className="text-mute italic mt-3" style={{ fontSize: 11.5 }}>
        Bientôt disponible — connexion Stripe en cours d&apos;intégration.
      </p>
    </div>
  );
}
