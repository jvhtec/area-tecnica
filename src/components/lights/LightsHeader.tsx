import { Button } from "@/components/ui/button";

interface LightsHeaderProps {
  onCreateJob: () => void;
  onCreateTour: () => void;
  department?: string;
}

export const LightsHeader = ({ onCreateJob, onCreateTour, department = "Lights" }: LightsHeaderProps) => {
  return (
    <div className="flex justify-between items-center">
      <h1 className="text-2xl font-semibold">Departmento de {department}</h1>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCreateJob}>
          Create Job
        </Button>
        <Button variant="outline" onClick={onCreateTour}>
          Create Tour
        </Button>
      </div>
    </div>
  );
};
