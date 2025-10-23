import React from "react";
import {
  TouchNumericField,
  type TouchNumericFieldProps,
  ToolHelpOverlay,
  type ToolHelpOverlayProps,
} from "@/components/shared/tooling";

export type { TouchNumericFieldProps as LightsTouchNumericFieldProps };
export type { ToolHelpOverlayProps as LightsToolHelpOverlayProps };

export const LightsTouchNumericField: React.FC<TouchNumericFieldProps> = ({
  quickIncrements = [1, 2, 5, 10],
  accent,
  ...props
}) => (
  <TouchNumericField
    quickIncrements={quickIncrements}
    accent={accent ?? "lights"}
    {...props}
  />
);

export const LightsToolHelpOverlay: React.FC<ToolHelpOverlayProps> = ({ accent, ...props }) => (
  <ToolHelpOverlay accent={accent ?? "lights"} {...props} />
);
