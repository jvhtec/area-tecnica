
import { useSessionManager } from './useSessionManager';

export const useSession = () => {
  const { session, isLoading } = useSessionManager();
  
  return {
    session,
    isLoading
  };
};
