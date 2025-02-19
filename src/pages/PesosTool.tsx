
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useJobSelection, type Job } from "@/hooks/useJobSelection";
import { JobCombobox } from "@/components/JobCombobox";

export const PesosTool = () => {
  const { jobs, isLoading } = useJobSelection();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

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
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Weight Calculator</h2>
              {/* Weight calculation content will go here */}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PesosTool;
