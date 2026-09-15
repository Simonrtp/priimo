import { existsSync } from 'node:fs';
import path from 'node:path';
import type { FeatureCapture } from '@/lib/features/pages';

function captureExists(file: string) {
  return existsSync(path.join(process.cwd(), 'public', 'captures', file));
}

export default function ProductShot({ file, alt, shot }: FeatureCapture) {
  const src = `/captures/${file}`;
  const ready = captureExists(file);

  return (
    <figure className="w-full min-w-0">
      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_24px_60px_-28px_rgba(30,27,75,0.28)] ring-1 ring-black/[0.06] sm:rounded-[24px]">
        {ready ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="block h-auto w-full" />
        ) : (
          <div className="flex aspect-[16/10] flex-col justify-between bg-[#FFF7F0] px-5 py-5 sm:px-6 sm:py-6">
            <p className="text-[11px] font-semibold uppercase text-[#E8743C]">
              Capture à poser
            </p>
            <p className="max-w-[36rem] text-pretty text-[14px] font-medium leading-snug text-[#3D5A80] sm:text-[15px]">
              {shot}
            </p>
            <p className="font-mono text-[11px] text-gray-500">{file}</p>
          </div>
        )}
      </div>
      <figcaption className="sr-only">{alt}</figcaption>
    </figure>
  );
}
