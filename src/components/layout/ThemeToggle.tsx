import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useUserPreferences } from "@/hooks/useUserPreferences";

export const ThemeToggle = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { preferences, updatePreferences } = useUserPreferences();

  useEffect(() => {
    if (preferences?.dark_mode !== undefined) {
      console.log('Applying saved dark mode preference:', preferences.dark_mode);
      setIsDarkMode(preferences.dark_mode);
      if (preferences.dark_mode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [preferences]);

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    console.log('Toggling dark mode to:', newDarkMode);
    setIsDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    updatePreferences({ dark_mode: newDarkMode });
  };

  return (
    <Button 
      variant="ghost" 
      className="w-full justify-start gap-2" 
      onClick={toggleDarkMode}
    >
      {isDarkMode ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
      <span>{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
    </Button>
  );
};