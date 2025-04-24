
// Compatibility layer to provide backward compatibility
// after session management consolidation
import { useAuthSession } from '@/hooks/useAuthSession';

// Re-export useAuthSession as useSessionManager to maintain compatibility
export const useSessionManager = useAuthSession;
