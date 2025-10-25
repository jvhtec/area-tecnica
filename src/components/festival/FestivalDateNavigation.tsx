import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DateTypeContextMenu } from "@/components/dashboard/DateTypeContextMenu";
import { ChevronLeft, ChevronRight, Calendar, Filter } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameWeek } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FestivalDateNavigationProps {
  jobDates: Date[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  dateTypes: Record<string, string>;
  jobId: string;
  onTypeChange: () => void;
  dayStartTime: string;
  // Optional stage filtering props
  showStageFilter?: boolean;
  selectedStage?: string;
  onStageChange?: (stage: string) => void;
  maxStages?: number;
}

export const FestivalDateNavigation = ({
  jobDates,
  selectedDate,
  onDateChange,
  dateTypes,
  jobId,
  onTypeChange,
  dayStartTime,
  showStageFilter = false,
  selectedStage = "all",
  onStageChange,
  maxStages = 3
}: FestivalDateNavigationProps) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const selected = new Date(selectedDate);
    return startOfWeek(selected, { weekStartsOn: 1 }); // Start week on Monday
  });
  const [showOnlyShowDates, setShowOnlyShowDates] = useState(true);
  const [viewMode, setViewMode] = useState<'week' | 'all'>('week');

  // Filter dates based on preferences
  const filteredDates = useMemo(() => {
    if (!showOnlyShowDates) return jobDates;
    
    return jobDates.filter(date => {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const key = `${jobId}-${formattedDate}`;
      const dateType = dateTypes[key];
      return dateType === 'show' || dateType === 'setup' || dateType === 'rehearsal';
    });
  }, [jobDates, showOnlyShowDates, dateTypes, jobId]);

  // Get dates for current week
  const weekDates = useMemo(() => {
    if (viewMode === 'all') return filteredDates;
    
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    return filteredDates.filter(date => 
      date >= currentWeekStart && date <= weekEnd
    );
  }, [currentWeekStart, filteredDates, viewMode]);

  const canGoToPrevWeek = useMemo(() => {
    const prevWeek = subWeeks(currentWeekStart, 1);
    return filteredDates.some(date => isSameWeek(date, prevWeek, { weekStartsOn: 1 }));
  }, [currentWeekStart, filteredDates]);

  const canGoToNextWeek = useMemo(() => {
    const nextWeek = addWeeks(currentWeekStart, 1);
    return filteredDates.some(date => isSameWeek(date, nextWeek, { weekStartsOn: 1 }));
  }, [currentWeekStart, filteredDates]);

  const handlePrevWeek = () => {
    setCurrentWeekStart(prev => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(prev => addWeeks(prev, 1));
  };

  const getDateTypeColor = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    const key = `${jobId}-${formattedDate}`;
    const dateType = dateTypes[key];
    
    switch (dateType) {
      case 'travel':
        return 'border-blue-500 bg-blue-50';
      case 'setup':
        return 'border-amber-500 bg-amber-50';
      case 'show':
        return 'border-green-500 bg-green-50';
      case 'off':
        return 'border-gray-500 bg-gray-50';
      case 'rehearsal':
        return 'border-purple-500 bg-purple-50';
      default:
        return 'border-gray-300';
    }
  };

  const getDateTypeBadge = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    const key = `${jobId}-${formattedDate}`;
    const dateType = dateTypes[key];
    
    if (!dateType) return null;
    
    const badges = {
      travel: { text: 'T', color: 'bg-blue-500' },
      setup: { text: 'S', color: 'bg-amber-500' },
      show: { text: '●', color: 'bg-green-500' },
      off: { text: 'O', color: 'bg-gray-500' },
      rehearsal: { text: 'R', color: 'bg-purple-500' }
    };
    
    const badge = badges[dateType as keyof typeof badges];
    if (!badge) return null;
    
    return (
      <span className={`absolute -top-1 -right-1 w-4 h-4 ${badge.color} text-white text-xs rounded-full flex items-center justify-center font-bold`}>
        {badge.text}
      </span>
    );
  };

  const handleDateJump = (date: Date | undefined) => {
    if (!date) return;
    
    const formattedDate = format(date, 'yyyy-MM-dd');
    const isValidDate = jobDates.some(jobDate => format(jobDate, 'yyyy-MM-dd') === formattedDate);
    
    if (isValidDate) {
      onDateChange(formattedDate);
      setCurrentWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
    }
  };

  const formatTabDate = (date: Date) => {
    return format(date, 'EEE, MMM d');
  };

  const getWeekRange = () => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    return `${format(currentWeekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;
  };

  // Show simplified view for long festivals (7+ days)
  const isLongFestival = jobDates.length >= 7;

  if (weekDates.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-center text-muted-foreground border rounded-md">
        <div>
          <p>No {showOnlyShowDates ? 'show/key' : ''} dates found for this week.</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOnlyShowDates(false)}
              disabled={!showOnlyShowDates}
            >
              Show All Dates
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('all')}
              disabled={viewMode === 'all'}
            >
              Show All Weeks
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {isLongFestival && (
            <>
              <div className="flex items-center gap-2">
                <Label htmlFor="view-mode" className="text-sm whitespace-nowrap">View:</Label>
                <Switch
                  id="view-mode"
                  checked={viewMode === 'week'}
                  onCheckedChange={(checked) => setViewMode(checked ? 'week' : 'all')}
                />
                <span className="text-sm">{viewMode === 'week' ? 'Week' : 'All'}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <Switch
                  id="show-filter"
                  checked={showOnlyShowDates}
                  onCheckedChange={setShowOnlyShowDates}
                />
                <Label htmlFor="show-filter" className="text-sm whitespace-nowrap">Key dates only</Label>
              </div>
            </>
          )}

          {/* Stage Filter */}
          {showStageFilter && onStageChange && (
            <div className="flex items-center gap-2">
              <Label htmlFor="stage-filter" className="text-sm whitespace-nowrap">Stage:</Label>
              <Select value={selectedStage} onValueChange={onStageChange}>
                <SelectTrigger id="stage-filter" className="w-[120px] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {Array.from({ length: maxStages }, (_, i) => i + 1).map((stage) => (
                    <SelectItem key={stage} value={stage.toString()}>
                      Stage {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-end">
          {viewMode === 'week' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevWeek}
                disabled={!canGoToPrevWeek}
                className="h-10 min-w-[40px]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <span className="text-sm font-medium min-w-[100px] sm:min-w-[120px] text-center">
                {getWeekRange()}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextWeek}
                disabled={!canGoToNextWeek}
                className="h-10 min-w-[40px]"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 hidden sm:flex">
                <Calendar className="h-4 w-4 mr-2" />
                Jump to Date
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="single"
                selected={new Date(selectedDate)}
                onSelect={handleDateJump}
                disabled={(date) => 
                  !jobDates.some(jobDate => 
                    format(jobDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                  )
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 sm:hidden">
                <Calendar className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="single"
                selected={new Date(selectedDate)}
                onSelect={handleDateJump}
                disabled={(date) => 
                  !jobDates.some(jobDate => 
                    format(jobDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                  )
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Date Tabs */}
      <Tabs value={selectedDate} onValueChange={onDateChange} className="w-full">
        <div className="overflow-x-auto -mx-2 px-2 touch-pan-x">
          <TabsList className="mb-4 inline-flex h-auto p-1 w-auto min-w-full">
            {weekDates.map((date) => {
              const formattedDateValue = format(date, 'yyyy-MM-dd');
              const dateTypeColor = getDateTypeColor(date);
              
              return (
                <DateTypeContextMenu 
                  key={formattedDateValue}
                  jobId={jobId}
                  date={date}
                  onTypeChange={onTypeChange}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger
                          value={formattedDateValue}
                          className={`relative border-b-2 ${dateTypeColor} min-w-[100px] h-12 touch-manipulation`}
                        >
                          {formatTabDate(date)}
                          {getDateTypeBadge(date)}
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-center">
                          <p>Festival day runs from {dayStartTime} to {dayStartTime} the next day</p>
                          <p>Date: {formattedDateValue}</p>
                          <p>Type: {dateTypes[`${jobId}-${formattedDateValue}`] || 'Not set'}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </DateTypeContextMenu>
              );
            })}
          </TabsList>
        </div>
        
        {weekDates.map((date) => (
          <TabsContent
            key={format(date, 'yyyy-MM-dd')}
            value={format(date, 'yyyy-MM-dd')}
            className="mt-0"
          >
            {/* Content will be rendered by parent component */}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
