
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useJobSelection } from "@/hooks/useJobSelection";
import { JobCombobox } from "@/components/JobCombobox";
import { PowerCalculator } from "@/components/power/PowerCalculator";

export const PesosTool = () => {
  const { jobs, isLoading } = useJobSelection();
  const [selectedJob, setSelectedJob] = useState<any>(null);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardContent className="pt-6">
          <JobCombobox
            jobs={jobs}
            selectedJob={selectedJob}
            onSelect={setSelectedJob}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {selectedJob && (
        <PowerCalculator jobId={selectedJob.id} />
      )}
    </div>
  );
};

export default PesosTool;
