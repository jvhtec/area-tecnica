
// Add the following import to your existing imports
import ConnectionSettings from "@/pages/ConnectionSettings";

// In your routes array, add the new route:
export const connectionSettingsRoute = {
  path: "/connection-settings",
  element: <ConnectionSettings />
};
