import LoginForm from './LoginForm';

const ERREURS: Record<string, string> = {
  identifiants: 'Email ou mot de passe incorrect.',
  rate: 'Trop de tentatives. Réessayez dans quelques minutes.',
  confirmation: 'Confirmez votre adresse email avant de vous connecter.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const message = erreur ? ERREURS[erreur] ?? ERREURS.identifiants : undefined;
  return <LoginForm erreurServeur={message} />;
}
