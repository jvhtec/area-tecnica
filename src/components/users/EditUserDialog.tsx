
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Profile } from "./types";
import { Department, ALL_DEPARTMENTS, DEPARTMENT_LABELS } from "@/types/department";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { HouseTechRateEditor } from "@/components/settings/HouseTechRateEditor";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { formatUserName } from "@/utils/userName";
import { CityAutocomplete } from "@/components/maps/CityAutocomplete";
import { ProfilePictureUpload } from "@/components/profile/ProfilePictureUpload";

interface EditUserDialogProps {
  user: Profile | null;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedData: Partial<Profile>) => void;
}

export const EditUserDialog = ({ user, onOpenChange, onSave }: EditUserDialogProps) => {
  // Keep dialog mounted even if user becomes null to avoid portal teardown race conditions
  const [assignableAsTech, setAssignableAsTech] = useState<boolean>(!!user?.assignable_as_tech);
  const [soundvisionAccessEnabled, setSoundvisionAccessEnabled] = useState<boolean>(!!user?.soundvision_access_enabled);
  const [isAutonomo, setIsAutonomo] = useState<boolean>(user?.autonomo !== false);
  const { userRole } = useOptimizedAuth();
  const isManagementUser = ['admin', 'management'].includes(userRole || '');
  const [flexUrl, setFlexUrl] = useState<string>("");
  const [flexResourceId, setFlexResourceId] = useState<string>(user?.flex_resource_id || "");
  const [isSendingOnboarding, setIsSendingOnboarding] = useState(false);
  const [residencia, setResidencia] = useState<string>(user?.residencia || "");
  const [bgColor, setBgColor] = useState<string>(user?.bg_color || "");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(user?.profile_picture_url || null);

  useEffect(() => {
    setAssignableAsTech(!!user?.assignable_as_tech);
    const forceSoundvisionForHouseTech = user?.department === 'sound' && user?.role === 'house_tech';
    setSoundvisionAccessEnabled(forceSoundvisionForHouseTech ? true : !!user?.soundvision_access_enabled);
    setFlexResourceId(user?.flex_resource_id || "");
    setFlexUrl("");
    setIsAutonomo(user?.autonomo !== false);
    setResidencia(user?.residencia || "");
    setBgColor(user?.bg_color || "");
    setProfilePictureUrl(user?.profile_picture_url || null);
  }, [user?.id]);

  const isSoundTechnician = user?.department === 'sound' && user?.role === 'technician';
  const isSoundHouseTech = user?.department === 'sound' && user?.role === 'house_tech';
  const forceSoundvisionAccess = isSoundHouseTech;

  const extractFlexIdFromUrl = (url: string): string | null => {
    try {
      // Accept raw UUID directly
      const raw = url.trim();
      const uuidRe = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;
      const direct = raw.match(uuidRe)?.[0];
      if (direct) return direct;
      // Typical Flex URL: ...#contact/<uuid>/...
      const hash = raw.split('#')[1] || '';
      const m = hash.match(uuidRe);
      return m?.[0] || null;
    } catch {
      return null;
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Ensure we have a valid user ID
    if (!user?.id) {
      console.error("Cannot update user: No valid ID");
      return;
    }

    const updatedData: Partial<Profile> = {
      id: user.id,
      first_name: formData.get('firstName') as string,
      nickname: formData.get('nickname') as string,
      last_name: formData.get('lastName') as string,
      phone: formData.get('phone') as string,
      department: formData.get('department') as Department,
      dni: formData.get('dni') as string,
      residencia: residencia,
      bg_color: bgColor || null,
      role: formData.get('role') as string,
      assignable_as_tech: assignableAsTech,
      flex_resource_id: (formData.get('flex_resource_id') as string || flexResourceId || '').trim() || null,
      soundvision_access_enabled: forceSoundvisionAccess ? true : soundvisionAccessEnabled,
      autonomo: isAutonomo,
    };

    console.log("Submitting user update with data:", updatedData);
    onSave(updatedData);
  };

  const handleSendOnboarding = async () => {
    if (!user?.email) {
      toast({ title: "Missing email", description: "This user has no email set.", variant: "destructive" });
      return;
    }
    try {
      setIsSendingOnboarding(true);
      const { error } = await supabase.functions.invoke('send-onboarding-email', {
        body: {
          email: user.email,
          firstName: user.first_name || undefined,
          lastName: user.last_name || undefined,
          department: user.department || undefined,
        },
      });
      if (error) throw error;
      toast({ title: "Onboarding email sent", description: `Sent to ${user.email}`, variant: "success" });
    } catch (err) {
      console.error('send-onboarding-email error', err);
      toast({ title: "Failed to send onboarding", description: err instanceof Error ? err.message : 'Unknown error', variant: "destructive" });
    } finally {
      setIsSendingOnboarding(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Profile Picture */}
            <div className="flex justify-center py-4">
              <ProfilePictureUpload
                userId={user?.id || ''}
                currentPictureUrl={profilePictureUrl}
                userInitials={`${user?.first_name?.[0] || ''}${(user?.nickname || user?.last_name)?.[0] || ''}`.toUpperCase() || 'U'}
                onUploadComplete={(url) => setProfilePictureUrl(url)}
                onRemove={() => setProfilePictureUrl(null)}
                size="lg"
                showCameraIcon={true}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={user?.first_name || ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                name="nickname"
                defaultValue={user?.nickname || ''}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignableAsTech">Assignable to jobs as tech</Label>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="assignableAsTech"
                  checked={assignableAsTech}
                  onCheckedChange={(v) => setAssignableAsTech(!!v)}
                />
                <span className="text-sm text-muted-foreground">
                  If enabled, this user (typically management) can be assigned to jobs in technician lists.
                </span>
              </div>
            </div>
            {isManagementUser && (isSoundTechnician || isSoundHouseTech) && (
              <div className="space-y-2">
                <Label htmlFor="soundvisionAccess">SoundVision Access</Label>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="soundvisionAccess"
                    checked={forceSoundvisionAccess ? true : soundvisionAccessEnabled}
                    onCheckedChange={(v) => !forceSoundvisionAccess && setSoundvisionAccessEnabled(!!v)}
                    disabled={forceSoundvisionAccess}
                  />
                  <span className="text-sm text-muted-foreground">
                    {forceSoundvisionAccess
                      ? 'House techs always retain SoundVision access.'
                      : 'Allow this sound technician to access SoundVision files and tools.'}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={user?.last_name || ''}
              />
            </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={user?.phone || ''}
          />
        </div>

            {/* Flex Resource ID helpers (management only) */}
            {isManagementUser && (
              <div className="space-y-2">
                <Label htmlFor="flex_resource_id">Flex Resource ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="flex_resource_id"
                    name="flex_resource_id"
                    placeholder="4b0d98e0-e700-11ea-97d0-2a0a4490a7fb"
                    value={flexResourceId}
                    onChange={(e) => setFlexResourceId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flex_url">Flex Contact URL (paste then Extract)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="flex_url"
                      placeholder="https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#contact/UUID/phone"
                      value={flexUrl}
                      onChange={(e) => setFlexUrl(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const id = extractFlexIdFromUrl(flexUrl);
                        if (id) setFlexResourceId(id);
                      }}
                    >
                      Extract
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const clip = await navigator.clipboard.readText();
                          setFlexUrl(clip);
                          const id = extractFlexIdFromUrl(clip);
                          if (id) setFlexResourceId(id);
                        } catch (_) {
                          // Clipboard not available; no-op
                        }
                      }}
                    >
                      Paste URL
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Example URL: https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#contact/4b0d98e0-e700-11ea-97d0-2a0a4490a7fb/phone
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="department">Departamento</Label>
              <Select name="department" defaultValue={user?.department || 'sound'}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un departamento" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {DEPARTMENT_LABELS[dept]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select name="role" defaultValue={user?.role}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="management">Management</SelectItem>
                  <SelectItem value="logistics">Logistics</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="house_tech">House Tech</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {user?.role === 'technician' && (
              <div className="space-y-2">
                <Label htmlFor="autonomo">Autónomo (Self-employed)</Label>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="autonomo"
                    checked={isAutonomo}
                    onCheckedChange={(v) => setIsAutonomo(!!v)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {isAutonomo 
                      ? 'Technician is autonomous (standard rates apply)' 
                      : 'Not autonomous (€30/day discount applied)'}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="dni">DNI/NIE</Label>
              <Input
                id="dni"
                name="dni"
                defaultValue={user?.dni || ''}
              />
            </div>
            <CityAutocomplete
              id="residencia"
              value={residencia}
              onChange={setResidencia}
              placeholder="Enter city"
              label="Residencia"
              className="space-y-2"
            />
            <div className="space-y-2">
              <Label htmlFor="bg_color">Row Background Color</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { color: '#DC2626', name: 'Red' },
                  { color: '#2563EB', name: 'Blue' },
                  { color: '#16A34A', name: 'Green' },
                  { color: '#CA8A04', name: 'Yellow' },
                  { color: '#9333EA', name: 'Purple' },
                  { color: '#EA580C', name: 'Orange' },
                  { color: '#DB2777', name: 'Pink' },
                  { color: '#0891B2', name: 'Cyan' },
                  { color: '#65A30D', name: 'Lime' },
                  { color: '#7C3AED', name: 'Violet' },
                  { color: '#0D9488', name: 'Teal' },
                  { color: '#64748B', name: 'Slate' },
                ].map(({ color, name }) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBgColor(color)}
                    className={`w-10 h-10 rounded border-2 transition-all hover:scale-110 ${
                      bgColor === color ? 'border-white ring-2 ring-white' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    title={name}
                  />
                ))}
                {bgColor && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBgColor('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {isManagementUser && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleSendOnboarding()}
                  disabled={isSendingOnboarding}
                  title="Send the onboarding email with instructions and screenshots"
                >
                  {isSendingOnboarding ? 'Sending…' : 'Send Onboarding Email'}
                </Button>
              )}
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </form>

          {/* House Tech Rate Editor - Management Only */}
          {isManagementUser && user?.id && (
            <>
              <Separator />
              <HouseTechRateEditor
                profileId={user.id}
                profileName={formatUserName(user.first_name, user.nickname, user.last_name) || ''}
                category={user.role === 'house_tech' ? 'tecnico' : 'tecnico'}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
