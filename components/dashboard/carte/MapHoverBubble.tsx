import { markerBadgeColor } from '@/lib/carte/colors';
import type { HoverPreview } from '@/lib/carte/hover-preview';

export default function MapHoverBubble({
  preview,
  id,
  onMouseEnter,
  onMouseLeave,
}: {
  preview: HoverPreview;
  id?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const letterColor = preview.swatch ? markerBadgeColor(preview.swatch) : undefined;
  return (
    <div
      id={id}
      role="tooltip"
      className="priimo-hover-bubble"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <p className="priimo-hover-kicker">{preview.kindLabel}</p>
      <p className="priimo-hover-title">
        {preview.letter ? (
          <span
            className="priimo-hover-letter"
            style={
              preview.swatch
                ? { background: preview.swatch, color: letterColor }
                : undefined
            }
          >
            {preview.letter}
          </span>
        ) : null}
        {preview.title}
      </p>
      {preview.lines.map((line) => (
        <p key={line} className="priimo-hover-line">
          {line}
        </p>
      ))}
    </div>
  );
}
