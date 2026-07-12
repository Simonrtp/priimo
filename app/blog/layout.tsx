import type { ReactNode } from 'react';

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="landing min-h-dvh bg-[#FFF7F0]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(900px 700px at 10% 0%, rgba(232,116,60,0.08), transparent 60%), radial-gradient(800px 600px at 90% 20%, rgba(61,90,128,0.06), transparent 55%)',
        }}
      />
      {children}
    </div>
  );
}
