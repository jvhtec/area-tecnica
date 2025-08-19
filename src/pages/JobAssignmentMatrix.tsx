
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, Users, RefreshCw } from 'lucide-react';
import { OptimizedAssignmentMatrix } from '@/components/matrix/OptimizedAssignmentMatrix';
import { PerformanceIndicator } from '@/components/matrix/PerformanceIndicator';
import { DateRangeExpander } from '@/components/matrix/DateRangeExpander';
import { useVirtualizedDateRange } from '@/hooks/useVirtualizedDateRange';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export default function JobAssignmentMatrix() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use virtualized date range with expandable capabilities
  const {
    dateRange,
    todayIndex,
    canExpandBefore,
    canExpandAfter,
    expandBefore,
    expandAfter,
    setCenterDate,
    resetRange,
    jumpToMonth,
    rangeInfo
  } = useVirtualizedDateRange({
    initialWeeksBefore: 1,   // Start with 1 week before today
    initialWeeksAfter: 2,    // Start with 2 weeks after today
    maxWeeksBefore: 26,      // Allow up to 6 months before
    maxWeeksAfter: 26,       // Allow up to 6 months after
    expandByWeeks: 4         // Expand by 4 weeks at a time
  });

  // Optimized technicians query
  const { data: technicians = [], isLoading: isLoadingTechnicians } = useQuery({
    queryKey: ['optimized-matrix-technicians', selectedDepartment],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, department, role')
        .in('role', ['technician', 'house_tech']);

      if (selectedDepartment !== 'all') {
        query = query.eq('department', selectedDepartment);
      }

      const { data, error } = await query
        .order('department', { ascending: true })
        .order('last_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Filter technicians based on search term
  const filteredTechnicians = useMemo(() => {
    if (!searchTerm) return technicians;
    
    const searchLower = searchTerm.toLowerCase();
    return technicians.filter(tech => 
      `${tech.first_name} ${tech.last_name}`.toLowerCase().includes(searchLower) ||
      tech.email?.toLowerCase().includes(searchLower) ||
      tech.department?.toLowerCase().includes(searchLower)
    );
  }, [technicians, searchTerm]);

  // Optimized jobs query with smart date filtering
  const { data: yearJobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['optimized-matrix-jobs', rangeInfo.startFormatted, rangeInfo.endFormatted, selectedDepartment],
    queryFn: async () => {
      const startDate = rangeInfo.start;
      const endDate = rangeInfo.end;

      let query = supabase
        .from('jobs')
        .select(`
          id, title, start_time, end_time, color, status, job_type,
          job_departments!inner(department)
        `)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString())
        .neq('job_type', 'dryhire')
        .limit(500); // Limit for performance

      // Add department filter if selected
      if (selectedDepartment !== 'all') {
        query = query.eq('job_departments.department', selectedDepartment);
      }

      const { data, error } = await query.order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: dateRange.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Dispatch the assignment update event to force refresh
    window.dispatchEvent(new CustomEvent('assignment-updated'));
    
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const departments = ['all', 'sound', 'lights', 'video'];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-card p-2 md:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 md:h-6 md:w-6" />
            <h1 className="text-lg md:text-2xl font-bold">Job Assignment Matrix</h1>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>

        {/* Date Range Controls */}
        <DateRangeExpander
          canExpandBefore={canExpandBefore}
          canExpandAfter={canExpandAfter}
          onExpandBefore={expandBefore}
          onExpandAfter={expandAfter}
          onReset={resetRange}
          onJumpToMonth={jumpToMonth}
          rangeInfo={rangeInfo}
        />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>
                    {dept === 'all' ? 'All Departments' : dept.charAt(0).toUpperCase() + dept.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Search technicians..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 min-w-0 flex-1 sm:flex-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Users className="h-4 w-4" />
            <Badge variant="secondary" className="text-xs">
              {filteredTechnicians.length} techs
            </Badge>
            <Badge variant="outline" className="text-xs">
              {yearJobs.length} jobs
            </Badge>
            <div className="hidden lg:block">
              <PerformanceIndicator
                assignmentCount={yearJobs.length * filteredTechnicians.length}
                availabilityCount={filteredTechnicians.length * dateRange.length}
                cellCount={filteredTechnicians.length * dateRange.length}
                isLoading={isLoadingTechnicians || isLoadingJobs}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Matrix Content */}
      <div className="flex-1 overflow-hidden">
        {isLoadingTechnicians || isLoadingJobs ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-muted-foreground">Loading assignment matrix...</p>
            </div>
          </div>
        ) : (
          <OptimizedAssignmentMatrix
            technicians={filteredTechnicians}
            dates={dateRange}
            jobs={yearJobs}
            onNearEdgeScroll={(direction) => {
              if (direction === 'before' && canExpandBefore) {
                expandBefore();
              } else if (direction === 'after' && canExpandAfter) {
                expandAfter();
              }
            }}
            canExpandBefore={canExpandBefore}
            canExpandAfter={canExpandAfter}
          />
        )}
      </div>
    </div>
  );
}
