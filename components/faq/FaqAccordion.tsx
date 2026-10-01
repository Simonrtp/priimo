"use client";

import { useState } from "react";
import type { FaqItem } from "@/lib/landing/faq";

function FaqRow({
  q,
  a,
  isOpen,
  onToggle,
  idx,
  idPrefix,
}: FaqItem & { isOpen: boolean; onToggle: () => void; idx: number; idPrefix: string }) {
  const id = `${idPrefix}-${idx}`;
  const paragraphs = a.split(/\n\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className={`faq-card${isOpen ? " is-open" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={id}
        className="faq-card-trigger"
      >
        <h3 className="faq-card-question text-balance">{q}</h3>
        <span
          className={`faq-card-chevron ${isOpen ? "is-open" : ""}`}
          aria-hidden
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <div id={id} className={`faq-content ${isOpen ? "open" : ""}`}>
        <div className="faq-content-inner">
          <div className="faq-card-answer">
            {paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="text-pretty">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FaqAccordion({
  items,
  idPrefix = "faq",
}: {
  items: FaqItem[];
  idPrefix?: string;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="faq-list">
      {items.map((item, i) => (
        <FaqRow
          key={item.id}
          idx={i}
          idPrefix={idPrefix}
          id={item.id}
          q={item.q}
          a={item.a}
          isOpen={openIdx === i}
          onToggle={() => setOpenIdx(openIdx === i ? null : i)}
        />
      ))}
    </div>
  );
}
