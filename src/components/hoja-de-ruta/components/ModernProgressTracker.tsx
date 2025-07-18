import React from "react";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { CheckCircle2, Circle } from "lucide-react";

interface ModernProgressTrackerProps {
  progress: number;
}

export const ModernProgressTracker: React.FC<ModernProgressTrackerProps> = ({ progress }) => {
  const getProgressColor = () => {
    if (progress < 25) return "bg-red-500";
    if (progress < 50) return "bg-amber-500";
    if (progress < 75) return "bg-blue-500";
    return "bg-green-500";
  };

  const getProgressText = () => {
    if (progress < 25) return "Inicio";
    if (progress < 50) return "En Progreso";
    if (progress < 75) return "Avanzado";
    return "Casi Completo";
  };

  return (
    <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-2 border-2">
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ rotate: progress === 100 ? 360 : 0 }}
          transition={{ duration: 0.5 }}
        >
          {progress === 100 ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground" />
          )}
        </motion.div>
        <span className="text-sm font-medium text-muted-foreground">
          {getProgressText()}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <Progress 
          value={progress} 
          className="w-24 h-2"
        />
        <span className="text-xs font-mono text-muted-foreground min-w-[3rem]">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
};