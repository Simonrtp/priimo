type AuthWaitProps = {
  label: string;
};

export default function AuthWait({ label }: AuthWaitProps) {
  return (
    <>
      <span className="auth-wait-track" aria-hidden>
        <span className="auth-wait-car" />
      </span>
      <span className="auth-wait-copy">{label}</span>
    </>
  );
}
