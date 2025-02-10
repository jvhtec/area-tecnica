
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ContactsDialogProps } from "@/types/hoja-de-ruta/dialogs";

export const ContactsDialog = ({
  eventData,
  handleContactChange,
  addContact,
}: ContactsDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Editar Contactos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Información de Contactos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {eventData.contacts.map((contact, index) => (
            <div key={index} className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Nombre"
                value={contact.name}
                onChange={(e) =>
                  handleContactChange(index, "name", e.target.value)
                }
              />
              <Input
                placeholder="Rol"
                value={contact.role}
                onChange={(e) =>
                  handleContactChange(index, "role", e.target.value)
                }
              />
              <Input
                placeholder="Teléfono"
                value={contact.phone}
                onChange={(e) =>
                  handleContactChange(index, "phone", e.target.value)
                }
              />
            </div>
          ))}
          <Button onClick={addContact} variant="outline">
            Agregar Contacto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
