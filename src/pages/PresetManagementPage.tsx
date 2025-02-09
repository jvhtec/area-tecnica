
import { useNavigate } from 'react-router-dom';
import { PresetCreationManager } from '@/components/equipment/PresetCreationManager';

export function PresetManagementPage() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Presets</h1>
      </div>
      <PresetCreationManager />
    </div>
  );
}
