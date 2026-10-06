import ChargementBouton from '@/components/ui/ChargementBouton';

type AuthWaitProps = {
  label: string;
};

/** Attente des formulaires auth — délègue à la navette design system. */
export default function AuthWait({ label }: AuthWaitProps) {
  return <ChargementBouton label={label} size="auth" />;
}
