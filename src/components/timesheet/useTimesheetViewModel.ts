
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, FileText, Download, Plus, User, Trash2, AlertTriangle, Mail, Receipt } from "lucide-react";
import { useTimesheets } from "@/hooks/useTimesheets";
import { useJobAssignmentsRealtime } from "@/hooks/useJobAssignmentsRealtime";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { Timesheet, TimesheetFormData } from "@/types/timesheet";
import { TimesheetSignature } from "./TimesheetSignature";
import { MyJobTotal } from "./MyJobTotal";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { sendTimesheetReminder } from "@/lib/timesheet-reminder-email";
import { formatCurrency } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExpenseList, ExpenseSummaryCard } from "@/components/expenses";
import { useJobExpenses } from "@/hooks/useJobExpenses";
import { isManagementRole, isTechnicianRole } from "@/utils/permissions";

import { TimesheetEditForm } from "./TimesheetEditForm";
import { TimesheetRejectDialog } from "./TimesheetRejectDialog";
import { useJobClosureLock } from "@/hooks/useJobClosureLock";
import { calculateHours } from "./utils";
import { isPrepDayBreakdown, isPrepDayTimesheet, prepDayHourlyRate } from "@/utils/timesheetPrepDays";


export interface TimesheetViewProps {
  jobId: string;
  jobTitle?: string;
  canManage?: boolean;
  filterDepartment?: string;
  filterTechnicianId?: string;
  filterDate?: string;
}


