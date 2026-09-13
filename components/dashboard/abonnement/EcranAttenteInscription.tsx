/**
 * L’agence est née, le secteur n’est pas encore chargé.
 * On ne dramatise pas : c’est une file, pas un refus.
 */
export default function EcranAttenteInscription({ refusee = false }: { refusee?: boolean }) {
  return (
    <section className="rounded-clay-lg bg-white px-5 py-6 shadow-clay">
      <h1 className="text-balance text-[20px] font-semibold tracking-tight text-ink">
        {refusee ? 'Cette demande n’a pas été retenue' : 'Votre agence est prête'}
      </h1>
      <p className="mt-2 max-w-xl text-pretty text-[14.5px] leading-relaxed text-mute">
        {refusee
          ? 'Vous gardez l’accès à ce que vous avez saisi. Pour reprendre, écrivez-nous — on regardera ensemble.'
          : 'On prépare votre secteur. En attendant, l’interface est là, vide de données publiques. Vous serez prévenu dès que ce sera chargé.'}
      </p>
    </section>
  );
}
