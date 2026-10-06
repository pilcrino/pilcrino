import React from "react";
import { AbsoluteFill } from "remotion";
import { BlogWatermark } from "./BlogWatermark";
import { SAFE_MARGIN, fonts, palette } from "./theme";

const Card: React.FC<{ label: string; highlight?: boolean }> = ({ label, highlight }) => (
  <div style={{ background: palette.surface, border: `3px solid ${highlight ? palette.accent : palette.border}`,
    borderRadius: 24, padding: "48px 64px", fontFamily: fonts.sans, fontSize: 44,
    color: palette.text, fontWeight: 600 }}>
    {label}
  </div>
);

export const SampleDiagram: React.FC = () => (
  <AbsoluteFill style={{ background: palette.background }}>
    <div style={{ position: "absolute", inset: SAFE_MARGIN, display: "flex",
      alignItems: "center", justifyContent: "space-between" }}>
      <Card label="Draft" />
      <div style={{ fontSize: 64, color: palette.muted, fontFamily: fonts.mono }}>→</div>
      <Card label="Review" />
      <div style={{ fontSize: 64, color: palette.muted, fontFamily: fonts.mono }}>→</div>
      <Card label="Publish" highlight />
    </div>
    <BlogWatermark />
  </AbsoluteFill>
);
