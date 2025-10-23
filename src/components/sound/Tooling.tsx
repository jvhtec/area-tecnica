import React from "react";
import {
  TouchNumericField,
  type TouchNumericFieldProps,
  ToolHelpOverlay,
  type ToolHelpOverlayProps,
} from "@/components/shared/tooling";

export type { TouchNumericFieldProps as SoundTouchNumericFieldProps };
export type { ToolHelpOverlayProps as SoundToolHelpOverlayProps };

export const SoundTouchNumericField: React.FC<TouchNumericFieldProps> = ({
  quickIncrements = [1, 2, 4, 8],
  accent,
  ...props
}) => (
  <TouchNumericField
    quickIncrements={quickIncrements}
    accent={accent ?? "sound"}
    {...props}
  />
);

export const SoundToolHelpOverlay: React.FC<ToolHelpOverlayProps> = ({ accent, ...props }) => (
  <ToolHelpOverlay accent={accent ?? "sound"} {...props} />
);
