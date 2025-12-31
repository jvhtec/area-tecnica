import { FestivalManagementView } from "./festival-management/FestivalManagementView";
import { useFestivalManagementVm } from "./festival-management/useFestivalManagementVm";

const FestivalManagement = () => {
  const result = useFestivalManagementVm();

  if (result.status === "missing_job_id") {
    return <div>Se requiere ID del trabajo</div>;
  }

  if (result.status === "loading") {
    return <div>Cargando...</div>;
  }

  if (result.status === "not_found") {
    return <div>Festival no encontrado</div>;
  }

  return <FestivalManagementView vm={result.vm} />;
};

export default FestivalManagement;

