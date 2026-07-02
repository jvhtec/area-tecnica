import { CloudOff } from "lucide-react";

export const FestivalOfflineBanner = () => (
  <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
    <CloudOff className="h-4 w-4 shrink-0" />
    <span>
      Estás viendo la copia offline de este festival. Los cambios se guardarán localmente y podrás sincronizarlos cuando vuelvas a tener conexión.
    </span>
  </div>
);
