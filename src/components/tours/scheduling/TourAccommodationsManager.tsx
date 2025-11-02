import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Hotel,
  Plus,
  Trash2,
  Save,
  Loader2,
  MapPin,
  Calendar,
  Bed,
  User,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HotelAutocomplete } from "@/components/maps/HotelAutocomplete";
import { motion, AnimatePresence } from "framer-motion";

interface TourAccommodationsManagerProps {
  tourId: string;
  tourDates: any[];
  tourData: any;
  canEdit: boolean;
  onSave: () => void;
}

interface Accommodation {
  id: string;
  tour_date_id: string;
  hotel_name: string;
  hotel_address?: string;
  hotel_phone?: string;
  hotel_email?: string;
  check_in_date?: string;
  check_out_date?: string;
  confirmation_number?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  room_allocation: RoomAssignment[];
  rooms_booked?: number;
}

interface RoomAssignment {
  id: string;
  room_number?: string;
  room_type: 'single' | 'double';
  staff_member_1?: string;
  staff_member_2?: string;
  notes?: string;
}

export const TourAccommodationsManager: React.FC<TourAccommodationsManagerProps> = ({
  tourId,
  tourDates,
  tourData,
  canEdit,
  onSave,
}) => {
  const { toast } = useToast();
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState<Partial<Accommodation>>({
    tour_date_id: "",
    hotel_name: "",
    hotel_address: "",
    hotel_phone: "",
    hotel_email: "",
    check_in_date: "",
    check_out_date: "",
    confirmation_number: "",
    notes: "",
    room_allocation: [],
  });

  const sortedDates = [...tourDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Load accommodations and staff
  useEffect(() => {
    loadAccommodations();
    loadStaff();
  }, [tourId]);

  const loadAccommodations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tour_accommodations' as any)
        .select('*')
        .eq('tour_id', tourId)
        .order('check_in', { ascending: true });

      if (error) throw error;

      setAccommodations(data as any || []);
    } catch (error: any) {
      console.error('Error loading accommodations:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los alojamientos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStaff = async () => {
    try {
      // Load staff members from profiles who are active
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      setStaff(data || []);
    } catch (error: any) {
      console.error('Error loading staff:', error);
    }
  };

  const handleOpenDialog = (accommodation?: Accommodation) => {
    if (accommodation) {
      setEditingAccommodation(accommodation);
      setFormData(accommodation);
    } else {
      setEditingAccommodation(null);
      setFormData({
        tour_date_id: sortedDates[0]?.id || "",
        hotel_name: "",
        hotel_address: "",
        hotel_phone: "",
        hotel_email: "",
        check_in_date: sortedDates[0]?.date || "",
        check_out_date: "",
        confirmation_number: "",
        notes: "",
        room_allocation: [{ id: crypto.randomUUID(), room_type: 'single' }],
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAccommodation(null);
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast({
        title: "Sin permisos",
        description: "No tienes permisos para editar alojamientos",
        variant: "destructive",
      });
      return;
    }

    if (!formData.hotel_name || !formData.tour_date_id) {
      toast({
        title: "Campos requeridos",
        description: "El nombre del hotel y la fecha son obligatorios",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const accommodationData = {
        tour_id: tourId,
        tour_date_id: formData.tour_date_id,
        hotel_name: formData.hotel_name,
        hotel_address: formData.hotel_address,
        hotel_phone: formData.hotel_phone,
        hotel_email: formData.hotel_email,
        check_in_date: formData.check_in_date,
        check_out_date: formData.check_out_date,
        confirmation_number: formData.confirmation_number,
        notes: formData.notes,
        latitude: formData.latitude,
        longitude: formData.longitude,
        room_allocation: formData.room_allocation || [],
        rooms_booked: formData.room_allocation?.length || 0,
      };

      if (editingAccommodation) {
        // Update existing accommodation
        const { error } = await supabase
          .from('tour_accommodations' as any)
          .update(accommodationData)
          .eq('id', editingAccommodation.id);

        if (error) throw error;

        toast({
          title: "Actualizado",
          description: "Alojamiento actualizado correctamente",
        });
      } else {
        // Create new accommodation
        const { error } = await supabase
          .from('tour_accommodations' as any)
          .insert([accommodationData]);

        if (error) throw error;

        toast({
          title: "Creado",
          description: "Alojamiento creado correctamente",
        });
      }

      handleCloseDialog();
      loadAccommodations();
      onSave();
    } catch (error: any) {
      console.error('Error saving accommodation:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el alojamiento",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (accommodationId: string) => {
    if (!canEdit) {
      toast({
        title: "Sin permisos",
        description: "No tienes permisos para eliminar alojamientos",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("¿Estás seguro de que deseas eliminar este alojamiento?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tour_accommodations' as any)
        .delete()
        .eq('id', accommodationId);

      if (error) throw error;

      toast({
        title: "Eliminado",
        description: "Alojamiento eliminado correctamente",
      });

      loadAccommodations();
      onSave();
    } catch (error: any) {
      console.error('Error deleting accommodation:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el alojamiento",
        variant: "destructive",
      });
    }
  };

  const addRoom = () => {
    setFormData({
      ...formData,
      room_allocation: [
        ...(formData.room_allocation || []),
        { id: crypto.randomUUID(), room_type: 'single' },
      ],
    });
  };

  const removeRoom = (roomId: string) => {
    setFormData({
      ...formData,
      room_allocation: formData.room_allocation?.filter((r) => r.id !== roomId) || [],
    });
  };

  const updateRoom = (roomId: string, field: keyof RoomAssignment, value: any) => {
    setFormData({
      ...formData,
      room_allocation: formData.room_allocation?.map((r) =>
        r.id === roomId ? { ...r, [field]: value } : r
      ) || [],
    });
  };

  const getDateForAccommodation = (tourDateId: string) => {
    return sortedDates.find((d) => d.id === tourDateId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Hotel className="h-5 w-5" />
            Gestión de Alojamientos
          </h3>
          <p className="text-sm text-muted-foreground">
            Gestiona hoteles y asignación de habitaciones para el tour
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Añadir Alojamiento
          </Button>
        )}
      </div>

      {accommodations.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Hotel className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay alojamientos configurados para este tour</p>
              {canEdit && (
                <Button
                  onClick={() => handleOpenDialog()}
                  variant="outline"
                  className="mt-4"
                >
                  Añadir el primer alojamiento
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accommodations.map((accommodation) => {
            const tourDate = getDateForAccommodation(accommodation.tour_date_id);
            const location = tourDate?.locations || tourDate?.location;

            return (
              <Card key={accommodation.id} className="border-2 dark:border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Hotel className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        {accommodation.hotel_name}
                      </CardTitle>
                      {location && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {location.venue_name} - {location.city}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenDialog(accommodation)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(accommodation.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {accommodation.hotel_address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">{accommodation.hotel_address}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    {accommodation.check_in_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Check-in:</span>
                        <span className="text-muted-foreground">
                          {new Date(accommodation.check_in_date).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    )}
                    {accommodation.check_out_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Check-out:</span>
                        <span className="text-muted-foreground">
                          {new Date(accommodation.check_out_date).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    )}
                  </div>

                  {accommodation.room_allocation && accommodation.room_allocation.length > 0 && (
                    <div className="pt-2 border-t dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Bed className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {accommodation.room_allocation.length} {accommodation.room_allocation.length === 1 ? 'Habitación' : 'Habitaciones'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {accommodation.room_allocation.map((room, idx) => (
                          <div
                            key={room.id}
                            className="text-xs p-2 rounded bg-muted/50 dark:bg-muted/20"
                          >
                            <div className="font-medium">
                              {room.room_number || `Hab. ${idx + 1}`} - {room.room_type === 'single' ? 'Individual' : 'Doble'}
                            </div>
                            {room.staff_member_1 && (
                              <div className="text-muted-foreground mt-1 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {staff.find(s => s.id === room.staff_member_1)?.full_name || 'Staff'}
                              </div>
                            )}
                            {room.staff_member_2 && (
                              <div className="text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {staff.find(s => s.id === room.staff_member_2)?.full_name || 'Staff'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {accommodation.confirmation_number && (
                    <div className="text-xs text-muted-foreground pt-2 border-t dark:border-gray-700">
                      <span className="font-medium">Confirmación:</span> {accommodation.confirmation_number}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccommodation ? "Editar Alojamiento" : "Nuevo Alojamiento"}
            </DialogTitle>
            <DialogDescription>
              Configura los detalles del hotel y asigna habitaciones
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Fecha del Tour *</Label>
              <Select
                value={formData.tour_date_id}
                onValueChange={(value) => setFormData({ ...formData, tour_date_id: value })}
              >
                <SelectTrigger className="dark:border-gray-600 dark:bg-gray-900">
                  <SelectValue placeholder="Seleccionar fecha" />
                </SelectTrigger>
                <SelectContent>
                  {sortedDates.map((date) => {
                    const location = date.locations || date.location;
                    return (
                      <SelectItem key={date.id} value={date.id}>
                        {new Date(date.date).toLocaleDateString('es-ES', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })} - {location?.venue_name || location?.city || 'Sin ubicación'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Hotel Search */}
            <div className="space-y-2">
              <Label>Buscar Hotel *</Label>
              <HotelAutocomplete
                value={formData.hotel_name || ""}
                checkIn={formData.check_in_date}
                checkOut={formData.check_out_date}
                onChange={(hotelName, address, coordinates) => {
                  setFormData({
                    ...formData,
                    hotel_name: hotelName,
                    hotel_address: address || formData.hotel_address,
                    latitude: coordinates?.lat,
                    longitude: coordinates?.lng,
                  });
                }}
                onCheckInChange={(date) => setFormData({ ...formData, check_in_date: date })}
                onCheckOutChange={(date) => setFormData({ ...formData, check_out_date: date })}
                placeholder="Buscar por nombre de hotel..."
                className="dark:border-gray-600 dark:bg-gray-900"
              />
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={formData.hotel_phone || ""}
                  onChange={(e) => setFormData({ ...formData, hotel_phone: e.target.value })}
                  placeholder="+34 xxx xxx xxx"
                  className="dark:border-gray-600 dark:bg-gray-900"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.hotel_email || ""}
                  onChange={(e) => setFormData({ ...formData, hotel_email: e.target.value })}
                  placeholder="hotel@example.com"
                  className="dark:border-gray-600 dark:bg-gray-900"
                />
              </div>
            </div>

            {/* Confirmation Number */}
            <div className="space-y-2">
              <Label>Número de Confirmación</Label>
              <Input
                value={formData.confirmation_number || ""}
                onChange={(e) => setFormData({ ...formData, confirmation_number: e.target.value })}
                placeholder="ABC123456"
                className="dark:border-gray-600 dark:bg-gray-900"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Información adicional..."
                className="dark:border-gray-600 dark:bg-gray-900"
              />
            </div>

            {/* Rooms Section */}
            <div className="space-y-4 pt-4 border-t dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Bed className="h-4 w-4" />
                  Habitaciones
                </h4>
                <Button onClick={addRoom} size="sm" variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Añadir Habitación
                </Button>
              </div>

              <AnimatePresence>
                {formData.room_allocation?.map((room, index) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="p-4 border dark:border-gray-700 rounded-lg space-y-3 bg-muted/20 dark:bg-muted/10"
                  >
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-sm">Habitación {index + 1}</h5>
                      {formData.room_allocation && formData.room_allocation.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeRoom(room.id)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={room.room_type}
                          onValueChange={(value: 'single' | 'double') =>
                            updateRoom(room.id, 'room_type', value)
                          }
                        >
                          <SelectTrigger className="dark:border-gray-600 dark:bg-gray-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Individual</SelectItem>
                            <SelectItem value="double">Doble</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Número</Label>
                        <Input
                          value={room.room_number || ""}
                          onChange={(e) => updateRoom(room.id, 'room_number', e.target.value)}
                          placeholder="101"
                          className="dark:border-gray-600 dark:bg-gray-900"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Personal 1</Label>
                        <Select
                          value={room.staff_member_1 || ""}
                          onValueChange={(value) => updateRoom(room.id, 'staff_member_1', value)}
                        >
                          <SelectTrigger className="dark:border-gray-600 dark:bg-gray-900">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sin asignar</SelectItem>
                            {staff.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {room.room_type === 'double' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Personal 2</Label>
                          <Select
                            value={room.staff_member_2 || ""}
                            onValueChange={(value) => updateRoom(room.id, 'staff_member_2', value)}
                          >
                            <SelectTrigger className="dark:border-gray-600 dark:bg-gray-900">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Sin asignar</SelectItem>
                              {staff.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
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
        </DialogContent>
      </Dialog>
    </div>
  );
};
