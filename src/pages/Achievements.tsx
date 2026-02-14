import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AchievementsGrid } from '@/components/achievements/AchievementsGrid';

export default function Achievements() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full max-w-4xl mx-auto px-4 lg:px-8 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Mis Logros</h1>
        </div>

        <AchievementsGrid />
      </div>
    </div>
  );
}
