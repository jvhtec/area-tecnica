import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus } from 'lucide-react';
import { expenseCopy } from './expenseCopy';
import { ReceiptUploadField } from './ReceiptUploadField';
import { useExpensePermissions, isPermissionActive, getEffectiveCap } from '@/hooks/useExpensePermissions';
import { useJobExpenseMutations, useReceiptUpload } from '@/hooks/useJobExpenses';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

// Zod schema for expense form
const expenseFormSchema = z.object({
  expense_date: z.string().min(1, expenseCopy.errors.dateRequired),
  category_slug: z.string().min(1, expenseCopy.errors.categoryRequired),
  amount_original: z.coerce
    .number({ invalid_type_error: expenseCopy.errors.amountInvalid })
    .positive(expenseCopy.errors.amountPositive),
  currency_code: z.string().min(3, expenseCopy.errors.currencyRequired).max(3),
  description: z.string().optional(),
  receipt_file: z.instanceof(File).optional().nullable(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

interface ExpenseFormProps {
  jobId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  defaultDate?: string;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  jobId,
  onSuccess,
  onCancel,
  defaultDate,
}) => {
  const { data: permissions = [], isLoading: isLoadingPermissions } = useExpensePermissions(jobId);
  const { submitExpense } = useJobExpenseMutations();
  const { uploadReceipt, progress, isUploading } = useReceiptUpload();

  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      expense_date: defaultDate || format(new Date(), 'yyyy-MM-dd'),
      category_slug: '',
      amount_original: 0,
      currency_code: 'EUR',
      description: '',
      receipt_file: null,
    },
  });

  const selectedCategory = watch('category_slug');
  const selectedDate = watch('expense_date');

  // Find the permission for the selected category
  const selectedPermission = permissions.find((p) => p.category_slug === selectedCategory);
  const requiresReceipt = selectedPermission?.category?.requires_receipt || false;

  // Check if permission is active
  const permissionActive = selectedPermission
    ? isPermissionActive(selectedPermission, new Date(selectedDate || new Date()))
    : false;

  // Get effective caps
  const dailyCap = selectedPermission ? getEffectiveCap(selectedPermission, 'daily') : null;
  const totalCap = selectedPermission ? getEffectiveCap(selectedPermission, 'total') : null;

  // Handle receipt file change
  const handleReceiptChange = async (file: File | null) => {
    if (!file) {
      setReceiptPath(null);
      setValue('receipt_file', null);
      setUploadError(null);
      return;
    }

    try {
      setUploadError(null);
      const path = await uploadReceipt(file, jobId);
      setReceiptPath(path);
      setValue('receipt_file', file);
    } catch (error) {
      console.error('Receipt upload error:', error);
      setUploadError(expenseCopy.errors.uploadFailed);
      setReceiptPath(null);
      setValue('receipt_file', null);
    }
  };

  const handleReceiptRemove = () => {
    setReceiptPath(null);
    setValue('receipt_file', null);
    setUploadError(null);
  };

  const onSubmit = async (data: ExpenseFormData) => {
    // Validate receipt if required
    if (requiresReceipt && !receiptPath) {
      setUploadError(expenseCopy.errors.receiptRequired);
      return;
    }

    // Check if still uploading
    if (isUploading) {
      setUploadError(expenseCopy.errors.receiptUploading);
      return;
    }

    try {
      await submitExpense.mutateAsync({
        job_id: jobId,
        category_slug: data.category_slug,
        expense_date: data.expense_date,
        amount_original: data.amount_original,
        currency_code: data.currency_code,
        description: data.description,
        receipt_path: receiptPath || undefined,
      });

      // Reset form on success
      reset();
      setReceiptPath(null);
      setUploadError(null);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      // Error is handled in the mutation
      console.error('Submit error:', error);
    }
  };

  // Show loading state
  if (isLoadingPermissions) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Show message if no permissions
  if (permissions.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{expenseCopy.empty.noPermissions}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nuevo Gasto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="expense_date">
              {expenseCopy.labels.date}
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="expense_date"
              type="date"
              {...register('expense_date')}
              className={errors.expense_date ? 'border-red-500' : ''}
            />
            {errors.expense_date && (
              <p className="text-sm text-red-600">{errors.expense_date.message}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category_slug">
              {expenseCopy.labels.category}
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Select
              value={selectedCategory}
              onValueChange={(value) => setValue('category_slug', value)}
            >
              <SelectTrigger className={errors.category_slug ? 'border-red-500' : ''}>
                <SelectValue placeholder={expenseCopy.placeholders.category} />
              </SelectTrigger>
              <SelectContent>
                {permissions.map((permission) => (
                  <SelectItem key={permission.id} value={permission.category_slug}>
                    {permission.category?.label_es || permission.category_slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category_slug && (
              <p className="text-sm text-red-600">{errors.category_slug.message}</p>
            )}
            {selectedPermission && !permissionActive && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {selectedPermission.valid_from && selectedDate < selectedPermission.valid_from
                    ? expenseCopy.errors.permissionInactive
                    : expenseCopy.errors.permissionExpired}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="amount_original">
                {expenseCopy.labels.amount}
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                id="amount_original"
                type="number"
                step="0.01"
                min="0"
                placeholder={expenseCopy.placeholders.amount}
                {...register('amount_original')}
                className={errors.amount_original ? 'border-red-500' : ''}
              />
              {errors.amount_original && (
                <p className="text-sm text-red-600">{errors.amount_original.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency_code">{expenseCopy.labels.currency}</Label>
              <Select
                value={watch('currency_code')}
                onValueChange={(value) => setValue('currency_code', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cap information */}
          {(dailyCap !== null || totalCap !== null) && (
            <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-md">
              {dailyCap !== null && <p>{expenseCopy.info.dailyCapInfo(0, dailyCap)}</p>}
              {totalCap !== null && <p>{expenseCopy.info.totalCapInfo(0, totalCap)}</p>}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{expenseCopy.labels.description}</Label>
            <Textarea
              id="description"
              placeholder={expenseCopy.placeholders.description}
              rows={2}
              {...register('description')}
            />
          </div>

          {/* Receipt Upload */}
          <ReceiptUploadField
            value={receiptPath}
            isRequired={requiresReceipt}
            isUploading={isUploading}
            uploadProgress={progress}
            error={uploadError || undefined}
            onChange={handleReceiptChange}
            onRemove={handleReceiptRemove}
            disabled={isSubmitting}
          />

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting || isUploading || !permissionActive}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                expenseCopy.actions.submit
              )}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {expenseCopy.actions.cancel}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
