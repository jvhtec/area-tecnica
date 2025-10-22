import { Card } from '@/components/ui/card';
import { SoundVisionDatabaseDialog } from '@/components/soundvision/SoundVisionDatabaseDialog';

const SoundVisionFiles = () => {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <Card className="p-6">
        <SoundVisionDatabaseDialog />
      </Card>
    </div>
  );
};

export default SoundVisionFiles;
