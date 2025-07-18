import React from "react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Clock,
  Eye,
  CheckCircle2,
  FileCheck,
  AlertTriangle,
} from "lucide-react";

interface ModernStatusIndicatorProps {
  status: string;
}

export const ModernStatusIndicator: React.FC<ModernStatusIndicatorProps> = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'draft':
        return {
          icon: Clock,
          color: 'bg-amber-500',
          text: 'Borrador',
          textColor: 'text-amber-700',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
        };
      case 'review':
        return {
          icon: Eye,
          color: 'bg-blue-500',
          text: 'En Revisión',
          textColor: 'text-blue-700',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
        };
      case 'approved':
        return {
          icon: CheckCircle2,
          color: 'bg-green-500',
          text: 'Aprobado',
          textColor: 'text-green-700',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
        };
      case 'final':
        return {
          icon: FileCheck,
          color: 'bg-emerald-600',
          text: 'Final',
          textColor: 'text-emerald-700',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200',
        };
      default:
        return {
          icon: AlertTriangle,
          color: 'bg-gray-500',
          text: 'Sin Estado',
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${config.bgColor} ${config.borderColor}`}
    >
      <div className={`w-2 h-2 rounded-full ${config.color}`}>
        <motion.div
          className={`w-full h-full rounded-full ${config.color}`}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <Icon className={`w-4 h-4 ${config.textColor}`} />
      <span className={`text-sm font-medium ${config.textColor}`}>
        {config.text}
      </span>
    </motion.div>
  );
};