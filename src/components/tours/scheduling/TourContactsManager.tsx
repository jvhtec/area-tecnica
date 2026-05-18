import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { dataLayerClient } from "@/services/dataLayerClient";
import {
  Users,
  Plus,
  Trash2,
  Save,
  Loader2,
  Star,
  Phone,
  Mail,
  Briefcase,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TourContactsManagerProps {
  tourId: string;
  tourData: any;
  canEdit: boolean;
  onSave: () => void;
}

interface TourContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  notes: string;
}

type DataLayerRowsResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

type DataLayerWriteResult = {
  error: { message?: string } | null;
};

type SelectRowsQuery<T> = {
  select(columns: string): {
    eq(column: string, value: string): Promise<DataLayerRowsResult<T>>;
    in(column: string, values: string[]): Promise<DataLayerRowsResult<T>>;
  };
};

type InsertRowsQuery = {
  insert(rows: unknown[]): Promise<DataLayerWriteResult>;
};

type UpdateRowsQuery = {
  update(values: unknown): {
    eq(column: string, value: string): Promise<DataLayerWriteResult>;
  };
};

type IdRow = { id: string | null };
type HojaContactRow = {
  hoja_de_ruta_id: string | null;
  name: string | null;
  role: string | null;
  phone: string | null;
};

const dataLayerTable = <TQuery,>(table: string): TQuery =>
  dataLayerClient.from(table as never) as unknown as TQuery;

const contactKey = (contact: Pick<TourContact, "name" | "role" | "phone">) =>
  [contact.name, contact.role, contact.phone]
    .map((value) => (value || "").trim().toLowerCase())
    .join("|");