export const useTimesheetViewModel = ({
  jobId,
  jobTitle,
  canManage = false,
  filterDepartment,
  filterTechnicianId,
  filterDate,
}: TimesheetViewProps) => {
  // Ensure userRole is initialized before passing into hooks that depend on it
  const { user, userRole } = useOptimizedAuth();
  const { timesheets, isLoading, createTimesheet, updateTimesheet, submitTimesheet, approveTimesheet, rejectTimesheet, signTimesheet, deleteTimesheet, deleteTimesheets, recalcTimesheet, revertTimesheet, resetTimesheet, refetch } = useTimesheets(jobId, { userRole });
  const { assignments } = useJobAssignmentsRealtime(jobId);
  const { toast } = useToast();

  // Expense state and queries - must be before any early returns
  const { data: expenses = [] } = useJobExpenses(jobId);

  const { isClosureLocked, isAdminOverridingClosure } = useJobClosureLock(jobId, userRole);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editingTimesheet, setEditingTimesheet] = useState<string | null>(null);
  const [selectedTimesheets, setSelectedTimesheets] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showBulkEditForm, setShowBulkEditForm] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkFormData, setBulkFormData] = useState<Partial<TimesheetFormData>>({
    start_time: '',
    end_time: '',
    break_minutes: undefined,
    overtime_hours: undefined,
    notes: '',
    ends_next_day: false
  });
  const [formData, setFormData] = useState<TimesheetFormData>({
    date: selectedDate,
    start_time: "09:00",
    end_time: "17:00",
    break_minutes: 30, // Default to 30 for convenience
    overtime_hours: 0,
    notes: "",
    ends_next_day: false,
    category: undefined
  });
  const [timesheetBeingRejected, setTimesheetBeingRejected] = useState<Timesheet | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [rejectResetHours, setRejectResetHours] = useState(false);
  const [rejectSendEmail, setRejectSendEmail] = useState(true);
  const [submitPromptTimesheetId, setSubmitPromptTimesheetId] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // Filter timesheets based on user role and props
  const filteredTimesheets = useMemo(() => {
    if (!timesheets || !user) return [];

    let filtered = timesheets;

    // First filter by role
    if (isTechnicianRole(userRole)) {
      filtered = filtered.filter(t => t.technician_id === user.id);
    }

    // Then apply explicit filters (mostly for management)
    if (filterDepartment && filterDepartment !== 'all') {
      filtered = filtered.filter(t => t.technician?.department === filterDepartment);
    }

    if (filterTechnicianId && filterTechnicianId !== 'all') {
      filtered = filtered.filter(t => t.technician_id === filterTechnicianId);
    }

    if (filterDate) {
      filtered = filtered.filter(t => t.date === filterDate);
    }

    return filtered;
  }, [timesheets, userRole, user, filterDepartment, filterTechnicianId, filterDate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'submitted': return 'default';
      case 'approved': return 'outline';
      case 'rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  const translateStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'draft': 'Borrador',
      'submitted': 'Enviado',
      'approved': 'Aprobado',
      'rejected': 'Rechazado'
    };
    return statusMap[status] || status;
  };

  const handleCreateTimesheets = async () => {
    if (!assignments.length) {
      return;
    }

    for (const assignment of assignments) {
      await createTimesheet(assignment.technician_id, selectedDate);
    }
  };

  const handleUpdateTimesheet = async (timesheet: Timesheet) => {
    if (!editingTimesheet || isClosureLocked) return;
    const isPrepDay = isPrepDayTimesheet(timesheet);

    await updateTimesheet(editingTimesheet, {
      start_time: formData.start_time,
      end_time: formData.end_time,
      break_minutes: formData.break_minutes,
      overtime_hours: isPrepDay ? 0 : formData.overtime_hours,
      notes: formData.notes,
      ends_next_day: formData.ends_next_day,
      category: isPrepDay ? undefined : formData.category
    });
    setEditingTimesheet(null);
  };

  const startEditing = (timesheet: Timesheet) => {
    if (isClosureLocked) return;
    setEditingTimesheet(timesheet.id);
    setFormData({
      date: timesheet.date,
      start_time: timesheet.start_time || "09:00",
      end_time: timesheet.end_time || "17:00",
      break_minutes: timesheet.break_minutes || 0,
      overtime_hours: timesheet.overtime_hours || 0,
      notes: timesheet.notes || "",
      ends_next_day: timesheet.ends_next_day || false,
      category: timesheet.category
    });
  };

  // Auto-detect overnight shifts when editing
  useEffect(() => {
    if (editingTimesheet && formData.start_time && formData.end_time) {
      const isOvernightShift = formData.end_time < formData.start_time;
      if (isOvernightShift && !formData.ends_next_day) {
        // Automatically check the ends_next_day checkbox
        setFormData(prev => ({ ...prev, ends_next_day: true }));
      } else if (!isOvernightShift && formData.ends_next_day) {
        // Automatically uncheck if times are corrected
        setFormData(prev => ({ ...prev, ends_next_day: false }));
      }
    }
  }, [
    editingTimesheet,
    formData.end_time,
    formData.ends_next_day,
    formData.start_time,
  ]);

  // Auto-detect overnight shifts when bulk editing
  useEffect(() => {
    if (showBulkEditForm && bulkFormData.start_time && bulkFormData.end_time) {
      const isOvernightShift = bulkFormData.end_time < bulkFormData.start_time;
      if (isOvernightShift && !bulkFormData.ends_next_day) {
        setBulkFormData(prev => ({ ...prev, ends_next_day: true }));
      } else if (!isOvernightShift && bulkFormData.ends_next_day) {
        setBulkFormData(prev => ({ ...prev, ends_next_day: false }));
      }
    }
  }, [
    bulkFormData.end_time,
    bulkFormData.ends_next_day,
    bulkFormData.start_time,
    showBulkEditForm,
  ]);

  const openRejectDialog = (timesheet: Timesheet) => {
    setTimesheetBeingRejected(timesheet);
    setRejectionNotes(timesheet.rejection_reason ?? '');
    setRejectResetHours(false);
    setRejectSendEmail(true);
  };

  const closeRejectDialog = () => {
    setTimesheetBeingRejected(null);
    setRejectionNotes('');
  };

  const confirmRejectTimesheet = async () => {
    if (!timesheetBeingRejected) return;
    await rejectTimesheet(timesheetBeingRejected.id, rejectionNotes.trim() || undefined, {
      resetHours: rejectResetHours,
      sendEmail: rejectSendEmail,
    });
    closeRejectDialog();
  };

  // After a technician signs their own draft/rejected part, immediately offer
  // to submit it — techs often sign and forget to hit send.
  const handleSigned = async (timesheetId: string, signatureData: string) => {
    const result = await signTimesheet(timesheetId, signatureData);
    const signed = timesheets.find((t) => t.id === timesheetId);
    if (result && signed && signed.technician_id === user?.id && (signed.status === 'draft' || signed.status === 'rejected')) {
      setSubmitPromptTimesheetId(timesheetId);
    }
    return result;
  };

  const handleSendReminder = async (timesheetId: string) => {
    setSendingReminder(timesheetId);
    try {
      const result = await sendTimesheetReminder(timesheetId);
      if (result.success) {
        toast({
          title: "Recordatorio enviado",
          description: `Email enviado a ${result.sentTo}`,
        });
      } else {
        toast({
          title: "Error al enviar recordatorio",
          description: result.error || "No se pudo enviar el email",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error al enviar recordatorio",
        description: "Ocurrió un error inesperado",
        variant: "destructive",
      });
    } finally {
      setSendingReminder(null);
    }
  };

  const handleBulkAction = async (action: 'submit' | 'approve' | 'delete') => {
    if (selectedTimesheets.size === 0 || isClosureLocked) return;

    setIsBulkUpdating(true);
    const timesheetIds = Array.from(selectedTimesheets);

    try {
      if (action === 'delete') {
        await deleteTimesheets(timesheetIds);
      } else {
        const promises = timesheetIds.map(timesheetId => {
          if (action === 'submit') {
            return submitTimesheet(timesheetId);
          } else if (action === 'approve') {
            return approveTimesheet(timesheetId);
          }
        });

        await Promise.all(promises);
      }

      setSelectedTimesheets(new Set());
      setShowBulkActions(false);

      // Refetch after bulk operations
      setTimeout(() => {
        refetch();
      }, 500);
    } catch (error) {
      console.error(`Error in bulk ${action}:`, error);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkEdit = async () => {
    if (isClosureLocked) return;
    console.log('Bulk edit starting with:', {
      selectedTimesheets: Array.from(selectedTimesheets),
      bulkFormData
    });

    setIsBulkUpdating(true);

    try {
      const promises = Array.from(selectedTimesheets).map(timesheetId => {
        const timesheet = filteredTimesheets.find(t => t.id === timesheetId);
        const isPrepDay = timesheet ? isPrepDayTimesheet(timesheet) : false;
        const updates: Partial<Timesheet> = {};

        if (bulkFormData.start_time) updates.start_time = bulkFormData.start_time;
        if (bulkFormData.end_time) updates.end_time = bulkFormData.end_time;
        if (bulkFormData.break_minutes !== undefined) updates.break_minutes = bulkFormData.break_minutes;
        if (bulkFormData.overtime_hours !== undefined) {
          updates.overtime_hours = isPrepDay ? 0 : bulkFormData.overtime_hours;
        }
        if (bulkFormData.notes) updates.notes = bulkFormData.notes;
        if (bulkFormData.ends_next_day !== undefined) updates.ends_next_day = bulkFormData.ends_next_day;
        if (!isPrepDay && bulkFormData.category !== undefined) {
          updates.category = bulkFormData.category;
        }

        console.log('Updating timesheet', timesheetId, 'with:', updates);
        // Skip refetch for bulk operations
        return updateTimesheet(timesheetId, updates, true);
      });

      const results = await Promise.all(promises);
      console.log('Bulk edit results:', results);

      // Now refetch once to get all updated data
      await refetch();

      setSelectedTimesheets(new Set());
      setShowBulkActions(false);
      setShowBulkEditForm(false);
      setBulkFormData({
        start_time: '',
        end_time: '',
        break_minutes: undefined,
        overtime_hours: undefined,
        notes: '',
        ends_next_day: false
      });

      console.log('Bulk edit completed successfully');
    } catch (error) {
      console.error('Error in bulk edit:', error);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const toggleTimesheetSelection = (timesheetId: string) => {
    const newSelection = new Set(selectedTimesheets);
    if (newSelection.has(timesheetId)) {
      newSelection.delete(timesheetId);
    } else {
      newSelection.add(timesheetId);
    }
    setSelectedTimesheets(newSelection);
    setShowBulkActions(newSelection.size > 0);
  };

  const selectAllVisibleTimesheets = () => {
    const visibleIds = filteredTimesheets.map(t => t.id);
    setSelectedTimesheets(new Set(visibleIds));
    setShowBulkActions(visibleIds.length > 0);
  };

  const clearSelection = () => {
    setSelectedTimesheets(new Set());
    setShowBulkActions(false);
    setShowBulkEditForm(false);
  };

  const timesheetsByDate = filteredTimesheets.reduce((acc, timesheet) => {
    const date = timesheet.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(timesheet);
    return acc;
  }, {} as Record<string, Timesheet[]>);

  const isManagementUser = isManagementRole(userRole);
  const isTechnician = isTechnicianRole(userRole);
  const isHouseTech = userRole === 'house_tech';

  console.log('TimesheetView Debug:', {
    userRole,
    isManagementUser,
    isTechnician,
    canManage,
    filteredTimesheetsLength: filteredTimesheets.length,
    user: user?.email,
    userId: user?.id
  });

  // Expense section in TimesheetView is management-only.
  // Technicians access expenses via AssignmentCard dialog.
  const canViewExpenses = !isTechnician;


  return {
    jobId,
    jobTitle,
    canManage,
    filterDepartment,
    filterTechnicianId,
    filterDate,
    user,
    userRole,
    timesheets,
    isLoading,
    createTimesheet,
    updateTimesheet,
    submitTimesheet,
    approveTimesheet,
    rejectTimesheet,
    signTimesheet,
    deleteTimesheet,
    deleteTimesheets,
    recalcTimesheet,
    revertTimesheet,
    resetTimesheet,
    refetch,
    assignments,
    expenses,
    isClosureLocked,
    isAdminOverridingClosure,
    selectedDate,
    setSelectedDate,
    editingTimesheet,
    setEditingTimesheet,
    selectedTimesheets,
    setSelectedTimesheets,
    showBulkActions,
    setShowBulkActions,
    showBulkEditForm,
    setShowBulkEditForm,
    isBulkUpdating,
    bulkFormData,
    setBulkFormData,
    formData,
    setFormData,
    timesheetBeingRejected,
    rejectionNotes,
    setRejectionNotes,
    rejectResetHours,
    setRejectResetHours,
    rejectSendEmail,
    setRejectSendEmail,
    submitPromptTimesheetId,
    setSubmitPromptTimesheetId,
    sendingReminder,
    filteredTimesheets,
    getStatusColor,
    translateStatus,
    handleCreateTimesheets,
    handleUpdateTimesheet,
    startEditing,
    openRejectDialog,
    closeRejectDialog,
    confirmRejectTimesheet,
    handleSigned,
    handleSendReminder,
    handleBulkAction,
    handleBulkEdit,
    toggleTimesheetSelection,
    selectAllVisibleTimesheets,
    clearSelection,
    timesheetsByDate,
    isManagementUser,
    isTechnician,
    isHouseTech,
    canViewExpenses,
  };
};
