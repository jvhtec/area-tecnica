import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save, User, Phone, MapPin, CreditCard, Calendar as CalendarIcon, Lock, ChevronRight, LogOut, Camera, X, Bell, BellOff, AlertTriangle } from 'lucide-react';
import { Theme } from './types';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface ProfileUser {
    id: string;
    email?: string;
}

interface UserProfile {
    first_name?: string;
    last_name?: string;
    phone?: string;
    city?: string;
    dni?: string;
    profile_color?: string;
    role?: string;
    department?: string;
}

interface ProfileViewProps {
    theme: Theme;
    isDark: boolean;
    user: ProfileUser | null;
    userProfile: UserProfile | null;
    toggleTheme: () => void;
}

export const ProfileView = ({ theme, isDark, user, userProfile, toggleTheme }: ProfileViewProps) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedColor, setSelectedColor] = useState(userProfile?.profile_color || '#3b82f6');

    // Push notifications hook
    const {
        isSupported: pushSupported,
        permission: pushPermission,
        subscription: pushSubscription,
        isInitializing: pushInitializing,
        isEnabling: pushEnabling,
        isDisabling: pushDisabling,
        error: pushError,
        enable: enablePush,
        disable: disablePush,
        canEnable: canEnablePush,
    } = usePushNotifications();

    // Password change modal state
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Form state
    const [firstName, setFirstName] = useState(userProfile?.first_name || '');
    const [lastName, setLastName] = useState(userProfile?.last_name || '');
    const [phone, setPhone] = useState(userProfile?.phone || '');
    const [city, setCity] = useState(userProfile?.city || '');
    const [dni, setDni] = useState(userProfile?.dni || '');

    // Update form when profile loads
    useEffect(() => {
        if (userProfile) {
            setFirstName(userProfile.first_name || '');
            setLastName(userProfile.last_name || '');
            setPhone(userProfile.phone || '');
            setCity(userProfile.city || '');
            setDni(userProfile.dni || '');
            setSelectedColor(userProfile.profile_color || '#3b82f6');
        }
    }, [userProfile]);

    const userInitials = firstName && lastName
        ? `${firstName[0]}`.toUpperCase()
        : user?.email?.[0]?.toUpperCase() || '?';

    const userName = firstName && lastName
        ? `${firstName} ${lastName}`
        : user?.email || 'Técnico';

    const roleLabels: Record<string, string> = {
        'technician': 'Técnico',
        'house_tech': 'Técnico de sala',
        'admin': 'Administrador',
        'management': 'Gestión',
    };
    const roleLabel = roleLabels[userProfile?.role] || userProfile?.role || 'Técnico';

    const deptLabels: Record<string, string> = {
        'sound': 'Sonido',
        'lights': 'Luces',
        'video': 'Vídeo',
    };
    const deptLabel = deptLabels[userProfile?.department?.toLowerCase()] || userProfile?.department || '';

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    // Handle password change
    const handlePasswordChange = async () => {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('Las contraseñas nuevas no coinciden');
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setPasswordLoading(true);
        try {
            // First verify the current password
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user?.email || '',
                password: passwordForm.currentPassword,
            });

            if (signInError) {
                toast.error('La contraseña actual no es correcta');
                return;
            }

            // Update the password
            const { error: updateError } = await supabase.auth.updateUser({
                password: passwordForm.newPassword
            });

            if (updateError) throw updateError;

            toast.success('Contraseña actualizada correctamente');
            setShowPasswordModal(false);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al cambiar la contraseña';
            toast.error(message);
        } finally {
            setPasswordLoading(false);
        }
    };

    // Handle calendar sync - show instructions
    const handleCalendarSync = () => {
        toast.info('Función de sincronización de calendario disponible próximamente', {
            description: 'Podrás exportar tus turnos a Google Calendar o Apple Calendar',
            duration: 4000,
        });
    };

    // Handle push notifications enable/disable
    const handleEnablePush = async () => {
        try {
            await enablePush();
            toast.success('Notificaciones push activadas');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al activar notificaciones';
            toast.error(message);
        }
    };

    const handleDisablePush = async () => {
        try {
            await disablePush();
            toast.success('Notificaciones push desactivadas');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al desactivar notificaciones';
            toast.error(message);
        }
    };

    // Save profile mutation
    const saveProfileMutation = useMutation({
        mutationFn: async () => {
            if (!user?.id) throw new Error('No user');
            const { error } = await supabase
                .from('profiles')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    phone,
                    city,
                    dni,
                    profile_color: selectedColor,
                })
                .eq('id', user.id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Perfil actualizado');
            queryClient.invalidateQueries({ queryKey: ['user-profile'] });
        },
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'Error desconocido';
            toast.error(`Error: ${message}`);
        },
    });

    return (
        <div className="space-y-6 animate-in fade-in pb-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className={`text-2xl font-bold ${theme.textMain}`}>Perfil</h1>
                <button
                    onClick={toggleTheme}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${theme.card} ${theme.textMuted}`}
                >
                    {isDark ? "Modo claro" : "Modo oscuro"}
                </button>
            </div>

            {/* 1. Avatar & Identity */}
            <div className={`p-6 rounded-2xl border flex flex-col items-center text-center relative overflow-hidden ${theme.card}`}>
                {/* Color Banner Background */}
                <div className="absolute top-0 left-0 w-full h-24 opacity-20" style={{ backgroundColor: selectedColor }} />

                <div className="relative mt-4 mb-4">
                    <div
                        className={`w-24 h-24 rounded-full border-4 flex items-center justify-center text-3xl font-bold ${theme.bg} ${theme.textMain}`}
                        style={{ borderColor: selectedColor }}
                    >
                        {userInitials}
                    </div>
                    <button className="absolute bottom-0 right-0 p-2 rounded-full shadow-lg bg-blue-600 text-white hover:bg-blue-500">
                        <Camera size={14} />
                    </button>
                </div>

                <h2 className={`text-xl font-bold ${theme.textMain}`}>{userName}</h2>
                <p className={`text-sm ${theme.textMuted}`}>{roleLabel} • {deptLabel}</p>
            </div>

            {/* 2. Personal Info Form */}
            <div className={`p-5 rounded-2xl border ${theme.card}`}>
                <h3 className={`flex items-center gap-2 font-bold mb-4 ${theme.textMain}`}>
                    <User size={18} className="text-blue-500" /> Información Personal
                </h3>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={`text-xs font-bold mb-1.5 block ml-1 ${theme.textMuted}`}>Nombre</label>
                        <Input
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className={theme.input}
                        />
                    </div>
                    <div>
                        <label className={`text-xs font-bold mb-1.5 block ml-1 ${theme.textMuted}`}>Apellidos</label>
                        <Input
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className={theme.input}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className={`text-xs font-bold mb-1.5 block ml-1 ${theme.textMuted}`}>Teléfono</label>
                        <div className="relative">
                            <Phone size={16} className={`absolute left-3 top-3 ${theme.textMuted}`} />
                            <Input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className={`pl-10 ${theme.input}`}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={`text-xs font-bold mb-1.5 block ml-1 ${theme.textMuted}`}>Ciudad</label>
                        <div className="relative">
                            <MapPin size={16} className={`absolute left-3 top-3 ${theme.textMuted}`} />
                            <Input
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className={`pl-10 ${theme.input}`}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <label className={`text-xs font-bold mb-1.5 block ml-1 ${theme.textMuted}`}>DNI / NIE</label>
                    <div className="relative">
                        <CreditCard size={16} className={`absolute left-3 top-3 ${theme.textMuted}`} />
                        <Input
                            value={dni}
                            onChange={(e) => setDni(e.target.value)}
                            className={`pl-10 ${theme.input}`}
                        />
                    </div>
                </div>

                <Button
                    className="w-full mt-4"
                    onClick={() => saveProfileMutation.mutate()}
                    disabled={saveProfileMutation.isPending}
                >
                    {saveProfileMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Guardando...</>
                    ) : (
                        <><Save size={16} className="mr-2" /> Guardar cambios</>
                    )}
                </Button>
            </div>

            {/* App Settings */}
            <div>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 mt-6 px-1 ${theme.textMuted}`}>
                    Ajustes de App
                </h3>

                {/* Push Notifications */}
                <div className={`p-4 rounded-xl border mb-3 ${theme.card}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${pushSubscription ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-400'}`}>
                                {pushSubscription ? <Bell size={18} /> : <BellOff size={18} />}
                            </div>
                            <div>
                                <div className={`font-bold text-sm ${theme.textMain}`}>Notificaciones Push</div>
                                <div className={`text-xs mt-0.5 ${theme.textMuted}`}>
                                    {pushInitializing ? 'Cargando...' :
                                        pushPermission === 'denied' ? 'Bloqueadas en el navegador' :
                                            pushSubscription ? 'Activadas' : 'Desactivadas'}
                                </div>
                            </div>
                        </div>

                        {pushInitializing ? (
                            <Loader2 size={20} className="animate-spin text-blue-500" />
                        ) : pushPermission === 'denied' ? (
                            <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                                Bloqueado
                            </span>
                        ) : pushSubscription ? (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleDisablePush}
                                disabled={pushDisabling}
                                className="text-xs"
                            >
                                {pushDisabling ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                                Desactivar
                            </Button>
                        ) : canEnablePush ? (
                            <Button
                                size="sm"
                                onClick={handleEnablePush}
                                disabled={pushEnabling}
                                className="text-xs bg-blue-600 hover:bg-blue-500 text-white"
                            >
                                {pushEnabling ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                                Activar
                            </Button>
                        ) : null}
                    </div>

                    {/* Error message */}
                    {pushError && (
                        <div className={`mt-3 p-2 rounded-lg text-xs flex items-center gap-2 ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                            <AlertTriangle size={14} />
                            {pushError}
                        </div>
                    )}

                    {/* Permission denied hint */}
                    {pushPermission === 'denied' && (
                        <div className={`mt-3 p-2 rounded-lg text-xs ${isDark ? 'bg-white/5' : 'bg-slate-50'} ${theme.textMuted}`}>
                            Para activar las notificaciones, debes desbloquearlas en la configuración de tu navegador.
                        </div>
                    )}

                    {/* Not supported hint */}
                    {!pushSupported && (
                        <div className={`mt-3 p-2 rounded-lg text-xs ${isDark ? 'bg-white/5' : 'bg-slate-50'} ${theme.textMuted}`}>
                            Las notificaciones push no están soportadas en este navegador.
                        </div>
                    )}
                </div>

                {/* Calendar Sync */}
                <div
                    onClick={handleCalendarSync}
                    className={`p-4 rounded-xl border mb-3 flex items-center justify-between cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'} transition-colors ${theme.card}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><CalendarIcon size={18} /></div>
                        <div>
                            <div className={`font-bold text-sm ${theme.textMain}`}>Sincronizar Calendario</div>
                            <div className={`text-xs ${theme.textMuted}`}>Google / Apple Calendar (ICS)</div>
                        </div>
                    </div>
                    <ChevronRight size={18} className={theme.textMuted} />
                </div>

                {/* Change Password */}
                <div
                    onClick={() => setShowPasswordModal(true)}
                    className={`p-4 rounded-xl border mb-3 flex items-center justify-between cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'} transition-colors ${theme.card}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Lock size={18} /></div>
                        <div>
                            <div className={`font-bold text-sm ${theme.textMain}`}>Cambiar Contraseña</div>
                            <div className={`text-xs ${theme.textMuted}`}>Gestiona tu contraseña de acceso</div>
                        </div>
                    </div>
                    <ChevronRight size={18} className={theme.textMuted} />
                </div>

            </div>

            {/* 5. Sign Out */}
            <button
                onClick={handleSignOut}
                className="w-full py-4 mt-4 text-red-500 font-bold text-sm bg-red-500/5 border border-red-500/20 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
            >
                <LogOut size={18} /> Cerrar Sesión
            </button>

            {/* Version */}
            <div className={`text-center text-xs mt-6 ${theme.textMuted}`}>
                Versión 2.4.1 (Build 2930)
            </div>

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className={`fixed inset-0 z-[70] flex items-center justify-center ${theme.modalOverlay} p-4 animate-in fade-in duration-200`}>
                    <div className={`w-full max-w-md ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${theme.divider} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
                        {/* Header */}
                        <div className={`p-4 border-b ${theme.divider} flex justify-between items-center`}>
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-blue-500 text-white">
                                    <Lock size={18} />
                                </div>
                                <h2 className={`text-lg font-bold ${theme.textMain}`}>Cambiar Contraseña</h2>
                            </div>
                            <button onClick={() => setShowPasswordModal(false)} className={`p-2 ${theme.textMuted} hover:${theme.textMain} rounded-full transition-colors`}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="p-5 space-y-4">
                            <div>
                                <label className={`text-xs font-bold mb-1.5 block ${theme.textMuted}`}>Contraseña actual</label>
                                <Input
                                    type="password"
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    className={theme.input}
                                    placeholder="••••••••"
                                />
                            </div>

                            <div>
                                <label className={`text-xs font-bold mb-1.5 block ${theme.textMuted}`}>Nueva contraseña</label>
                                <Input
                                    type="password"
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    className={theme.input}
                                    placeholder="••••••••"
                                />
                            </div>

                            <div>
                                <label className={`text-xs font-bold mb-1.5 block ${theme.textMuted}`}>Confirmar nueva contraseña</label>
                                <Input
                                    type="password"
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    className={theme.input}
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowPasswordModal(false);
                                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                    }}
                                    disabled={passwordLoading}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handlePasswordChange}
                                    disabled={passwordLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                                >
                                    {passwordLoading ? (
                                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Actualizando...</>
                                    ) : (
                                        'Actualizar'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
