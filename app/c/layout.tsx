import { fontNunito } from '@/lib/fonts-nunito';

export default function QrPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`qr-public ${fontNunito.variable} ${fontNunito.className} min-h-[100svh] overflow-x-hidden bg-[#E4F1FC] text-[#1A1A1A]`}
      style={fontNunito.style}
    >
      {children}
    </div>
  );
}
