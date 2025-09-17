
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, Users, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { OptimizedAssignmentMatrix } from '@/components/matrix/OptimizedAssignmentMatrix';
import { PerformanceIndicator } from '@/components/matrix/PerformanceIndicator';
import { DateRangeExpander } from '@/components/matrix/DateRangeExpander';
import { useVirtualizedDateRange } from '@/hooks/useVirtualizedDateRange';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { SkillsFilter } from '@/components/matrix/SkillsFilter';

export default function JobAssignmentMatrix() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Debounce search to reduce filtering churn
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [searchTerm]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allowDirectAssign, setAllowDirectAssign] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const specialtyOptions = ['foh','monitores','sistemas','rf','escenario','PA'] as const;
  const toggleSpecialty = (name: (typeof specialtyOptions)[number]) => {
    setSelectedSkills(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]);
  };

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
        .from('profiles_with_skills')
        .select('id, first_name, last_name, email, phone, dni, department, role, assignable_as_tech, skills')
        .or('role.in.(technician,house_tech),and(role.eq.management,assignable_as_tech.eq.true)');

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
    const arr = technicians.filter((tech: any) => {
      const matchesSearch = !debouncedSearch || (
        `${tech.first_name} ${tech.last_name}`.toLowerCase().includes(debouncedSearch) ||
        tech.email?.toLowerCase().includes(debouncedSearch) ||
        tech.department?.toLowerCase().includes(debouncedSearch)
      );
      if (!matchesSearch) return false;
      if (!selectedSkills.length) return true;
      const skills: Array<{ name: string }> = (tech.skills || []).map((s: any) => ({ name: (s.name || '').toLowerCase() }));
      // Require all selected skills to be present
      return selectedSkills.every(sel => skills.some(s => s.name === sel.toLowerCase()));
    });

    if (!selectedSkills.length) return arr;
    // Sort by skill match strength
    const scoreFor = (tech: any) => {
      const skills = (tech.skills || []) as Array<{ name?: string; proficiency?: number; is_primary?: boolean; category?: string | null }>;
      let score = 0;
      for (const sel of selectedSkills) {
        const m = skills.find(s => (s.name || '').toLowerCase() === sel.toLowerCase());
        if (!m) continue;
        const prof = Number(m.proficiency ?? 0);
        if (m.is_primary) score += 3;
        if (prof >= 4) score += 2; else if (prof >= 2) score += 1;
        // small bonus for sound-specialty when filtering foh/mon/rf
        if ((m.category || '') === 'sound-specialty') score += 1;
      }
      return score;
    };
    return arr.sort((a: any, b: any) => {
      const da = scoreFor(a);
      const db = scoreFor(b);
      if (db !== da) return db - da;
      // tie-breakers: department then last name
      const ad = (a.department || '').localeCompare(b.department || '');
      if (ad !== 0) return ad;
      return (a.last_name || '').localeCompare(b.last_name || '');
    });
  }, [technicians, debouncedSearch, selectedSkills]);

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
        .in('job_type', ['single', 'festival', 'tourdate'])
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

            <SkillsFilter selected={selectedSkills} onChange={setSelectedSkills} />
            {/* Quick specialties for sound */}
            <div className="flex items-center gap-1">
              {specialtyOptions.map(opt => (
                <Badge
                  key={opt}
                  variant={selectedSkills.includes(opt) ? 'default' : 'outline'}
                  className="cursor-pointer capitalize"
                  onClick={() => toggleSpecialty(opt)}
                >
                  {opt}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <div className="flex items-center gap-2 pr-2 border-r">
              <span className="text-sm font-medium">Direct assign</span>
              <Switch
                checked={allowDirectAssign}
                onCheckedChange={(v) => setAllowDirectAssign(Boolean(v))}
                aria-label="Toggle direct assignment"
              />
            </div>
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
            allowDirectAssign={allowDirectAssign}
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
