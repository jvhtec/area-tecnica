
import { useEffect } from "react";
import { connectionRecovery } from "@/lib/connection-recovery-service";

/**
 * Component that initializes app-wide services when the application starts
 * Doesn't render anything to the UI
 */
export function AppInit() {
  useEffect(() => {
    // Initialize the connection recovery service
    connectionRecovery.startRecovery();
    
    console.log('Application services initialized');
  }, []);
  
  // This component doesn't render anything
  return null;
}
