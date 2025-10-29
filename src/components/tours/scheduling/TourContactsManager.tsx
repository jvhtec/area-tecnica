import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Plus,
  Trash2,
  Save,
  Loader2,
  Phone,
  Mail,
  Briefcase,
} from "lucide-react";

interface TourContactsManagerProps {
  tourId: string;
  canEdit: boolean;
  onSave?: () => void;
}

interface TourContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  company?: string;
  notes?: string;
  is_primary?: boolean;
}

export const TourContactsManager: React.FC<TourContactsManagerProps> = ({
  tourId,
  canEdit,
  onSave,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<TourContact[]>([]);

  useEffect(() => {
    loadContacts();
  }, [tourId]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tours')
        .select('tour_contacts')
        .eq('id', tourId)
        .single();

      if (error) throw error;

      if (data?.tour_contacts) {
        setContacts(data.tour_contacts as TourContact[]);
      }
    } catch (error: any) {
      console.error('Error loading tour contacts:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los contactos del tour",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tours')
        .update({ tour_contacts: contacts })
        .eq('id', tourId);

      if (error) throw error;

      toast({
        title: "Guardado",
        description: "Contactos del tour guardados correctamente",
      });

      onSave?.();
    } catch (error: any) {
      console.error('Error saving tour contacts:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los contactos",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addContact = () => {
    const newContact: TourContact = {
      id: `contact-${Date.now()}`,
      name: "",
      role: "",
      phone: "",
      email: "",
      is_primary: contacts.length === 0,
    };
    setContacts([...contacts, newContact]);
  };

  const removeContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id));
  };

  const updateContact = (id: string, field: keyof TourContact, value: any) => {
    setContacts(contacts.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const setPrimaryContact = (id: string) => {
    setContacts(contacts.map(c => ({
      ...c,
      is_primary: c.id === id,
    })));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contactos del Tour
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Gestiona los contactos clave para este tour (tour managers, production coordinators, etc.)
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addContact}>
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir Contacto
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No hay contactos del tour configurados</p>
              <p className="text-sm">
                Añade contactos que aparecerán en los day sheets
              </p>
              {canEdit && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={addContact}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir Primer Contacto
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {contacts.map((contact, index) => (
                  <Card key={contact.id} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={contact.is_primary ? "default" : "outline"}>
                            {contact.is_primary ? "Contacto Principal" : `Contacto ${index + 1}`}
                          </Badge>
                          {!contact.is_primary && canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPrimaryContact(contact.id)}
                            >
                              Marcar como principal
                            </Button>
                          )}
                        </div>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeContact(contact.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`name-${contact.id}`}>Nombre Completo *</Label>
                          <Input
                            id={`name-${contact.id}`}
                            value={contact.name}
                            onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                            disabled={!canEdit}
                            placeholder="Juan Pérez"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`role-${contact.id}`}>Rol/Puesto *</Label>
                          <Input
                            id={`role-${contact.id}`}
                            value={contact.role}
                            onChange={(e) => updateContact(contact.id, 'role', e.target.value)}
                            disabled={!canEdit}
                            placeholder="Tour Manager"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`phone-${contact.id}`}>
                            <Phone className="h-3 w-3 inline mr-1" />
                            Teléfono *
                          </Label>
                          <Input
                            id={`phone-${contact.id}`}
                            value={contact.phone}
                            onChange={(e) => updateContact(contact.id, 'phone', e.target.value)}
                            disabled={!canEdit}
                            placeholder="+34 600 000 000"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`email-${contact.id}`}>
                            <Mail className="h-3 w-3 inline mr-1" />
                            Email
                          </Label>
                          <Input
                            id={`email-${contact.id}`}
                            type="email"
                            value={contact.email}
                            onChange={(e) => updateContact(contact.id, 'email', e.target.value)}
                            disabled={!canEdit}
                            placeholder="contacto@ejemplo.com"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`company-${contact.id}`}>
                          <Briefcase className="h-3 w-3 inline mr-1" />
                          Empresa/Organización
                        </Label>
                        <Input
                          id={`company-${contact.id}`}
                          value={contact.company || ""}
                          onChange={(e) => updateContact(contact.id, 'company', e.target.value)}
                          disabled={!canEdit}
                          placeholder="Sector Pro"
                        />
                      </div>

                      <div>
                        <Label htmlFor={`notes-${contact.id}`}>Notas</Label>
                        <Input
                          id={`notes-${contact.id}`}
                          value={contact.notes || ""}
                          onChange={(e) => updateContact(contact.id, 'notes', e.target.value)}
                          disabled={!canEdit}
                          placeholder="Información adicional..."
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>Modo solo lectura:</strong> No tienes permisos para editar los contactos del tour.
        </div>
      )}
    </div>
  );
};
