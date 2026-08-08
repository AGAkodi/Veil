/**
 * The origin illustration: an offset sage block, a ruled "field notes" card,
 * a thin circle behind it, and a wave that runs into a dark arrow tag.
 * Geometry mirrors design.jpg; all colour comes from the sampled palette.
 */
export function OriginFigure({ className = "" }: { className?: string }) {
  const rules = [148, 132, 148, 120, 141, 96];

  return (
    <svg
      viewBox="0 0 340 320"
      className={className}
      role="img"
      aria-label="A ruled field-notes card labelled veil.leo, with four numbered entries and a signal line running into a tag marked THE RECORD."
    >
      {/* thin circle outline sitting behind everything */}
      <circle
        cx="158"
        cy="158"
        r="132"
        fill="none"
        stroke="var(--rule)"
        strokeWidth="1"
      />

      {/* sage block, offset down and left of the card */}
      <rect x="14" y="78" width="176" height="168" fill="var(--sage)" />

      {/* the card */}
      <rect
        x="62"
        y="30"
        width="196"
        height="178"
        fill="var(--paper)"
        stroke="var(--ink)"
        strokeWidth="1.25"
      />

      <text
        x="77"
        y="52"
        fill="var(--ink)"
        fontSize="7"
        fontWeight="600"
        letterSpacing="1.1"
        fontFamily="var(--font-inter), sans-serif"
      >
        VEIL.LEO — FIELD NOTES
      </text>

      {/* ruled lines of varying length, like handwritten notes */}
      <g stroke="var(--rule)" strokeWidth="1.25">
        {rules.map((w, i) => (
          <line key={i} x1="77" y1={74 + i * 21} x2={77 + w} y2={74 + i * 21} />
        ))}
        <line x1="77" y1="65" x2="171" y2="65" stroke="var(--ink)" />
      </g>

      {/* orange spine running down the card's right gutter */}
      <line
        x1="214"
        y1="38"
        x2="214"
        y2="200"
        stroke="var(--accent)"
        strokeWidth="1.25"
      />

      {/* numbered entries in the gutter */}
      <g
        fill="var(--ink)"
        fontSize="7"
        letterSpacing="0.6"
        fontFamily="var(--font-inter), sans-serif"
      >
        {["01", "02", "03", "04"].map((n, i) => (
          <text key={n} x="225" y={76 + i * 30}>
            {n}
          </text>
        ))}
      </g>

      {/* the signal line: a wave crossing below the card */}
      <path
        d="M12 268 C 42 268, 42 232, 72 232 S 102 268, 132 268 S 162 232, 192 232 S 222 268, 252 268"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.5"
      />
      <g fill="var(--accent)">
        <circle cx="12" cy="268" r="4.5" />
        <circle cx="72" cy="232" r="4.5" />
        <circle cx="132" cy="268" r="4.5" />
        <circle cx="192" cy="232" r="4.5" />
      </g>

      {/* dark tag with an arrow point, terminating the line */}
      <path d="M176 256 H294 L314 274 L294 292 H176 Z" fill="var(--ink)" />
      <text
        x="194"
        y="278"
        fill="var(--paper)"
        fontSize="8"
        fontWeight="600"
        letterSpacing="1.4"
        fontFamily="var(--font-inter), sans-serif"
      >
        THE RECORD
      </text>
      <circle cx="300" cy="251" r="4.5" fill="var(--accent)" />
    </svg>
  );
}
