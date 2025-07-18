import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Sparkles,
  Plus,
  Clock,
  Users,
  Building2,
  Music,
  Palette,
  ChevronRight,
} from "lucide-react";
import { HojaDeRutaTemplate, EventData } from "@/types/hoja-de-ruta";

interface ModernTemplateManagerProps {
  templates: HojaDeRutaTemplate[];
  onApplyTemplate: (templateData: EventData) => void;
  isLoading: boolean;
}

export const ModernTemplateManager: React.FC<ModernTemplateManagerProps> = ({
  templates,
  onApplyTemplate,
  isLoading,
}) => {
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'corporate':
        return Building2;
      case 'festival':
        return Music;
      case 'wedding':
        return Sparkles;
      case 'conference':
        return Users;
      default:
        return FileText;
    }
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'corporate':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'festival':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'wedding':
        return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'conference':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card className="border-2">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-6 h-6 text-primary" />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
          </div>
          Plantillas
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {templates.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8 space-y-3"
          >
            <div className="w-12 h-12 mx-auto bg-muted rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Sin plantillas
              </p>
              <p className="text-xs text-muted-foreground">
                Crea tu primera plantilla
              </p>
            </div>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva Plantilla
            </Button>
          </motion.div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              <AnimatePresence>
                {templates.map((template, index) => {
                  const Icon = getEventTypeIcon(template.event_type);
                  const isExpanded = expandedTemplate === template.id;
                  
                  return (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.1 }}
                      className="group"
                    >
                      <div 
                        className="p-3 rounded-lg border-2 border-border/40 hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer"
                        onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-muted to-muted/60 rounded-lg flex items-center justify-center">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{template.name}</p>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getEventTypeColor(template.event_type)}`}
                              >
                                {template.event_type}
                              </Badge>
                            </div>
                          </div>
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </motion.div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="mt-3 pt-3 border-t border-border/40"
                            >
                              {template.description && (
                                <p className="text-xs text-muted-foreground mb-3">
                                  {template.description}
                                </p>
                              )}
                              
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onApplyTemplate(template.template_data);
                                }}
                                className="w-full gap-2"
                              >
                                <Sparkles className="w-3 h-3" />
                                Aplicar Plantilla
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};