const syncTourContactsToHojas = async (tourId: string, contacts: TourContact[]) => {
  const tourContacts = contacts.filter((contact) => contact.name?.trim()).map((contact) => ({
    name: contact.name.trim(),
    role: contact.role || null,
    phone: contact.phone || null,
  }));
  if (tourContacts.length === 0) return 0;

  const { data: tourDates, error: datesError } = await dataLayerTable<SelectRowsQuery<IdRow>>("tour_dates")
    .select("id")
    .eq("tour_id", tourId);
  if (datesError) throw datesError;

  const dateIds = (tourDates || [])
    .map((date) => date.id)
    .filter((id): id is string => Boolean(id));

  const [hojasByTourResult, hojasByDateResult] = await Promise.all([
    dataLayerTable<SelectRowsQuery<IdRow>>("hoja_de_ruta").select("id").eq("tour_id", tourId),
    dateIds.length
      ? dataLayerTable<SelectRowsQuery<IdRow>>("hoja_de_ruta").select("id").in("tour_date_id", dateIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (hojasByTourResult.error) throw hojasByTourResult.error;
  if (hojasByDateResult.error) throw hojasByDateResult.error;

  const hojaIds = Array.from(new Set([
    ...(hojasByTourResult.data || []).map((hoja) => hoja.id),
    ...(hojasByDateResult.data || []).map((hoja) => hoja.id),
  ].filter((id): id is string => Boolean(id))));

  if (hojaIds.length === 0) return 0;

  const { data: existingContacts, error: contactsError } = await dataLayerTable<SelectRowsQuery<HojaContactRow>>("hoja_de_ruta_contacts")
    .select("hoja_de_ruta_id, name, role, phone")
    .in("hoja_de_ruta_id", hojaIds);
  if (contactsError) throw contactsError;

  const existingByHoja = new Map<string, Set<string>>();
  (existingContacts || []).forEach((contact) => {
    const hojaId = contact.hoja_de_ruta_id;
    if (!hojaId) return;
    if (!existingByHoja.has(hojaId)) existingByHoja.set(hojaId, new Set());
    existingByHoja.get(hojaId)?.add(contactKey({
      name: contact.name || "",
      role: contact.role || "",
      phone: contact.phone || "",
    }));
  });

  const rows = hojaIds.flatMap((hojaId) => {
    const existing = existingByHoja.get(hojaId) ?? new Set<string>();
    return tourContacts
      .filter((contact) => !existing.has(contactKey({
        name: contact.name,
        role: contact.role || "",
        phone: contact.phone || "",
      })))
      .map((contact) => ({
        hoja_de_ruta_id: hojaId,
        name: contact.name,
        role: contact.role,
        phone: contact.phone,
      }));
  });

  if (rows.length === 0) return 0;

  const { error: insertError } = await dataLayerTable<InsertRowsQuery>("hoja_de_ruta_contacts").insert(rows);
  if (insertError) throw insertError;
  return rows.length;
};

export const TourContactsManager: React.FC<TourContactsManagerProps> = ({
  tourId,
  tourData,
  canEdit,
  onSave,
}) => {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<TourContact[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<TourContact | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<TourContact>>({
    name: "",
    role: "",
    phone: "",
    email: "",
    isPrimary: false,
    notes: "",
  });

  useEffect(() => {
    if (tourData?.tour_contacts) {
      setContacts(tourData.tour_contacts);
    }
  }, [tourData]);

  const handleOpenDialog = (contact?: TourContact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData(contact);
    } else {
      setEditingContact(null);
      setFormData({
        name: "",
        role: "",
        phone: "",
        email: "",
        isPrimary: false,
        notes: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingContact(null);
    setFormData({
      name: "",
      role: "",
      phone: "",
      email: "",
      isPrimary: false,
      notes: "",
    });
  };

  const handleSaveContact = () => {
    if (!formData.name || !formData.role) {
      toast({
        title: "Datos incompletos",
        description: "El nombre y rol son obligatorios",
        variant: "destructive",
      });
      return;
    }

    let updatedContacts: TourContact[];

    if (editingContact) {
      // Update existing contact
      updatedContacts = contacts.map((c) =>
        c.id === editingContact.id ? { ...c, ...formData } : c
      );
    } else {
      // Add new contact
      const newContact: TourContact = {
        id: crypto.randomUUID(),
        name: formData.name!,
        role: formData.role!,
        phone: formData.phone || "",
        email: formData.email || "",
        isPrimary: formData.isPrimary || false,
        notes: formData.notes || "",
      };
      updatedContacts = [...contacts, newContact];
    }

    // If this contact is set as primary, remove primary from others
    if (formData.isPrimary) {
      updatedContacts = updatedContacts.map((c) =>
        c.id === (editingContact?.id || updatedContacts[updatedContacts.length - 1].id)
          ? c
          : { ...c, isPrimary: false }
      );
    }

    setContacts(updatedContacts);
    handleCloseDialog();

    toast({
      title: editingContact ? "Contacto actualizado" : "Contacto agregado",
      description: "Recuerda guardar los cambios",
    });
  };

  const handleDeleteContact = (contactId: string) => {
    if (!canEdit) return;

    setContacts(contacts.filter((c) => c.id !== contactId));

    toast({
      title: "Contacto eliminado",
      description: "Recuerda guardar los cambios",
    });
  };

  const handleSetPrimary = (contactId: string) => {
    if (!canEdit) return;

    setContacts(
      contacts.map((c) => ({ ...c, isPrimary: c.id === contactId }))
    );

    toast({
      title: "Contacto principal actualizado",
      description: "Recuerda guardar los cambios",
    });
  };

  const handleSaveAll = async () => {
    if (!canEdit) {
      toast({
        title: "Sin permisos",
        description: "No tienes permisos para editar los contactos",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await dataLayerTable<UpdateRowsQuery>("tours")
        .update({ tour_contacts: contacts })
        .eq("id", tourId);

      if (error) throw error;

      const syncedRows = await syncTourContactsToHojas(tourId, contacts);

      toast({
        title: "Guardado",
        description: syncedRows
          ? `Contactos guardados y sincronizados en ${syncedRows} hoja(s).`
          : "Contactos guardados. Las hojas ya estaban sincronizadas.",
      });

      onSave();
    } catch (error: any) {
      console.error("Error saving contacts:", error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los contactos",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const primaryContact = contacts.find((c) => c.isPrimary);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contactos del Tour
            </CardTitle>
            {canEdit && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Contacto
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Gestiona los contactos específicos del tour (tour managers, coordinadores, etc.)
            que aparecerán en todos los day sheets.
          </p>

          {primaryContact && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-amber-600 dark:text-amber-400 fill-amber-600 dark:fill-amber-400" />
                <span className="font-medium text-amber-900 dark:text-amber-100">Contacto Principal</span>
              </div>
              <div className="space-y-1">
                <div className="font-semibold">{primaryContact.name}</div>
                <div className="text-sm text-muted-foreground">{primaryContact.role}</div>
                {primaryContact.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3 w-3" />
                    {primaryContact.phone}
                  </div>
                )}
                {primaryContact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3 w-3" />
                    {primaryContact.email}
                  </div>
                )}
              </div>
            </div>
          )}

          {contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay contactos registrados para este tour</p>
              <p className="text-sm mt-1">Agrega contactos de tour managers y coordinadores</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <Card key={contact.id} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{contact.name}</h4>
                          {contact.isPrimary && (
                            <Badge variant="default" className="bg-amber-500">
                              <Star className="h-3 w-3 mr-1 fill-current" />
                              Principal
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Briefcase className="h-3 w-3" />
                          {contact.role}
                        </div>

                        <div className="space-y-1">
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {contact.phone}
                            </div>
                          )}
                          {contact.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {contact.email}
                            </div>
                          )}
                        </div>

                        {contact.notes && (
                          <p className="text-sm text-muted-foreground italic mt-2">
                            {contact.notes}
                          </p>
                        )}
                      </div>

                      {canEdit && (
                        <div className="flex gap-2">
                          {!contact.isPrimary && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSetPrimary(contact.id)}
                            >
                              <Star className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDialog(contact)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteContact(contact.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && contacts.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSaveAll} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Contactos
              </>
            )}
          </Button>
        </div>
      )}

      {/* Contact Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Editar Contacto" : "Agregar Contacto"}
            </DialogTitle>
            <DialogDescription>
              Información del contacto para el tour
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Nombre *</Label>
              <Input
                id="contact-name"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-role">Rol *</Label>
              <Input
                id="contact-role"
                value={formData.role || ""}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="Tour Manager, Coordinador, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-phone">Teléfono</Label>
              <Input
                id="contact-phone"
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+34 600 000 000"
                type="tel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@ejemplo.com"
                type="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-notes">Notas</Label>
              <Input
                id="contact-notes"
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Información adicional"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="contact-primary"
                checked={formData.isPrimary || false}
                onChange={(e) =>
                  setFormData({ ...formData, isPrimary: e.target.checked })
                }
                className="rounded"
              />
              <Label htmlFor="contact-primary" className="cursor-pointer">
                Establecer como contacto principal
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSaveContact}>
              {editingContact ? "Actualizar" : "Agregar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!canEdit && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-300">
          ⚠ No tienes permisos para editar los contactos del tour
        </div>
      )}
    </div>
  );
};
