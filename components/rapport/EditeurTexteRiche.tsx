'use client';

import { useEffect, useId, useRef } from 'react';
import { Bold, Italic, List } from 'lucide-react';
import { corpsVersHtml, htmlVersCorps, type CorpsTexte } from '@/lib/rapport/texte-riche';

export default function EditeurTexteRiche({
  value,
  onChange,
  label,
  hint,
}: {
  value: CorpsTexte;
  onChange: (next: CorpsTexte) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const ready = useRef(false);

  useEffect(() => {
    if (!ref.current || ready.current) return;
    ref.current.innerHTML = corpsVersHtml(value) || '<p><br></p>';
    ready.current = true;
  }, [value]);

  function appliquer(commande: 'bold' | 'italic' | 'insertUnorderedList') {
    ref.current?.focus();
    document.execCommand(commande, false);
    if (ref.current) onChange(htmlVersCorps(ref.current.innerHTML));
  }

  return (
    <div>
      <p id={id} className="mb-1.5 block font-medium text-gray-700">
        {label}
      </p>
      {hint ? <p className="mb-1.5 text-pretty text-[12.5px] text-mute">{hint}</p> : null}
      <div className="overflow-hidden rounded-lg border border-black/10 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
        <div className="flex gap-0.5 border-b border-black/[0.06] bg-[#F7F6F4] px-1 py-1" role="toolbar" aria-label="Mise en forme">
          <BoutonFormat label="Gras" onClick={() => appliquer('bold')}>
            <Bold size={15} strokeWidth={2.2} aria-hidden />
          </BoutonFormat>
          <BoutonFormat label="Italique" onClick={() => appliquer('italic')}>
            <Italic size={15} strokeWidth={2.2} aria-hidden />
          </BoutonFormat>
          <BoutonFormat label="Liste à puces" onClick={() => appliquer('insertUnorderedList')}>
            <List size={15} strokeWidth={2.2} aria-hidden />
          </BoutonFormat>
        </div>
        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={id}
          contentEditable
          className="min-h-[8.5rem] px-[14px] py-[10px] text-[14px] text-ink outline-none [&_em]:italic [&_li]:mb-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
          onInput={() => {
            if (ref.current) onChange(htmlVersCorps(ref.current.innerHTML));
          }}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
          }}
        />
      </div>
    </div>
  );
}

function BoutonFormat({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="inline-flex size-9 items-center justify-center rounded-md text-ink hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
