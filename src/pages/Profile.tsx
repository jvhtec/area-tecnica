import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Department } from "@/types/department";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Save, UserCircle, AlertTriangle, Bell, Key, FolderTree, CheckCircle2 } from "lucide-react";
import { FolderStructureEditor, type FolderStructure } from "@/components/profile/FolderStructureEditor";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const Profile = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [folderStructure, setFolderStructure] = useState<FolderStructure | null>(null);
  const [tourFolderStructure, setTourFolderStructure] = useState<FolderStructure | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const {
    isSupported,
    permission,
    subscription,
    isInitializing,
    isEnabling,
    isDisabling,
    error: pushError,
    enable,
    disable,
    canEnable,
  } = usePushNotifications();

  const permissionLabel =
    permission === 'granted'
      ? 'Concedido'
      : permission === 'denied'
        ? 'Bloqueado'
        : 'No solicitado';
  const hasSubscription = Boolean(subscription);
  const showEnableButton = canEnable && !isInitializing;
  const isBlocked = permission === 'denied';
  const showPushControls = ['technician', 'house_tech'].includes(profile?.role);

  // Fetch user profile on component mount
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: "Error",
          description: "Error al cargar los datos del perfil",
          variant: "destructive",
        });
        return;
      }

        setProfile(data);
        setFolderStructure(data.custom_folder_structure);
        setTourFolderStructure(data.custom_tour_folder_structure);
      setNeedsPasswordChange(user.user_metadata?.needs_password_change ?? false);
    };

    fetchProfile();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSaveStatus('saving');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          nickname: profile.nickname,
          last_name: profile.last_name,
          phone: profile.phone,
          department: profile.department,
          dni: profile.dni,
          residencia: profile.residencia,
          custom_folder_structure: folderStructure,
          custom_tour_folder_structure: tourFolderStructure,
        })
        .eq('id', profile.id);

      if (error) throw error;

      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      toast({
        title: "Perfil actualizado",
        description: "Los cambios se guardaron correctamente",
      });
      
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setSaveStatus('error');
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el perfil",
        variant: "destructive",
      });
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderStructureSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          custom_folder_structure: folderStructure,
          custom_tour_folder_structure: tourFolderStructure,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: "Estructura guardada",
        description: "Se guardó la estructura de carpetas correctamente",
      });
    } catch (error: any) {
      console.error('Error saving folder structure:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la estructura de carpetas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas nuevas no coinciden",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // First verify the current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: passwordForm.currentPassword,
      });

      if (signInError) {
        throw new Error('La contraseña actual no es correcta');
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (updateError) throw updateError;

      // If this was a forced password change, update the user metadata
      if (needsPasswordChange) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { needs_password_change: false }
        });

        if (metadataError) throw metadataError;
        setNeedsPasswordChange(false);
      }

      toast({
        title: "Contraseña actualizada",
        description: "Se actualizó tu contraseña correctamente",
      });

      // Clear the password form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la contraseña",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const SaveStatusIndicator = () => {
    if (saveStatus === 'idle') return null;
    
    return (
      <div className={cn(
        "flex items-center gap-2 text-sm",
        saveStatus === 'saving' && "text-muted-foreground",
        saveStatus === 'saved' && "text-green-600",
        saveStatus === 'error' && "text-destructive"
      )}>
        {saveStatus === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
        {saveStatus === 'saved' && <CheckCircle2 className="h-4 w-4" />}
        {saveStatus === 'saving' && 'Guardando...'}
        {saveStatus === 'saved' && 'Guardado'}
        {saveStatus === 'error' && 'Error al guardar'}
      </div>
    );
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mi perfil</h1>
        <SaveStatusIndicator />
      </div>

      {needsPasswordChange && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Por favor, cambia tu contraseña antes de seguir utilizando la aplicación.
          </AlertDescription>
        </Alert>
      )}

      {isMobile ? (
        <Accordion type="multiple" defaultValue={["personal-info"]} className="space-y-4">
          <AccordionItem value="personal-info" className="border rounded-lg px-4 bg-card">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                <span className="font-semibold">Información personal</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input
                      id="firstName"
                      value={profile.first_name || ''}
                      onChange={(e) => {
                        setProfile({ ...profile, first_name: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nickname">Apodo</Label>
                    <Input
                      id="nickname"
                      value={profile.nickname || ''}
                      onChange={(e) => {
                        setProfile({ ...profile, nickname: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellidos</Label>
                    <Input
                      id="lastName"
                      value={profile.last_name || ''}
                      onChange={(e) => {
                        setProfile({ ...profile, last_name: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profile.phone || ''}
                      onChange={(e) => {
                        setProfile({ ...profile, phone: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Departamento</Label>
                    <Select
                      value={profile.department || ''}
                      onValueChange={(value) => {
                        setProfile({ ...profile, department: value as Department });
                        setHasUnsavedChanges(true);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sound">Sonido</SelectItem>
                        <SelectItem value="lights">Luces</SelectItem>
                        <SelectItem value="video">Vídeo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dni">DNI/NIE</Label>
                    <Input
                      id="dni"
                      value={profile.dni || ''}
                      onChange={(e) => {
                        setProfile({ ...profile, dni: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="residencia">Residencia</Label>
                    <Input
                      id="residencia"
                      value={profile.residencia || ''}
                      onChange={(e) => {
                        setProfile({ ...profile, residencia: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <Input
                      id="role"
                      value={profile.role || ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading || !hasUnsavedChanges}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar cambios
                    </>
                  )}
                </Button>
              </form>
            </AccordionContent>
          </AccordionItem>

          {showPushControls && (
            <AccordionItem value="push-notifications" className="border rounded-lg px-4 bg-card">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  <span className="font-semibold">Notificaciones push</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {!isSupported ? (
                  <Alert>
                    <AlertTitle>Navegador no compatible</AlertTitle>
                    <AlertDescription>
                      Tu navegador actual no admite notificaciones web push.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="font-medium">Permiso:</span> {permissionLabel}
                      </p>
                      <p>
                        <span className="font-medium">Suscripción:</span>{' '}
                        {hasSubscription ? 'Activa' : 'Inactiva'}
                      </p>
                    </div>

                    {isInitializing && (
                      <p className="text-sm text-muted-foreground">
                        Comprobando suscripción…
                      </p>
                    )}

                    {pushError && (
                      <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{pushError}</AlertDescription>
                      </Alert>
                    )}

                    {isBlocked && (
                      <Alert>
                        <AlertTitle>Notificaciones bloqueadas</AlertTitle>
                        <AlertDescription>
                          Activa las notificaciones en la configuración de tu navegador.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => void enable().catch(() => undefined)}
                        disabled={!showEnableButton || isEnabling}
                        className="w-full"
                      >
                        {isEnabling ? 'Activando…' : 'Activar notificaciones'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void disable().catch(() => undefined)}
                        disabled={!hasSubscription || isDisabling || isInitializing}
                        className="w-full"
                      >
                        {isDisabling ? 'Desactivando…' : 'Desactivar notificaciones'}
                      </Button>
                    </div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="password" className="border rounded-lg px-4 bg-card">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                <span className="font-semibold">Cambiar contraseña</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Contraseña actual</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                />
              </div>

              <Button
                onClick={handlePasswordChange}
                disabled={loading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  'Actualizar contraseña'
                )}
              </Button>
            </AccordionContent>
          </AccordionItem>

          {(profile.role === 'admin' || profile.role === 'management') && (
            <AccordionItem value="folder-structure" className="border rounded-lg px-4 bg-card">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <FolderTree className="h-5 w-5" />
                  <span className="font-semibold">Estructura de carpetas</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <Tabs defaultValue="jobs" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="jobs">Trabajos</TabsTrigger>
                    <TabsTrigger value="tours">Giras</TabsTrigger>
                  </TabsList>

                  <TabsContent value="jobs" className="mt-4">
                    <div className="max-h-[400px] overflow-y-auto">
                      <FolderStructureEditor
                        value={folderStructure}
                        onChange={setFolderStructure}
                        title="Estructura de carpetas para trabajos"
                        description="Personaliza la estructura para trabajos y festivales."
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="tours" className="mt-4">
                    <div className="max-h-[400px] overflow-y-auto">
                      <FolderStructureEditor
                        value={tourFolderStructure}
                        onChange={setTourFolderStructure}
                        title="Estructura de carpetas para giras"
                        description="Usa 'tourdates' para crear carpetas por fecha."
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <Button
                  onClick={handleFolderStructureSave}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar estructura
                    </>
                  )}
                </Button>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 lg:grid-cols-2 gap-6">
          <div className="xl:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="h-6 w-6" />
                  Editar perfil
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Nombre</Label>
                      <Input
                        id="firstName"
                        value={profile.first_name || ''}
                        onChange={(e) => {
                          setProfile({ ...profile, first_name: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nickname">Apodo</Label>
                      <Input
                        id="nickname"
                        value={profile.nickname || ''}
                        onChange={(e) => {
                          setProfile({ ...profile, nickname: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="lastName">Apellidos</Label>
                      <Input
                        id="lastName"
                        value={profile.last_name || ''}
                        onChange={(e) => {
                          setProfile({ ...profile, last_name: e.target.value });
                          setHasUnsavedChanges(true);
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profile.phone || ''}
                      onChange={(e) => {
                        setProfile({ ...profile, phone: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Departamento</Label>
                    <Select
                      value={profile.department || ''}
                      onValueChange={(value) => {
                        setProfile({ ...profile, department: value as Department });
                        setHasUnsavedChanges(true);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sound">Sonido</SelectItem>
                        <SelectItem value="lights">Luces</SelectItem>
                        <SelectItem value="video">Vídeo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dni">DNI/NIE</Label>
                    <Input
                      id="dni"
                      value={profile.dni || ''}
                      onChange={(e) => {
                        setProfile({ ...profile, dni: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="residencia">Residencia</Label>
                    <Input
                      id="residencia"
                      value={profile.residencia || ''}
                      onChange={(e) => {
                        setProfile({ ...profile, residencia: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <Input
                      id="role"
                      value={profile.role || ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading || !hasUnsavedChanges}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar cambios
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {showPushControls && (
              <Card>
                <CardHeader>
                  <CardTitle>Notificaciones push</CardTitle>
                  <CardDescription>
                    Gestiona las notificaciones push para este dispositivo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isSupported ? (
                    <Alert>
                      <AlertTitle>Navegador no compatible</AlertTitle>
                      <AlertDescription>
                        Tu navegador actual no admite notificaciones web push.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">Permiso:</span> {permissionLabel}
                        </p>
                        <p>
                          <span className="font-medium">Suscripción:</span>{' '}
                          {hasSubscription ? 'Activa en este dispositivo' : 'Aún no activa'}
                        </p>
                      </div>

                      {isInitializing && (
                        <p className="text-sm text-muted-foreground">
                          Comprobando si este dispositivo ya tiene una suscripción…
                        </p>
                      )}

                      {pushError && (
                        <Alert variant="destructive">
                          <AlertTitle>Error de notificaciones</AlertTitle>
                          <AlertDescription>{pushError}</AlertDescription>
                        </Alert>
                      )}

                      {isBlocked && (
                        <Alert>
                          <AlertTitle>Notificaciones bloqueadas</AlertTitle>
                          <AlertDescription>
                            Activa las notificaciones en la configuración de tu navegador y recarga la página.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => void enable().catch(() => undefined)}
                          disabled={!showEnableButton || isEnabling}
                        >
                          {isEnabling ? 'Activando…' : 'Activar notificaciones'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void disable().catch(() => undefined)}
                          disabled={!hasSubscription || isDisabling || isInitializing}
                        >
                          {isDisabling ? 'Desactivando…' : 'Desactivar notificaciones'}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Cambiar contraseña</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Contraseña actual</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nueva contraseña</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    />
                  </div>

                  <Button
                    onClick={handlePasswordChange}
                    disabled={loading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Actualizando contraseña...
                      </>
                    ) : (
                      'Actualizar contraseña'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {(profile.role === 'admin' || profile.role === 'management') && (
            <div className="xl:col-span-2 lg:col-span-1 space-y-6">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Personalización de estructura de carpetas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs defaultValue="jobs" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="jobs">Carpetas de trabajos</TabsTrigger>
                      <TabsTrigger value="tours">Carpetas de giras</TabsTrigger>
                    </TabsList>

                    <TabsContent value="jobs" className="mt-6">
                      <div className="max-h-[600px] overflow-y-auto">
                        <FolderStructureEditor
                          value={folderStructure}
                          onChange={setFolderStructure}
                          title="Estructura personalizada de carpetas para trabajos"
                          description="Personaliza la estructura de carpetas para trabajos y festivales."
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="tours" className="mt-6">
                      <div className="max-h-[600px] overflow-y-auto">
                        <FolderStructureEditor
                          value={tourFolderStructure}
                          onChange={setTourFolderStructure}
                          title="Estructura personalizada de carpetas para giras"
                          description="Personaliza la estructura de carpetas específicamente para las giras. Usa el elemento 'tourdates' para crear carpetas por cada fecha."
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="pt-4 border-t">
                    <Button
                      onClick={handleFolderStructureSave}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Guardar estructura de carpetas
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Profile;
