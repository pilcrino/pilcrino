import React from "react";
import { Still } from "remotion";
import { CANVAS } from "./theme";
import { SampleDiagram } from "./SampleDiagram";

export const RemotionRoot: React.FC = () => (
  <Still id="SampleDiagram" component={SampleDiagram}
    width={CANVAS.width} height={CANVAS.height} />
);
