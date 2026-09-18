import { Nunito } from 'next/font/google';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-nunito',
});

export default function QrPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`qr-public ${nunito.variable} ${nunito.className} min-h-[100svh] overflow-x-hidden bg-[#E4F1FC] text-[#1A1A1A]`}
      style={nunito.style}
    >
      {children}
    </div>
  );
}
