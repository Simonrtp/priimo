export const metadata = {
  title: 'Admin — Agences',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg-base text-ink">
      <header className="border-b border-black/8 bg-white px-4 py-4 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-mute">Admin Priimo</p>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
