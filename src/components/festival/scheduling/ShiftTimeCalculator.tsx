
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, Clock, Users, Settings } from "lucide-react";
import { useShiftTimeCalculator } from "@/hooks/useShiftTimeCalculator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ShiftTimeCalculatorProps {
  jobId: string;
  date: string;
  stage?: number;
  onApplyTimes: (startTime: string, endTime: string) => void;
}

export const ShiftTimeCalculator = ({ jobId, date, stage, onApplyTimes }: ShiftTimeCalculatorProps) => {
  const [numberOfShifts, setNumberOfShifts] = useState<number>(3);
  const [isOpen, setIsOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  
  // Configuration parameters with defaults
  const [startTimeBuffer, setStartTimeBuffer] = useState<number>(30); // minutes
  const [teardownTime, setTeardownTime] = useState<number>(4); // hours
  
  const { artists, isLoading, calculateOptimalShifts, getScheduleSummary } = useShiftTimeCalculator(
    jobId, 
    date, 
    stage, 
    startTimeBuffer, 
    teardownTime
  );

  const calculatedShifts = calculateOptimalShifts(numberOfShifts);

  const handleStartTimeBufferChange = (value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 120) {
      setStartTimeBuffer(numValue);
    }
  };

  const handleTeardownTimeChange = (value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 8) {
      setTeardownTime(numValue);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" type="button" className="w-full">
          <Calculator className="h-4 w-4 mr-2" />
          Calculadora de Horarios de Turnos
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Calcular Horarios Óptimos de Turnos
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Configuration Section */}
            <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" type="button" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  Configuración
                  {(startTimeBuffer !== 30 || teardownTime !== 4) && (
                    <Badge variant="secondary" className="ml-2 text-xs">Personalizado</Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-3 space-y-3 border rounded-lg p-3 bg-muted/20">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="start-buffer" className="text-xs">
                      Tiempo de Preparación (minutos)
                    </Label>
                    <Input
                      id="start-buffer"
                      type="number"
                      min="0"
                      max="120"
                      value={startTimeBuffer}
                      onChange={(e) => handleStartTimeBufferChange(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teardown-time" className="text-xs">
                      Tiempo de Desmontaje (horas)
                    </Label>
                    <Input
                      id="teardown-time"
                      type="number"
                      min="0"
                      max="8"
                      value={teardownTime}
                      onChange={(e) => handleTeardownTimeChange(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  El tiempo de preparación se añade antes del primer soundcheck. El tiempo de desmontaje se añade después del último show en el día final del festival.
                </div>
              </CollapsibleContent>
            </Collapsible>

            {isLoading ? (
              <div className="text-sm text-muted-foreground">Cargando programación de artistas...</div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    {stage ? `Programación Stage ${stage}` : "Programación del Festival"}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    {artists.length} artistas programados
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {getScheduleSummary()}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Número de Turnos</label>
                  <Select value={numberOfShifts.toString()} onValueChange={(value) => setNumberOfShifts(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 Turnos</SelectItem>
                      <SelectItem value="3">3 Turnos</SelectItem>
                      <SelectItem value="4">4 Turnos</SelectItem>
                      <SelectItem value="5">5 Turnos</SelectItem>
                      <SelectItem value="6">6 Turnos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {calculatedShifts.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">
                      Turnos Sugeridos (con solapamiento de 1h) - Total: {
                        Math.round(calculatedShifts.reduce((total, shift) => total + shift.duration, 0) * 10) / 10
                      }h
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {calculatedShifts.map((shift, index) => (
                        <div key={index} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{shift.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {shift.duration}h
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {shift.start_time} - {shift.end_time}
                          </div>
                          {shift.overlap && (
                            <div className="text-xs text-blue-600">
                              {shift.overlap}
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => onApplyTimes(shift.start_time, shift.end_time)}
                            className="w-full mt-2"
                          >
                            Aplicar al Formulario
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {artists.length === 0 && (
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {stage
                      ? `No hay artistas programados para el Stage ${stage} en esta fecha.`
                      : "No hay artistas programados para esta fecha. Añade artistas primero para calcular horarios óptimos de turnos."
                    }
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
