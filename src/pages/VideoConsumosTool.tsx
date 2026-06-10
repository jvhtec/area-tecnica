import React from "react";
import { ConsumosToolPage } from "@/features/technical-tools/power/consumos/ConsumosToolPage";
import { VIDEO_CONSUMOS_CONFIG } from "@/features/technical-tools/power/consumos/departmentConfigs";

const VideoConsumosTool: React.FC = () => (
  <ConsumosToolPage config={VIDEO_CONSUMOS_CONFIG} />
);

export default VideoConsumosTool;
