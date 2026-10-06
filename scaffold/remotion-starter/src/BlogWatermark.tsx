import React from "react";
import { SAFE_MARGIN, fonts, palette, watermark } from "./theme";

export const BlogWatermark: React.FC = () => (
  <div style={{ position: "absolute", left: SAFE_MARGIN, bottom: 48,
    fontFamily: fonts.sans, fontSize: 28, color: palette.muted,
    opacity: watermark.opacity }}>
    {watermark.text}
  </div>
);
