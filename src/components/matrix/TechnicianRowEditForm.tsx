import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CityAutocomplete } from '@/components/maps/CityAutocomplete';
import { Save, X } from 'lucide-react';

export interface TechnicianEditData {
  first_name: string;
  nickname: string;
  last_name: string;
  email: string;
  phone: string;
  dni: string;
  department: string;
  role: string;
  residencia: string;
  home_latitude: number | null;
  home_longitude: number | null;
  bg_color: string;
}

interface TechnicianRowEditFormProps {
  editedData: TechnicianEditData;
  setEditedData: Dispatch<SetStateAction<TechnicianEditData>>;
  handleSaveEdit: () => Promise<void>;
  handleCancelEdit: () => void;
  isSaving: boolean;
}

export const TechnicianRowEditForm = ({
  editedData,
  setEditedData,
  handleSaveEdit,
  handleCancelEdit,
  isSaving,
}: TechnicianRowEditFormProps) => (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="first_name" className="text-xs">Nombre</Label>
                  <Input
                    id="first_name"
                    value={editedData.first_name}
                    onChange={(e) => setEditedData({ ...editedData, first_name: e.target.value })}
                    className="h-8"
                  />
                </div>

                <div>
                  <Label htmlFor="nickname" className="text-xs">Apodo</Label>
                  <Input
                    id="nickname"
                    value={editedData.nickname}
                    onChange={(e) => setEditedData({ ...editedData, nickname: e.target.value })}
                    className="h-8"
                    placeholder="Opcional"
                  />
                </div>

                <div>
                  <Label htmlFor="last_name" className="text-xs">Apellidos</Label>
                  <Input
                    id="last_name"
                    value={editedData.last_name}
                    onChange={(e) => setEditedData({ ...editedData, last_name: e.target.value })}
                    className="h-8"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-xs">Correo</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editedData.email}
                    onChange={(e) => setEditedData({ ...editedData, email: e.target.value })}
                    className="h-8"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-xs">Teléfono</Label>
                  <Input
                    id="phone"
                    value={editedData.phone}
                    onChange={(e) => setEditedData({ ...editedData, phone: e.target.value })}
                    className="h-8"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <Label htmlFor="dni" className="text-xs">DNI</Label>
                  <Input
                    id="dni"
                    value={editedData.dni}
                    onChange={(e) => setEditedData({ ...editedData, dni: e.target.value })}
                    className="h-8"
                    placeholder="Opcional"
                  />
                </div>

                <div>
                  <CityAutocomplete
                    id="residencia"
                    value={editedData.residencia}
                    onChange={(city, coordinates) => {
                      // Clear coordinates if city changes without autocomplete selection
                      // to prevent stale location data from skewing proximity ranking
                      setEditedData(prev => ({
                        ...prev,
                        residencia: city,
                        home_latitude: coordinates?.lat ?? null,
                        home_longitude: coordinates?.lng ?? null
                      }));
                    }}
                    placeholder="Ingresa ciudad"
                    label="Residencia"
                    className="space-y-2"
                  />
                </div>

                <div>
                  <Label htmlFor="department" className="text-xs">Departamento</Label>
                  <Select value={editedData.department} onValueChange={(value) => setEditedData({ ...editedData, department: value })}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sound">Sonido</SelectItem>
                      <SelectItem value="lights">Iluminación</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="role" className="text-xs">Rol</Label>
                  <Select value={editedData.role} onValueChange={(value) => setEditedData({ ...editedData, role: value })}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technician">Técnico</SelectItem>
                      <SelectItem value="house_tech">Técnico de Casa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="bg_color" className="text-xs">Color de fondo de fila</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { color: '#DC2626', name: 'Rojo' },
                      { color: '#2563EB', name: 'Azul' },
                      { color: '#16A34A', name: 'Verde' },
                      { color: '#CA8A04', name: 'Amarillo' },
                      { color: '#9333EA', name: 'Morado' },
                      { color: '#EA580C', name: 'Naranja' },
                      { color: '#DB2777', name: 'Rosa' },
                      { color: '#0891B2', name: 'Cian' },
                      { color: '#65A30D', name: 'Lima' },
                      { color: '#7C3AED', name: 'Violeta' },
                      { color: '#0D9488', name: 'Verde azulado' },
                      { color: '#64748B', name: 'Pizarra' },
                    ].map(({ color, name }) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditedData(prev => ({ ...prev, bg_color: color }))}
                        className={`w-8 h-8 rounded border-2 transition-all hover:scale-110 ${editedData.bg_color === color ? 'border-white ring-2 ring-white' : 'border-gray-300'
                          }`}
                        style={{ backgroundColor: color }}
                        title={name}
                      />
                    ))}
                    {editedData.bg_color && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditedData(prev => ({ ...prev, bg_color: '' }))}
                        className="h-8"
                      >
                        Limpiar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveEdit} disabled={isSaving} size="sm" className="flex-1">
                    <Save className="h-4 w-4 mr-1" /> {isSaving ? 'Guardando...' : 'Guardar'}
                  </Button>
                  <Button onClick={handleCancelEdit} disabled={isSaving} size="sm" variant="outline" className="flex-1">
                    <X className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
);
