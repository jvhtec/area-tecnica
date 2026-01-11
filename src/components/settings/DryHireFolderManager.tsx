import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, FolderPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  getDryhireYearStatuses,
  createDryhireYearFolders,
} from "@/utils/flex-folders/dryhireFolderService";

interface YearStatus {
  year: number;
  sound: number;
  lights: number;
}

export function DryHireFolderManager() {
  const [yearStatuses, setYearStatuses] = useState<YearStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear, currentYear + 1];

  useEffect(() => {
    loadStatuses();
  }, []);

  async function loadStatuses() {
    setIsLoading(true);
    setError(null);
    try {
      const statuses = await getDryhireYearStatuses();
      setYearStatuses(statuses);

      // Default to first year that doesn't have folders
      const existingYears = new Set(statuses.map((s) => s.year));
      const firstMissing = availableYears.find((y) => !existingYears.has(y));
      if (firstMissing) {
        setSelectedYear(String(firstMissing));
      } else if (availableYears.length > 0) {
        setSelectedYear(String(availableYears[0]));
      }
    } catch (err) {
      console.error("Failed to load dryhire folder statuses:", err);
      setError("Failed to load folder statuses");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateFolders() {
    if (!selectedYear) return;

    const year = parseInt(selectedYear, 10);
    const existingYear = yearStatuses.find((s) => s.year === year);
    if (existingYear && existingYear.sound === 12 && existingYear.lights === 12) {
      toast({
        title: "Folders already exist",
        description: `Dryhire folders for ${year} have already been created.`,
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createDryhireYearFolders(year);
      toast({
        title: "Folders created",
        description: `Successfully created dryhire folders for ${year}.`,
      });
      await loadStatuses();
    } catch (err) {
      console.error("Failed to create dryhire folders:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to create folders: ${message}`);
      toast({
        title: "Failed to create folders",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }

  const yearHasFolders = (year: number) => {
    const status = yearStatuses.find((s) => s.year === year);
    return status && status.sound === 12 && status.lights === 12;
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading folder status...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Manage Flex folders for dry hire jobs. Each year needs a set of monthly folders
        for Sound and Lights departments.
      </p>

      {/* Existing years */}
      {yearStatuses.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Existing years</h4>
          <div className="space-y-1">
            {yearStatuses.map((status) => (
              <div
                key={status.year}
                className="flex items-center gap-3 text-sm p-2 bg-muted/50 rounded"
              >
                <span className="font-medium w-12">{status.year}</span>
                <div className="flex items-center gap-1">
                  {status.sound === 12 ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>Sound ({status.sound}/12)</span>
                </div>
                <div className="flex items-center gap-1">
                  {status.lights === 12 ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>Lights ({status.lights}/12)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create new year */}
      <div className="space-y-3 pt-2">
        <h4 className="text-sm font-medium">Create folders for new year</h4>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem
                  key={year}
                  value={String(year)}
                  disabled={yearHasFolders(year)}
                >
                  {year} {yearHasFolders(year) && "(created)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleCreateFolders}
            disabled={isCreating || !selectedYear || yearHasFolders(parseInt(selectedYear, 10))}
            className="w-full sm:w-auto"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <FolderPlus className="mr-2 h-4 w-4" />
                Create Dry Hire Folders
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          This will create 2 main folders (Sound + Lights) with 12 monthly subfolders each in Flex.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
