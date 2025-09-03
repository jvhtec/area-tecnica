
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
import { RoomAssignment } from "@/types/hoja-de-ruta";
import { Trash2 } from "lucide-react";

interface RoomAssignmentsDialogProps {
  roomAssignments: RoomAssignment[];
  eventData: any;
  updateRoomAssignment: (index: number, field: keyof RoomAssignment, value: string) => void;
  addRoomAssignment: () => void;
  removeRoomAssignment: (index: number) => void;
}

export const RoomAssignmentsDialog = ({
  roomAssignments,
  eventData,
  updateRoomAssignment,
  addRoomAssignment,
  removeRoomAssignment,
}: RoomAssignmentsDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Editar Asignaciones de Habitaciones
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Asignaciones de Habitaciones</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {roomAssignments.map((assignment, index) => (
            <div key={index} className="space-y-4 p-4 border rounded-lg">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">
                  Asignación de Habitación {index + 1}
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRoomAssignment(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <Select
                value={assignment.room_type}
                onValueChange={(value) =>
                  updateRoomAssignment(index, "room_type", value as "single" | "double")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione el tipo de habitación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Individual</SelectItem>
                  <SelectItem value="double">Doble</SelectItem>
                </SelectContent>
              </Select>

              <div>
                <Label>Número de Habitación</Label>
                <Input
                  value={assignment.room_number || ""}
                  onChange={(e) =>
                    updateRoomAssignment(index, "room_number", e.target.value)
                  }
                />
              </div>

              <div>
                <Label>Personal Asignado 1</Label>
                <Select
                  value={assignment.staff_member1_id || "unassigned"}
                  onValueChange={(value) =>
                    updateRoomAssignment(
                      index,
                      "staff_member1_id",
                      value !== "unassigned" ? value : ""
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un miembro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                    {eventData.staff.map((member) => (
                      <SelectItem key={member.name} value={member.name}>
                        {`${member.name} ${member.surname1 || ""}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {assignment.room_type === "double" && (
                <div>
                  <Label>Personal Asignado 2</Label>
                  <Select
                    value={assignment.staff_member2_id || "unassigned"}
                    onValueChange={(value) =>
                      updateRoomAssignment(
                        index,
                        "staff_member2_id",
                        value !== "unassigned" ? value : ""
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un miembro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Sin asignar</SelectItem>
                      {eventData.staff.map((member) => (
                        <SelectItem key={member.name} value={member.name}>
                          {`${member.name} ${member.surname1 || ""}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))}
          <Button onClick={addRoomAssignment} variant="outline">
            Agregar Asignación de Habitación
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
