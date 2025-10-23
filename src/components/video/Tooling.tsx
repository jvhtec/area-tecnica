import React from "react";
import {
  TouchNumericField,
  type TouchNumericFieldProps,
  ToolHelpOverlay,
  type ToolHelpOverlayProps,
} from "@/components/shared/tooling";

export type { TouchNumericFieldProps as VideoTouchNumericFieldProps };
export type { ToolHelpOverlayProps as VideoToolHelpOverlayProps };

export const VideoTouchNumericField: React.FC<TouchNumericFieldProps> = ({
  quickIncrements = [1, 3, 5, 10],
  accent,
  ...props
}) => (
  <TouchNumericField
    quickIncrements={quickIncrements}
    accent={accent ?? "video"}
    {...props}
  />
);

export const VideoToolHelpOverlay: React.FC<ToolHelpOverlayProps> = ({ accent, ...props }) => (
  <ToolHelpOverlay accent={accent ?? "video"} {...props} />
);
