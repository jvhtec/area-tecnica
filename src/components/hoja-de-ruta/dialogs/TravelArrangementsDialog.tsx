
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TravelArrangementsDialogProps } from "@/types/hoja-de-ruta/dialogs";
import { Trash2 } from "lucide-react";

export const TravelArrangementsDialog = ({
  travelArrangements,
  updateTravelArrangement,
  addTravelArrangement,
  removeTravelArrangement,
}: TravelArrangementsDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Editar Logística de Personal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Arreglos de Viaje</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {travelArrangements.map((arrangement, index) => (
            <div key={index} className="space-y-4 p-4 border rounded-lg">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">
                  Arreglo de Viaje {index + 1}
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTravelArrangement(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <Select
                value={arrangement.transportation_type}
                onValueChange={(value) =>
                  updateTravelArrangement(index, "transportation_type", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione el tipo de transporte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="van">Furgoneta</SelectItem>
                  <SelectItem value="sleeper_bus">Sleeper Bus Litera</SelectItem>
                  <SelectItem value="train">Tren</SelectItem>
                  <SelectItem value="plane">Avión</SelectItem>
                  <SelectItem value="RV">Autocaravana</SelectItem>
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dirección de Recogida</Label>
                  <Input
                    value={arrangement.pickup_address || ""}
                    onChange={(e) =>
                      updateTravelArrangement(index, "pickup_address", e.target.value)
                    }
                    placeholder="Dirección de recogida"
                  />
                </div>
                <div>
                  <Label>Hora de Recogida</Label>
                  <Input
                    type="datetime-local"
                    value={arrangement.pickup_time || ""}
                    onChange={(e) =>
                      updateTravelArrangement(index, "pickup_time", e.target.value)
                    }
                  />
                </div>
              </div>

              {(arrangement.transportation_type === "train" ||
                arrangement.transportation_type === "plane") && (
                <div>
                  <Label>Número de Vuelo/Tren</Label>
                  <Input
                    value={arrangement.flight_train_number || ""}
                    onChange={(e) =>
                      updateTravelArrangement(index, "flight_train_number", e.target.value)
                    }
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Hora de Salida</Label>
                  <Input
                    type="datetime-local"
                    value={arrangement.departure_time || ""}
                    onChange={(e) =>
                      updateTravelArrangement(index, "departure_time", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Hora de Llegada</Label>
                  <Input
                    type="datetime-local"
                    value={arrangement.arrival_time || ""}
                    onChange={(e) =>
                      updateTravelArrangement(index, "arrival_time", e.target.value)
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Notas</Label>
                <Textarea
                  value={arrangement.notes || ""}
                  onChange={(e) =>
                    updateTravelArrangement(index, "notes", e.target.value)
                  }
                />
              </div>
            </div>
          ))}
          <Button onClick={addTravelArrangement} variant="outline">
            Agregar Arreglo de Viaje
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
