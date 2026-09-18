import { Nunito } from 'next/font/google';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export default function QrPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${nunito.className} min-h-[100svh] overflow-x-hidden bg-[#E4F1FC] text-[#1A1A1A]`}
    >
      {children}
    </div>
  );
}
