import type { StaffingCampaignViewProps } from "@/components/matrix/staffingCampaignViewTypes";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  canResumeStaffingCampaign,
  staffingCampaignResumeLabel,
  staffingCampaignRoleStageLabel,
  staffingCampaignStatusLabel,
} from '@/features/staffing/campaignLifecycle';
import {
  CARLOS_AGENT_NAME,
  CARLOS_AUTO_MODE_LABEL,
} from '@/features/staffing/carlos';
import {
  JOB_PROFILE_LABELS,
  JobProfileName,
  PROFILE_OPTIONS,
  RatePenaltyStrength,
  SoftConflictPolicy,
  StaffingChannel,
  WaveMode,
} from '@/features/staffing/crewingProfiles';
import { getDepartmentLabel } from '@/types/department';
import { formatInJobTimezone } from '@/utils/timezoneUtils';

const isSoftConflictPolicy = (value: string): value is SoftConflictPolicy =>
  ['block', 'warn', 'manager_approval', 'ignore', 'allow'].includes(value)

export const StaffingCampaignView = ({
  jobMeta,
  inferredJobProfile,
  profileOverrideActive,
  roleCodes,
  roleProfiles,
  selectedProfileDefaults,
  applyProfileDefaults,
  updateRoleProfileOverride,
  formData,
  setFormData,
  updateMode,
  campaign,
  jobTitle,
  department,
  showStartDialog,
  setShowStartDialog,
  startMutation,
  campaignRoles,
  getStatusColor,
  getStageColor,
  updateMutation,
  pauseMutation,
  resumeMutation,
  stopMutation,
}: StaffingCampaignViewProps) => {
  const departmentLabel = getDepartmentLabel(department)
  const renderCrewingProfileSettings = () => (
    <div className="space-y-4 rounded border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Perfil automático</p>
          <p className="text-xs text-muted-foreground">
            Tipo de trabajo {jobMeta?.job_type || 'individual'}: perfil sugerido {JOB_PROFILE_LABELS[inferredJobProfile]}.
          </p>
        </div>
        {profileOverrideActive && (
          <Badge variant="outline">Perfil manual activo</Badge>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.inferProfileFromJobType}
          onChange={(e) => setFormData({ ...formData, inferProfileFromJobType: e.target.checked })}
        />
        <span className="text-sm">Inferir perfil por tipo de trabajo y rol</span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Perfil de trabajo sugerido</label>
          <div className="mt-1 rounded border bg-background px-2 py-1 text-sm">
            {JOB_PROFILE_LABELS[inferredJobProfile]}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Perfil de trabajo seleccionado</label>
          <select
            value={formData.selectedJobProfile}
            onChange={(e) => applyProfileDefaults(e.target.value as JobProfileName)}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          >
            {PROFILE_OPTIONS.map((profile) => (
              <option key={profile} value={profile}>{JOB_PROFILE_LABELS[profile]}</option>
            ))}
          </select>
        </div>
      </div>

      {profileOverrideActive && (
        <div>
          <label className="text-sm font-medium">Motivo del cambio</label>
          <input
            value={formData.profileOverrideReason}
            onChange={(e) => setFormData({ ...formData, profileOverrideReason: e.target.value })}
            placeholder="Por qué esta campaña debe usar otro perfil"
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          />
        </div>
      )}

      {roleCodes.length > 0 && (
        <div>
          <p className="text-sm font-medium">Perfiles por rol</p>
          <div className="mt-2 space-y-2">
            {roleCodes.map((roleCode) => {
              const roleProfile = roleProfiles[roleCode]
              if (!roleProfile) return null

              return (
                <div key={roleCode} className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-2 items-center rounded border bg-background p-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{roleCode}</span>
                      <Badge variant="outline">Requeridos {roleProfile.required_count}</Badge>
                      {roleProfile.is_critical && <Badge variant="secondary">Crítico</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sugerido: {JOB_PROFILE_LABELS[roleProfile.inferred_profile]}
                    </p>
                  </div>
                  <select
                    value={roleProfile.selected_profile}
                    onChange={(e) => updateRoleProfileOverride(roleCode, e.target.value as JobProfileName)}
                    className="w-full px-2 py-1 border rounded text-sm bg-background"
                  >
                    {PROFILE_OPTIONS.map((profile) => (
                      <option key={profile} value={profile}>{JOB_PROFILE_LABELS[profile]}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded border bg-background p-3">
        <p className="text-sm font-medium">Pesos del perfil</p>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
          <span>Habilidad de rol: {selectedProfileDefaults.weights.roleSkill.toFixed(2)}</span>
          <span>Fiabilidad: {formData.historyWeight.toFixed(2)}</span>
          <span>Equidad: {selectedProfileDefaults.weights.fairness.toFixed(2)}</span>
          <span>Proximidad: {formData.proximityWeight.toFixed(2)}</span>
          <span>Coste: {selectedProfileDefaults.weights.costEfficiency.toFixed(2)}</span>
          <span>Técnico de casa: {selectedProfileDefaults.weights.houseTechBonus.toFixed(2)}</span>
          <span>Progresión: {selectedProfileDefaults.weights.roleProgression.toFixed(2)}</span>
          <span>Disponibilidad: {selectedProfileDefaults.weights.availabilityConfidence.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )

  const renderCostAndWaveSettings = () => (
    <div className="space-y-4 rounded border bg-muted/30 p-3">
      <p className="text-sm font-semibold">Puntuación de coste/tarifa</p>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.costScoringEnabled}
          onChange={(e) => setFormData({ ...formData, costScoringEnabled: e.target.checked })}
        />
        <span className="text-sm">Aplicar ajuste por tarifa personalizada</span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Intensidad de penalización de tarifa</label>
          <select
            value={formData.ratePenaltyStrength}
            onChange={(e) => setFormData({ ...formData, ratePenaltyStrength: e.target.value as RatePenaltyStrength })}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          >
            <option value="disabled">Desactivado</option>
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Penalización máxima de tarifa</label>
          <input
            type="number"
            min="0"
            max="20"
            value={formData.maxRatePenalty}
            onChange={(e) => setFormData({ ...formData, maxRatePenalty: parseFloat(e.target.value) })}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          />
        </div>
      </div>

      <p className="text-sm font-semibold pt-2">Oleadas de contacto</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Modo de oleada</label>
          <select
            value={formData.waveMode}
            onChange={(e) => setFormData({ ...formData, waveMode: e.target.value as WaveMode })}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          >
            <option value="manual_selection">Selección manual</option>
            <option value="controlled_waves">Oleadas controladas</option>
            <option value="blast_all_eligible">Contactar todos los elegibles</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Tamaño de oleada</label>
          <input
            type="number"
            min="0"
            max="20"
            value={formData.waveBuffer}
            onChange={(e) => setFormData({ ...formData, waveBuffer: parseInt(e.target.value) })}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          />
          <p className="text-xs text-muted-foreground mt-1">Requeridos + este margen</p>
        </div>
        <div>
          <label className="text-sm font-medium">Espera entre oleadas (minutos)</label>
          <input
            type="number"
            min="3"
            max="120"
            value={formData.waveWaitMinutes}
            onChange={(e) => setFormData({ ...formData, waveWaitMinutes: parseInt(e.target.value) })}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Máximo de oleadas</label>
          <input
            type="number"
            min="1"
            max="10"
            value={formData.maxWaves}
            onChange={(e) => setFormData({ ...formData, maxWaves: parseInt(e.target.value) })}
            className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.autoSendNextWave}
          onChange={(e) => setFormData({ ...formData, autoSendNextWave: e.target.checked })}
        />
        <span className="text-sm">Enviar siguiente oleada automáticamente con {CARLOS_AGENT_NAME}</span>
      </label>

      <div className="rounded border bg-background p-3 text-xs text-muted-foreground">
        Cierre automático activo: cierra roles completos, detiene futuras oleadas, bloquea aceptaciones extra, confirma el equipo reservado y avisa a respuestas tardías o pendientes.
      </div>
    </div>
  )

  if (!campaign) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestión de campaña</CardTitle>
          <CardDescription>
            {jobTitle ? `${jobTitle} - ${departmentLabel}` : `Departamento de ${departmentLabel}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">No hay ninguna campaña activa para este trabajo.</p>
          <Button onClick={() => setShowStartDialog(true)}>Iniciar campaña</Button>

          <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Iniciar campaña de personal</DialogTitle>
                <DialogDescription>
                  Configura la campaña para el departamento de {departmentLabel}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Mode Selection */}
                <div>
                  <label className="text-sm font-medium">Modo</label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
                    <label className="flex min-w-0 items-start gap-2 cursor-pointer">
                      <input
                        className="mt-1"
                        type="radio"
                        name="mode"
                        value="assisted"
                        checked={formData.mode === 'assisted'}
                        onChange={() => updateMode('assisted')}
                      />
                      <span className="text-sm">Asistido (controlado por gestión)</span>
                    </label>
                    <label className="flex min-w-0 items-start gap-2 cursor-pointer">
                      <input
                        className="mt-1"
                        type="radio"
                        name="mode"
                        value="auto"
                        checked={formData.mode === 'auto'}
                        onChange={() => updateMode('auto')}
                      />
                      <span className="text-sm leading-snug">{CARLOS_AUTO_MODE_LABEL}</span>
                    </label>
                  </div>
                </div>

                {/* Scope Selection */}
                <div>
                  <label className="text-sm font-medium">Alcance</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        value="outstanding"
                        checked={formData.scope === 'outstanding'}
                        onChange={() => setFormData({ ...formData, scope: 'outstanding' })}
                      />
                      <span className="text-sm">Solo roles pendientes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        value="all"
                        checked={formData.scope === 'all'}
                        onChange={() => setFormData({ ...formData, scope: 'all' })}
                      />
                      <span className="text-sm">Todos los roles requeridos</span>
                    </label>
                  </div>
                </div>

                {renderCrewingProfileSettings()}

                {/* Weights */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Peso de proximidad</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="0.3"
                      value={formData.proximityWeight}
                      onChange={(e) => setFormData({ ...formData, proximityWeight: parseFloat(e.target.value) })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Peso del historial</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.15"
                      max="0.4"
                      value={formData.historyWeight}
                      onChange={(e) => setFormData({ ...formData, historyWeight: parseFloat(e.target.value) })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                    />
                  </div>
                </div>

                {/* TTLs */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Vigencia de disponibilidad (horas)</label>
                    <input
                      type="number"
                      min="1"
                      max="72"
                      value={formData.availabilityTtl}
                      onChange={(e) => setFormData({ ...formData, availabilityTtl: parseInt(e.target.value) })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Vigencia de la oferta (horas)</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={formData.offerTtl}
                      onChange={(e) => setFormData({ ...formData, offerTtl: parseInt(e.target.value) })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                    />
                  </div>
                </div>

                {renderCostAndWaveSettings()}

                {/* Conflict policy */}
                <div>
                  <label className="text-sm font-medium">Política de conflictos leves</label>
                  <select
                    value={formData.softConflictPolicy}
                    onChange={(e) => {
                      if (isSoftConflictPolicy(e.target.value)) {
                        setFormData({ ...formData, softConflictPolicy: e.target.value })
                      }
                    }}
                    className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                  >
                    <option value="block">Bloquear (predeterminado de {CARLOS_AGENT_NAME})</option>
                    <option value="warn">Avisar (modo asistido)</option>
                    <option value="manager_approval">Aprobación de responsable</option>
                    <option value="ignore">Ignorar</option>
                    <option value="allow">Permitir (escalado heredado)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Canal de envío</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value as StaffingChannel })}
                    className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                  >
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>

                {/* Fridge toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.excludeFridge}
                    onChange={(e) => setFormData({ ...formData, excludeFridge: e.target.checked })}
                  />
                  <span className="text-sm">Excluir técnicos en nevera (activado por defecto)</span>
                </label>

                {/* Offer message */}
                <div>
                  <label className="text-sm font-medium">Mensaje de oferta (opcional)</label>
                  <textarea
                    value={formData.offerMessage}
                    onChange={(e) => setFormData({ ...formData, offerMessage: e.target.value })}
                    placeholder="Nota personal para incluir en los correos de oferta..."
                    className="w-full mt-1 px-2 py-1 border rounded text-sm h-20 bg-background"
                  />
                </div>

                {formData.mode === 'auto' && (
                  <div>
                    <label className="text-sm font-medium">Intervalo de ejecución (segundos)</label>
                    <input
                      type="number"
                      min="60"
                      max="3600"
                      step="60"
                      value={formData.tickInterval}
                      onChange={(e) => setFormData({ ...formData, tickInterval: parseInt(e.target.value) })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowStartDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                  {startMutation.isPending ? 'Iniciando...' : 'Iniciar campaña'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Campaña activa</CardTitle>
            <CardDescription>
              {jobTitle ? `${jobTitle} - ${departmentLabel}` : `Departamento de ${departmentLabel}`}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(campaign.status)}>
            {staffingCampaignStatusLabel(campaign.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Campaign info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Modo</p>
            <p className="font-medium">{campaign.mode === 'assisted' ? 'Asistido' : CARLOS_AGENT_NAME}</p>
          </div>
          <div>
            <p className="text-gray-600">Creada</p>
            <p className="font-medium">{formatInJobTimezone(campaign.created_at, 'PPp')}</p>
          </div>
          {campaign.last_run_at && (
            <div>
              <p className="text-gray-600">Última ejecución</p>
              <p className="font-medium">{formatInJobTimezone(campaign.last_run_at, 'PPp')}</p>
            </div>
          )}
          {campaign.next_run_at && (
            <div>
              <p className="text-gray-600">Próxima ejecución</p>
              <p className="font-medium">{formatInJobTimezone(campaign.next_run_at, 'PPp')}</p>
            </div>
          )}
        </div>

        {/* Roles status */}
        {campaignRoles && campaignRoles.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Progreso por rol</h4>
            <div className="space-y-2">
              {campaignRoles.map((role) => (
                <div key={role.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{role.role_code}</p>
                    <p className="text-xs text-gray-600">
                      Asignados: {role.assigned_count} | Disponibles: {role.confirmed_availability} | Ofertas: {role.accepted_offers}
                    </p>
                  </div>
                  <Badge className={getStageColor(role.stage)}>
                    {staffingCampaignRoleStageLabel(role.stage)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editable Settings form */}
        <div className="border-t pt-4 space-y-6">
          <h4 className="text-sm font-semibold">Configuración de campaña</h4>

          <div className="space-y-6">
            {/* Mode Selection */}
            <div>
              <label className="text-sm font-medium">Modo</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
                <label className="flex min-w-0 items-start gap-2 cursor-pointer">
                  <input
                    className="mt-1"
                    type="radio"
                    name="active_mode"
                    value="assisted"
                    checked={formData.mode === 'assisted'}
                    onChange={() => updateMode('assisted')}
                  />
                  <span className="text-sm">Asistido (controlado por gestión)</span>
                </label>
                <label className="flex min-w-0 items-start gap-2 cursor-pointer">
                  <input
                    className="mt-1"
                    type="radio"
                    name="active_mode"
                    value="auto"
                    checked={formData.mode === 'auto'}
                    onChange={() => updateMode('auto')}
                  />
                  <span className="text-sm leading-snug">{CARLOS_AUTO_MODE_LABEL}</span>
                </label>
              </div>
            </div>

            {renderCrewingProfileSettings()}

            {/* Weights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Peso de proximidad</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="0.3"
                  value={formData.proximityWeight}
                  onChange={(e) => setFormData({ ...formData, proximityWeight: parseFloat(e.target.value) })}
                  className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Peso del historial (fiabilidad)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="0.5"
                  value={formData.historyWeight}
                  onChange={(e) => setFormData({ ...formData, historyWeight: parseFloat(e.target.value) })}
                  className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                />
              </div>
            </div>

            {/* TTLs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Vigencia de disponibilidad (horas)</label>
                <input
                  type="number"
                  min="1"
                  max="72"
                  value={formData.availabilityTtl}
                  onChange={(e) => setFormData({ ...formData, availabilityTtl: parseInt(e.target.value) })}
                  className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Vigencia de la oferta (horas)</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={formData.offerTtl}
                  onChange={(e) => setFormData({ ...formData, offerTtl: parseInt(e.target.value) })}
                  className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                />
              </div>
            </div>

            {renderCostAndWaveSettings()}

            {/* Conflict policy */}
            <div>
              <label className="text-sm font-medium">Política de conflictos leves</label>
              <select
                value={formData.softConflictPolicy}
                onChange={(e) => {
                  if (isSoftConflictPolicy(e.target.value)) {
                    setFormData({ ...formData, softConflictPolicy: e.target.value })
                  }
                }}
                className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
              >
                <option value="block">Bloquear (predeterminado de {CARLOS_AGENT_NAME})</option>
                <option value="warn">Avisar (modo asistido)</option>
                <option value="manager_approval">Aprobación de responsable</option>
                <option value="ignore">Ignorar</option>
                <option value="allow">Permitir (escalado heredado)</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Canal de envío</label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value as StaffingChannel })}
                className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              {campaign.mode === 'assisted' && formData.mode === 'auto' && (
                <p className="text-xs text-gray-600 mt-1">
                  {CARLOS_AGENT_NAME} usará respuestas existentes de disponibilidad y oferta en modo asistido antes de contactar nuevos candidatos.
                </p>
              )}
            </div>

            {/* Fridge toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.excludeFridge}
                onChange={(e) => setFormData({ ...formData, excludeFridge: e.target.checked })}
              />
              <span className="text-sm">Excluir técnicos en nevera</span>
            </label>

            {/* Offer message */}
            <div>
              <label className="text-sm font-medium">Mensaje de oferta</label>
              <textarea
                value={formData.offerMessage}
                onChange={(e) => setFormData({ ...formData, offerMessage: e.target.value })}
                placeholder="Nota personal para incluir en los correos de oferta..."
                className="w-full mt-1 px-2 py-1 border rounded text-sm h-20 bg-background"
              />
            </div>

            {formData.mode === 'auto' && (
              <div>
                <label className="text-sm font-medium">Intervalo de ejecución (segundos)</label>
                <input
                  type="number"
                  min="60"
                  max="3600"
                  step="60"
                  value={formData.tickInterval}
                  onChange={(e) => setFormData({ ...formData, tickInterval: parseInt(e.target.value) })}
                  className="w-full mt-1 px-2 py-1 border rounded text-sm bg-background"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 border-t pt-4">
          {campaign.status === 'active' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pauseMutation.mutate()}
                disabled={pauseMutation.isPending}
              >
                Pausar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
              >
                Detener
              </Button>
            </>
          ) : campaign.status === 'paused' ? (
            <>
              <Button
                size="sm"
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
              >
                Reanudar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
              >
                Detener
              </Button>
            </>
          ) : canResumeStaffingCampaign(campaign.status) ? (
            <Button
              size="sm"
              onClick={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
            >
              {staffingCampaignResumeLabel(campaign.status)}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
};
