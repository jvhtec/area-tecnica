
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Loader2 } from 'lucide-react';

interface VacationRequestFormProps {
  onSubmit: (request: { startDate: string; endDate: string; reason: string }) => void;
  isSubmitting?: boolean;
}

export const VacationRequestForm: React.FC<VacationRequestFormProps> = ({ onSubmit, isSubmitting = false }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startDate || !endDate || !reason.trim()) {
      return;
    }

    onSubmit({ startDate, endDate, reason });
    
    // Clear form after submission
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const isFormValid = startDate && endDate && reason.trim() && new Date(startDate) <= new Date(endDate);

  return (
    <Card>
      <CardHeader className="px-0 py-4 sm:py-6">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Request Vacation Days
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={isSubmitting}
                min={startDate}
              />
            </div>
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for vacation"
              required
              disabled={isSubmitting}
              rows={3}
            />
          </div>
          <Button 
            type="submit" 
            disabled={!isFormValid || isSubmitting}
            className="w-full md:w-auto"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
