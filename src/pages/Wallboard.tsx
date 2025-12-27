import { useRoleGuard } from '@/hooks/useRoleGuard';
import { WallboardDisplay } from './wallboard/WallboardDisplay';

export { WallboardDisplay };

export default function Wallboard() {
  useRoleGuard(['admin', 'management', 'wallboard']);
  return <WallboardDisplay />;
}

