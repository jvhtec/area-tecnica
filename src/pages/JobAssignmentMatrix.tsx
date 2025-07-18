
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, Users, RefreshCw } from 'lucide-react';
import { OptimizedAssignmentMatrix } from '@/components/matrix/OptimizedAssignmentMatrix';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { addDays, format, startOfYear, endOfYear } from 'date-fns';

export default function JobAssignmentMatrix() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Generate date range for the selected year
  const dateRange = useMemo(() => {
    const startDate = startOfYear(new Date(selectedYear, 0, 1));
    const endDate = endOfYear(new Date(selectedYear, 0, 1));
    const dates = [];
    let currentDate = startDate;
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }
    
    return dates;
  }, [selectedYear]);

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

  // Optimized jobs query - excluding dry hire jobs
  const { data: yearJobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['optimized-matrix-jobs', selectedYear],
    queryFn: async () => {
      const startDate = startOfYear(new Date(selectedYear, 0, 1));
      const endDate = endOfYear(new Date(selectedYear, 0, 1));

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id, title, start_time, end_time, color, status, job_type,
          job_departments!inner(department)
        `)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString())
        .neq('job_type', 'dryhire')
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const departments = ['all', 'sound', 'lights', 'video'];
  const years = [selectedYear - 1, selectedYear, selectedYear + 1];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Job Assignment Matrix</h1>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
            className="w-48"
          />

          <div className="flex items-center gap-2 ml-auto">
            <Users className="h-4 w-4" />
            <Badge variant="secondary">
              {filteredTechnicians.length} technicians
            </Badge>
            <Badge variant="outline">
              {yearJobs.length} jobs (excluding dry hire)
            </Badge>
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
          />
        )}
      </div>
    </div>
  );
}
