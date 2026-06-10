import React from "react";
import { ConsumosToolPage } from "@/features/technical-tools/power/consumos/ConsumosToolPage";
import { SOUND_CONSUMOS_CONFIG } from "@/features/technical-tools/power/consumos/departmentConfigs";

const ConsumosTool: React.FC = () => (
  <ConsumosToolPage config={SOUND_CONSUMOS_CONFIG} />
);

export default ConsumosTool;
