
import { PresetCreationManager } from "@/components/equipment/PresetCreationManager";
import { EquipmentCreationManager } from "@/components/equipment/EquipmentCreationManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EquipmentManagement() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Equipment Management</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Equipment Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <EquipmentCreationManager />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Equipment Presets</CardTitle>
          </CardHeader>
          <CardContent>
            <PresetCreationManager />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
