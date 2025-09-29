
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Zap } from "lucide-react";
import { useTourPowerDefaults, TourPowerDefault } from "@/hooks/useTourPowerDefaults";

interface TourPowerDefaultsSectionProps {
  tourId: string;
}

interface PowerDefaultForm {
  table_name: string;
  pdu_type: string;
  custom_pdu_type: string;
  total_watts: string;
  current_per_phase: string;
  includes_hoist: boolean;
  department: string;
}

const defaultForm: PowerDefaultForm = {
  table_name: "",
  pdu_type: "CEE 16A",
  custom_pdu_type: "",
  total_watts: "",
  current_per_phase: "",
  includes_hoist: false,
  department: "all",
};

export const TourPowerDefaultsSection: React.FC<TourPowerDefaultsSectionProps> = ({ tourId }) => {
  const [formData, setFormData] = useState<PowerDefaultForm>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const {
    powerDefaults,
    isLoading,
    createDefault,
    updateDefault,
    deleteDefault,
    isCreating,
    isUpdating,
  } = useTourPowerDefaults(tourId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.table_name || !formData.total_watts || !formData.current_per_phase) {
      return;
    }

    const powerData = {
      tour_id: tourId,
      table_name: formData.table_name,
      pdu_type: formData.pdu_type,
      custom_pdu_type: formData.pdu_type === "Custom" ? formData.custom_pdu_type : null,
      total_watts: parseFloat(formData.total_watts),
      current_per_phase: parseFloat(formData.current_per_phase),
      includes_hoist: formData.includes_hoist,
      department: formData.department === "all" ? null : formData.department,
    };

    if (editingId) {
      updateDefault({ id: editingId, ...powerData });
      setEditingId(null);
    } else {
      createDefault(powerData);
    }
    
    setFormData(defaultForm);
  };

  const handleEdit = (powerDefault: TourPowerDefault) => {
    setFormData({
      table_name: powerDefault.table_name,
      pdu_type: powerDefault.pdu_type,
      custom_pdu_type: powerDefault.custom_pdu_type || "",
      total_watts: powerDefault.total_watts.toString(),
      current_per_phase: powerDefault.current_per_phase.toString(),
      includes_hoist: powerDefault.includes_hoist,
      department: powerDefault.department || "all",
    });
    setEditingId(powerDefault.id);
  };

  const handleCancel = () => {
    setFormData(defaultForm);
    setEditingId(null);
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading power defaults...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Default Power Requirements</h3>
      </div>

      {/* Existing power defaults */}
      <div className="space-y-3">
        {powerDefaults.map((powerDefault) => (
          <Card key={powerDefault.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-medium">{powerDefault.table_name}</div>
                <div className="text-sm text-muted-foreground">
                  {powerDefault.pdu_type === "Custom" && powerDefault.custom_pdu_type
                    ? powerDefault.custom_pdu_type
                    : powerDefault.pdu_type} - {powerDefault.total_watts}W, {powerDefault.current_per_phase}A
                  {powerDefault.includes_hoist && " (includes hoist)"}
                  {powerDefault.department && ` - ${powerDefault.department}`}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(powerDefault)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteDefault(powerDefault.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add/Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Edit Power Default" : "Add Power Default"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="table_name">Table Name</Label>
                <Input
                  id="table_name"
                  value={formData.table_name}
                  onChange={(e) => setFormData({ ...formData, table_name: e.target.value })}
                  placeholder="e.g., Main PA, Monitors"
                  required
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => setFormData({ ...formData, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="sound">Sound</SelectItem>
                    <SelectItem value="lights">Lights</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pdu_type">PDU Type</Label>
                <Select
                  value={formData.pdu_type}
                  onValueChange={(value) => setFormData({ ...formData, pdu_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CEE 16A">CEE 16A</SelectItem>
                  <SelectItem value="CEE 32A">CEE 32A</SelectItem>
                  <SelectItem value="CEE 63A">CEE 63A</SelectItem>
                  <SelectItem value="CEE 125A">CEE 125A</SelectItem>
                  <SelectItem value="Schuko">Schuko</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
                </Select>
              </div>
              {formData.pdu_type === "Custom" && (
                <div>
                  <Label htmlFor="custom_pdu_type">Custom PDU Type</Label>
                  <Input
                    id="custom_pdu_type"
                    value={formData.custom_pdu_type}
                    onChange={(e) => setFormData({ ...formData, custom_pdu_type: e.target.value })}
                    placeholder="Enter custom PDU type"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="total_watts">Total Watts</Label>
                <Input
                  id="total_watts"
                  type="number"
                  value={formData.total_watts}
                  onChange={(e) => setFormData({ ...formData, total_watts: e.target.value })}
                  placeholder="e.g., 5000"
                  required
                />
              </div>
              <div>
                <Label htmlFor="current_per_phase">Current per Phase (A)</Label>
                <Input
                  id="current_per_phase"
                  type="number"
                  step="0.1"
                  value={formData.current_per_phase}
                  onChange={(e) => setFormData({ ...formData, current_per_phase: e.target.value })}
                  placeholder="e.g., 7.2"
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="includes_hoist"
                checked={formData.includes_hoist}
                onCheckedChange={(checked) => setFormData({ ...formData, includes_hoist: checked })}
              />
              <Label htmlFor="includes_hoist">Includes hoist/rigging power</Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isCreating || isUpdating}>
                <Plus className="h-4 w-4 mr-2" />
                {editingId ? "Update" : "Add"} Default
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
