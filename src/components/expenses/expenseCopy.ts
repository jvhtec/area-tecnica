/**
 * Spanish copy for technician expense workflow.
 * Centralized strings for tooltips, errors, and empty states.
 */

export const expenseCopy = {
  // Form labels
  labels: {
    date: 'Fecha del gasto',
    category: 'Categoría',
    amount: 'Importe',
    currency: 'Divisa',
    description: 'Descripción',
    receipt: 'Recibo',
  },

  // Placeholders
  placeholders: {
    date: 'Seleccionar fecha',
    category: 'Seleccionar categoría',
    amount: '0.00',
    currency: 'EUR',
    description: 'Detalles del gasto (opcional)',
  },

  // Status labels
  status: {
    draft: 'Borrador',
    submitted: 'Enviado',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  },

  // Actions
  actions: {
    submit: 'Enviar gasto',
    save: 'Guardar borrador',
    edit: 'Editar',
    delete: 'Eliminar',
    cancel: 'Cancelar',
    viewReceipt: 'Ver recibo',
    uploadReceipt: 'Subir recibo',
    removeReceipt: 'Quitar recibo',
    resubmit: 'Reenviar',
  },

  // Validation errors
  errors: {
    dateRequired: 'La fecha es obligatoria',
    categoryRequired: 'Debe seleccionar una categoría',
    amountRequired: 'El importe es obligatorio',
    amountPositive: 'El importe debe ser mayor que 0',
    amountInvalid: 'El importe no es válido',
    currencyRequired: 'La divisa es obligatoria',
    receiptRequired: 'Esta categoría requiere un recibo',
    receiptUploading: 'Esperando a que termine la subida del recibo',
    permissionMissing: 'No tienes permiso para gastos en esta categoría',
    permissionExpired: 'El permiso para esta categoría ha expirado',
    permissionInactive: 'El permiso aún no está activo',
    overDailyCap: 'Supera el límite diario permitido',
    overTotalCap: 'Supera el límite total permitido',
    uploadFailed: 'Error al subir el recibo',
    submitFailed: 'Error al enviar el gasto',
    deleteFailed: 'Error al eliminar el gasto',
  },

  // Success messages
  success: {
    saved: 'Borrador guardado correctamente',
    submitted: 'Gasto enviado para aprobación',
    deleted: 'Gasto eliminado',
    receiptUploaded: 'Recibo subido correctamente',
  },

  // Empty states
  empty: {
    noExpenses: 'No tienes gastos para este trabajo',
    noPermissions: 'No tienes permisos de gastos para este trabajo',
    noPendingExpenses: 'No tienes gastos pendientes',
  },

  // Info messages
  info: {
    receiptOptional: 'El recibo es opcional para esta categoría',
    receiptRequired: 'El recibo es obligatorio para esta categoría',
    uploading: 'Subiendo recibo...',
    waitingUpload: 'Esperando a que termine la subida',
    dailyCapInfo: (used: number, total: number, currency = 'EUR') =>
      `Has usado ${used.toFixed(2)} ${currency} de ${total.toFixed(2)} ${currency} hoy`,
    totalCapInfo: (used: number, total: number, currency = 'EUR') =>
      `Has usado ${used.toFixed(2)} ${currency} de ${total.toFixed(2)} ${currency} en total`,
    noCapInfo: 'Sin límite establecido',
  },

  // Rejection reasons
  rejection: {
    title: 'Motivo del rechazo',
    noReason: 'Sin motivo especificado',
  },

  // Totals
  totals: {
    pending: 'Pendiente',
    approved: 'Aprobado',
    total: 'Total gastos',
    byCategory: 'Por categoría',
  },

  // Permissions
  permissions: {
    validFrom: 'Válido desde',
    validTo: 'Válido hasta',
    dailyCap: 'Límite diario',
    totalCap: 'Límite total',
    noCap: 'Sin límite',
    active: 'Activo',
    inactive: 'Inactivo',
    expired: 'Expirado',
  },
} as const;
