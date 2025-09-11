import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useJobsRealtime } from "@/hooks/useJobsRealtime";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { JobCard } from "@/components/jobs/JobCard";
import { Separator } from "@/components/ui/separator";
import { Tent, Printer, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase, ensureRealtimeConnection } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { generateAndMergeFestivalPDFs } from "@/utils/pdf/festivalPdfGenerator";
import { fetchJobLogo } from "@/utils/pdf/logoUtils";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { SubscriptionIndicator } from "@/components/ui/subscription-indicator";
import { PrintOptions, PrintOptionsDialog } from "@/components/festival/pdf/PrintOptionsDialog";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { FestivalsPagination } from "@/components/ui/festivals-pagination";
import { findClosestFestival, calculatePageForFestival } from "@/utils/dateUtils";

const ITEMS_PER_PAGE = 9; // 3x3 grid

/**
 * Festivals page component showing all festival events with pagination
 */
const Festivals = () => {
  const navigate = useNavigate();
  const { 
    jobs, 
    isLoading, 
    isError, 
    error, 
    isRefreshing, 
    refetch,
    realtimeStatus
  } = useJobsRealtime();
  
  const [festivalJobs, setFestivalJobs] = useState<any[]>([]);
  const [festivalLogos, setFestivalLogos] = useState<Record<string, string>>({});
  const [isPrinting, setIsPrinting] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedFestivalId, setHighlightedFestivalId] = useState<string | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedJobForPrint, setSelectedJobForPrint] = useState<{ id: string; title: string } | null>(null);
  const { userRole } = useOptimizedAuth();
  const { status: connectionStatus, recoverConnection } = useConnectionStatus();
  const festivalRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Filter jobs to only show festivals
  useEffect(() => {
    if (jobs) {
      const festivals = jobs.filter(job => job.job_type === 'festival');
      setFestivalJobs(festivals);
      
      festivals.forEach(fetchFestivalLogo);
    }
  }, [jobs]);

  // Auto-center on closest festival when festivals are loaded
  useEffect(() => {
    if (festivalJobs.length > 0) {
      const closestFestival = findClosestFestival(festivalJobs);
      if (closestFestival) {
        const targetPage = calculatePageForFestival(festivalJobs, closestFestival, ITEMS_PER_PAGE);
        setCurrentPage(targetPage);
        setHighlightedFestivalId(closestFestival.id);
        
        // Scroll to the festival after a brief delay to ensure rendering
        setTimeout(() => {
          scrollToFestival(closestFestival.id);
        }, 300);
      }
    }
  }, [festivalJobs]);

  // Clear highlight after some time
  useEffect(() => {
    if (highlightedFestivalId) {
      const timer = setTimeout(() => {
        setHighlightedFestivalId(null);
      }, 3000); // Remove highlight after 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [highlightedFestivalId]);

  // Calculate pagination
  const totalPages = Math.ceil(festivalJobs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedFestivals = festivalJobs.slice(startIndex, endIndex);

  // Auto-recover connection if needed
  useEffect(() => {
    if (isError || (connectionStatus !== 'connected' && !isLoading)) {
      console.log("Connection issue detected, attempting recovery...");
      const attemptRecovery = async () => {
        await recoverConnection();
        refetch();
      };
      attemptRecovery();
    }
  }, [isError, connectionStatus, isLoading, recoverConnection, refetch]);

  // Fetch festival logo for each festival job
  const fetchFestivalLogo = async (job: any) => {
    try {
      const logoUrl = await fetchJobLogo(job.id);
      
      if (logoUrl) {
        setFestivalLogos(prev => ({
          ...prev,
          [job.id]: logoUrl
        }));
      }
    } catch (err) {
      console.error('Error in fetchFestivalLogo:', err);
    }
  };

  // Scroll to specific festival
  const scrollToFestival = (festivalId: string) => {
    const festivalElement = festivalRefs.current[festivalId];
    if (festivalElement) {
      festivalElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });
    }
  };

  // Navigate to festival management page when clicking on a job
  const handleJobClick = (jobId: string) => {
    navigate(`/festival-management/${jobId}`);
  };

  // Handle opening print dialog
  const handleOpenPrintDialog = (jobId: string, jobTitle: string) => {
    setSelectedJobForPrint({ id: jobId, title: jobTitle });
    setPrintDialogOpen(true);
  };

  // Handle printing all documentation for a festival
  const handlePrintConfirm = async (options: PrintOptions, filename: string) => {
    if (!selectedJobForPrint) return;
    
    setIsPrinting(prev => ({ ...prev, [selectedJobForPrint.id]: true }));
    
    try {
      console.log("Starting document generation for festival:", selectedJobForPrint.title);
      
      const result = await generateAndMergeFestivalPDFs(
        selectedJobForPrint.id, 
        selectedJobForPrint.title, 
        options,
        filename
      );
      
      if (!result.blob || result.blob.size === 0) {
        throw new Error('Generated PDF is empty');
      }
      
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Documentation generated successfully');
    } catch (error: any) {
      console.error('Error generating documentation:', error);
      toast.error(`Failed to generate documentation: ${error.message}`);
    } finally {
      setIsPrinting(prev => ({ ...prev, [selectedJobForPrint.id]: false }));
    }
  };

  // Handle refresh button click with enhanced recovery
  const handleRefreshClick = async () => {
    try {
      toast.info("Refreshing festival data...");
      
      // First try to ensure realtime connection
      const connectionRestored = await ensureRealtimeConnection();
      
      if (connectionRestored) {
        await refetch();
        toast.success("Festival data refreshed");
      } else {
        // If connection couldn't be restored, try the full recovery
        await recoverConnection();
        await refetch();
        toast.success("Connection restored and data refreshed");
      }
    } catch (error) {
      console.error("Error during refresh:", error);
      toast.error("Could not refresh data. Please try again.");
    }
  };

  const canPrintDocuments = ['admin', 'management', 'logistics'].includes(userRole || '');
  const emptyFunction = () => {};

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-4">
            <CardTitle className="text-2xl font-bold">Festival Management</CardTitle>
            <Tent className="h-6 w-6 text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-2">
            <SubscriptionIndicator 
              tables={['jobs', 'job_assignments', 'job_departments', 'job_date_types', 'festival_logos']} 
              showRefreshButton 
              onRefresh={handleRefreshClick}
              showLabel
            />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Access and manage all festival-type events in one place.
          </p>
          <Separator className="my-6" />
          
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
              <p className="text-muted-foreground">Loading festivals...</p>
              {connectionStatus !== 'connected' && (
                <p className="text-amber-500 mt-2">Establishing connection...</p>
              )}
            </div>
          ) : isError ? (
            <div className="flex flex-col justify-center items-center h-40 text-center">
              <AlertTriangle className="h-8 w-8 mb-2 text-destructive" />
              <h3 className="text-lg font-medium text-destructive">Error loading festivals</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                {error instanceof Error ? error.message : 'An unknown error occurred'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Connection status: {connectionStatus}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefreshClick}
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconnect & Try Again
              </Button>
            </div>
          ) : festivalJobs.length === 0 ? (
            <div className="text-center py-10">
              <h3 className="text-lg font-medium">No festivals found</h3>
              <p className="text-muted-foreground mt-2">
                There are currently no festival-type jobs scheduled.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedFestivals.map((job) => (
                  <div 
                    key={job.id} 
                    className="relative"
                    ref={(el) => {
                      festivalRefs.current[job.id] = el;
                    }}
                  >
                    <div 
                      onClick={() => handleJobClick(job.id)} 
                      className={`cursor-pointer transition-all duration-300 ${
                        highlightedFestivalId === job.id 
                          ? 'ring-2 ring-primary ring-offset-2 shadow-lg scale-105' 
                          : ''
                      }`}
                    >
                      <JobCard 
                        job={job} 
                        onJobClick={() => handleJobClick(job.id)} 
                        onEditClick={emptyFunction} 
                        onDeleteClick={emptyFunction}
                        userRole={userRole}
                        department="sound"
                        festivalLogo={festivalLogos[job.id]}
                        hideFestivalControls={true}
                      />
                    </div>
                    {canPrintDocuments && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPrintDialog(job.id, job.title);
                        }}
                        disabled={isPrinting[job.id]}
                      >
                        {isPrinting[job.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                        <span className="sr-only">Print Documentation</span>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              
              {totalPages > 1 && (
                <FestivalsPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={festivalJobs.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <PrintOptionsDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        onConfirm={handlePrintConfirm}
        maxStages={3} // You might want to make this dynamic based on festival data
        jobTitle={selectedJobForPrint?.title || ''}
        jobId={selectedJobForPrint?.id}
      />
    </div>
  );
};

export default Festivals;
