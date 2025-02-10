
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StaffDialogProps } from "@/types/hoja-de-ruta/dialogs";

export const StaffDialog = ({
  eventData,
  handleStaffChange,
  addStaffMember,
}: StaffDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Editar Lista de Personal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lista de Personal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {eventData.staff.map((member, index) => (
            <div key={index} className="grid grid-cols-4 gap-2">
              <Input
                placeholder="Nombre"
                value={member.name}
                onChange={(e) =>
                  handleStaffChange(index, "name", e.target.value)
                }
              />
              <Input
                placeholder="Primer Apellido"
                value={member.surname1}
                onChange={(e) =>
                  handleStaffChange(index, "surname1", e.target.value)
                }
              />
              <Input
                placeholder="Segundo Apellido"
                value={member.surname2}
                onChange={(e) =>
                  handleStaffChange(index, "surname2", e.target.value)
                }
              />
              <Input
                placeholder="Puesto"
                value={member.position}
                onChange={(e) =>
                  handleStaffChange(index, "position", e.target.value)
                }
              />
            </div>
          ))}
          <Button onClick={addStaffMember} variant="outline">
            Agregar Miembro de Personal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
