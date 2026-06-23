"use client";

import { useCustomize } from "@/lib/customize/CustomizeContext";
import { SHAPE_MOTIFS } from "@/lib/customize/types";

// Fixed, hand-placed scatter so decorations never overlap the same way twice
// yet stay deterministic (no layout shift between renders).
const MOTIF_SPOTS = [
  { top: "5%",  left: "8%",  size: 30, d: 13, delay: 0 },
  { top: "11%", left: "82%", size: 26, d: 15, delay: 1.5 },
  { top: "24%", left: "44%", size: 22, d: 17, delay: 0.8 },
  { top: "37%", left: "13%", size: 34, d: 14, delay: 2.2 },
  { top: "43%", left: "78%", size: 24, d: 16, delay: 1.1 },
  { top: "57%", left: "30%", size: 28, d: 18, delay: 0.4 },
  { top: "63%", left: "87%", size: 22, d: 13, delay: 2.6 },
  { top: "72%", left: "9%",  size: 30, d: 15, delay: 1.8 },
  { top: "82%", left: "56%", size: 26, d: 17, delay: 0.6 },
  { top: "90%", left: "22%", size: 22, d: 14, delay: 2.0 },
];

export function AuroraField() {
  const { customize } = useCustomize();
  const motif = customize.shapeMotif;
  const glyphs = SHAPE_MOTIFS.find((m) => m.id === motif)?.glyphs ?? [];

  return (
    <>
      <div className="aurora-field" aria-hidden="true" />

      {motif === "blobs" && (
        <>
          <div className="aurora-blob b1" aria-hidden="true" />
          <div className="aurora-blob b2" aria-hidden="true" />
          <div className="aurora-blob b3" aria-hidden="true" />
        </>
      )}

      {glyphs.length > 0 &&
        MOTIF_SPOTS.map((s, i) => (
          <span
            key={i}
            className="motif-glyph"
            aria-hidden="true"
            style={{
              top: s.top,
              left: s.left,
              fontSize: s.size,
              animationDelay: `${s.delay}s`,
              ["--d" as string]: `${s.d}s`,
            } as React.CSSProperties}
          >
            {glyphs[i % glyphs.length]}
          </span>
        ))}
    </>
  );
}
