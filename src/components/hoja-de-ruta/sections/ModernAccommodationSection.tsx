import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Bed, Plus, Trash2, User, Hotel, MapPin, Building2 } from "lucide-react";
import { Accommodation, RoomAssignment, EventData } from "@/types/hoja-de-ruta";
import { AddressAutocomplete } from "@/components/maps/AddressAutocomplete";
import { HotelAutocomplete } from "@/components/maps/HotelAutocomplete";
import { GoogleMap } from "@/components/maps/GoogleMap";

interface ModernAccommodationSectionProps {
  accommodations: Accommodation[];
  eventData: EventData;
  onUpdateAccommodation: (accommodationIndex: number, data: Partial<Accommodation>) => void;
  onUpdateRoom: (accommodationIndex: number, roomIndex: number, field: keyof RoomAssignment, value: any) => void;
  onAddAccommodation: () => void;
  onRemoveAccommodation: (index: number) => void;
  onAddRoom: (accommodationIndex: number) => void;
  onRemoveRoom: (accommodationIndex: number, roomIndex: number) => void;
}

export const ModernAccommodationSection: React.FC<ModernAccommodationSectionProps> = ({
  accommodations,
  eventData,
  onUpdateAccommodation,
  onUpdateRoom,
  onAddAccommodation,
  onRemoveAccommodation,
  onAddRoom,
  onRemoveRoom,
}) => {
  const [expandedMaps, setExpandedMaps] = useState<Record<string, boolean>>({});

  const toggleMap = (accommodationId: string) => {
    setExpandedMaps(prev => ({
      ...prev,
      [accommodationId]: !prev[accommodationId]
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bed className="w-5 h-5 text-pink-600" />
              Alojamiento
            </CardTitle>
            <Button
              onClick={onAddAccommodation}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Añadir Hotel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <AnimatePresence>
              {accommodations.map((accommodation, accommodationIndex) => (
                <motion.div
                  key={accommodation.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-6 border-2 border-gray-200 rounded-lg bg-gradient-to-r from-pink-50 to-transparent"
                >
                  {/* Hotel Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-pink-600" />
                      <h3 className="text-lg font-semibold">Hotel {accommodationIndex + 1}</h3>
                    </div>
                    {accommodationIndex > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRemoveAccommodation(accommodationIndex)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Hotel Details */}
                  <div className="grid grid-cols-1 gap-4 mb-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Buscar Hotel</Label>
                      <HotelAutocomplete
                        value={accommodation.hotel_name}
                        checkIn={accommodation.check_in}
                        checkOut={accommodation.check_out}
                        onChange={(hotelName, address, coordinates) => {
                          const updates: Partial<Accommodation> = { hotel_name: hotelName };
                          if (address) updates.address = address;
                          if (coordinates) updates.coordinates = coordinates;
                          onUpdateAccommodation(accommodationIndex, updates);
                        }}
                        onCheckInChange={(date) => onUpdateAccommodation(accommodationIndex, { check_in: date })}
                        onCheckOutChange={(date) => onUpdateAccommodation(accommodationIndex, { check_out: date })}
                        placeholder="Buscar por nombre de hotel..."
                        className="border-2 focus:border-pink-300"
                      />
                    </div>

                    {accommodation.address && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Dirección</Label>
                        <p className="text-sm p-3 border rounded-md bg-muted/50">
                          {accommodation.address}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Map Section */}
                  {accommodation.address && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleMap(accommodation.id)}
                          className="gap-2"
                        >
                          <MapPin className="w-4 h-4" />
                          {expandedMaps[accommodation.id] ? 'Ocultar Mapa' : 'Ver Mapa'}
                        </Button>
                      </div>
                      
                      <AnimatePresence>
                        {expandedMaps[accommodation.id] && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <GoogleMap
                              address={accommodation.address}
                              coordinates={accommodation.coordinates}
                              height="300px"
                              showMarker
                              interactive
                              onLocationSelect={(coordinates, address) => {
                                onUpdateAccommodation(accommodationIndex, {
                                  coordinates,
                                  address,
                                });
                              }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Rooms Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <Hotel className="w-4 h-4 text-pink-600" />
                        Habitaciones
                      </h4>
                      <Button
                        onClick={() => onAddRoom(accommodationIndex)}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Añadir Habitación
                      </Button>
                    </div>

                    <AnimatePresence>
                      {accommodation.rooms.map((room, roomIndex) => (
                        <motion.div
                          key={roomIndex}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="p-4 border border-gray-200 rounded-lg bg-white/70"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="font-medium text-sm">Habitación {roomIndex + 1}</h5>
                            {roomIndex > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onRemoveRoom(accommodationIndex, roomIndex)}
                                className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Tipo de Habitación</Label>
                              <Select
                                value={room.room_type}
                                onValueChange={(value) => onUpdateRoom(accommodationIndex, roomIndex, 'room_type', value)}
                              >
                                <SelectTrigger className="border-2 focus:border-pink-300">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="single">
                                    <div className="flex items-center gap-2">
                                      <User className="w-4 h-4" />
                                      Individual
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="double">
                                    <div className="flex items-center gap-2">
                                      <User className="w-4 h-4" />
                                      Doble
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Número de Habitación</Label>
                              <Input
                                value={room.room_number || ''}
                                onChange={(e) => onUpdateRoom(accommodationIndex, roomIndex, 'room_number', e.target.value)}
                                placeholder="101, 202..."
                                className="border-2 focus:border-pink-300"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Personal 1</Label>
                              <Select
                                value={room.staff_member1_id || ''}
                                onValueChange={(value) => onUpdateRoom(accommodationIndex, roomIndex, 'staff_member1_id', value)}
                              >
                                <SelectTrigger className="border-2 focus:border-pink-300">
                                  <SelectValue placeholder="Seleccionar personal" />
                                </SelectTrigger>
                                <SelectContent>
                                  {eventData.staff.map((staff, staffIndex) => (
                                    <SelectItem key={staffIndex} value={staffIndex.toString()}>
                                      {staff.name} {staff.surname1}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {room.room_type === 'double' && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Personal 2</Label>
                                <Select
                                  value={room.staff_member2_id || ''}
                                  onValueChange={(value) => onUpdateRoom(accommodationIndex, roomIndex, 'staff_member2_id', value)}
                                >
                                  <SelectTrigger className="border-2 focus:border-pink-300">
                                    <SelectValue placeholder="Seleccionar personal" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {eventData.staff.map((staff, staffIndex) => (
                                      <SelectItem key={staffIndex} value={staffIndex.toString()}>
                                        {staff.name} {staff.surname1}
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
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
