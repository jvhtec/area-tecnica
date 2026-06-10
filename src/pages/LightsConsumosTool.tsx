import React from "react";
import { ConsumosToolPage } from "@/features/technical-tools/power/consumos/ConsumosToolPage";
import { LIGHTS_CONSUMOS_CONFIG } from "@/features/technical-tools/power/consumos/departmentConfigs";

const LightsConsumosTool: React.FC = () => (
  <ConsumosToolPage config={LIGHTS_CONSUMOS_CONFIG} />
);

export default LightsConsumosTool;
