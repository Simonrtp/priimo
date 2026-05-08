export default function SubscriptionSection() {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-[8px] p-6">
      <p className="font-semibold tracking-tight text-gray-900 mb-4" style={{ fontSize: '20px' }}>
        Mon abonnement
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-[8px] p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900" style={{ fontSize: '16px' }}>
            Plan Fondateur
          </p>
          <p className="text-gray-700" style={{ fontSize: '14px' }}>
            149 €/mois
          </p>
        </div>
        <span
          className="bg-[#2563EB] text-white font-medium rounded-[4px]"
          style={{ fontSize: '11px', padding: '2px 8px' }}
        >
          Tarif à vie
        </span>
      </div>

      <button
        disabled
        className="border border-[#E5E5E5] rounded-[6px] bg-white font-semibold text-gray-700 opacity-50 cursor-not-allowed"
        style={{ padding: '10px 16px', fontSize: '14px' }}
      >
        Gérer mon abonnement
      </button>

      <p className="text-gray-500 italic mt-3" style={{ fontSize: '12px' }}>
        Bientôt disponible — connexion Stripe en cours d&apos;intégration.
      </p>
    </div>
  );
}
