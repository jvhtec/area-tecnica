
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

interface SignUpFormProps {
  onBack?: () => void;
  preventAutoLogin?: boolean;
}

export const SignUpForm = ({ onBack, preventAutoLogin = false }: SignUpFormProps) => {
  const { signUp, createUserAsAdmin, isLoading, error: authError } = useOptimizedAuth();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phone: "",
    department: "",
    dni: "",
    residencia: "",
    flexResourceId: "",
    flexUrl: "",
  });
  const [isFetchingFlex, setIsFetchingFlex] = useState(false);
  const [sendOnboarding, setSendOnboarding] = useState<boolean>(true);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.email || !formData.firstName || !formData.lastName) {
      setError("Please fill in all required fields");
      return;
    }

    if (!preventAutoLogin && !formData.password) {
      setError("Password is required");
      return;
    }

    if (!preventAutoLogin && formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (!preventAutoLogin && formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (preventAutoLogin) {
      // Management creates user via Edge Function; no password needed here
      const created = await createUserAsAdmin({
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        department: formData.department,
        dni: formData.dni,
        residencia: formData.residencia,
        // Pass Flex Resource ID if provided
        // @ts-ignore - allowed as extra prop for the function body
        flex_resource_id: formData.flexResourceId || undefined,
      });
      // Optionally send onboarding email
      if (created && sendOnboarding) {
        try {
          const { data, error } = await supabase.functions.invoke('send-onboarding-email', {
            body: {
              email: formData.email,
              firstName: formData.firstName,
              lastName: formData.lastName,
              department: formData.department,
            }
          });
          if (error) throw error;
          if (!data?.success) throw new Error('Failed to send onboarding email');
          toast({ title: 'Onboarding enviado', description: `Se envió el email a ${formData.email}.` });
        } catch (e: any) {
          toast({ title: 'No se pudo enviar el onboarding', description: e?.message || 'Error desconocido', variant: 'destructive' });
        }
      }
      return;
    } else {
      await signUp({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        department: formData.department,
        dni: formData.dni,
        residencia: formData.residencia,
      });
    }
  };

  return (
    <form onSubmit={handleSignUp} className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Create Account</h2>
        <p className="text-muted-foreground mt-2">
          Fill in your details to get started
        </p>
      </div>

      {(error || authError) && (
        <Alert variant="destructive">
          <AlertDescription>{error || authError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Email *</Label>
        <Input
          id="signup-email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>

      {!preventAutoLogin && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="signup-password">Password *</Label>
            <Input
              id="signup-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              minLength={6}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">Department</Label>
        <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sound">Sound</SelectItem>
            <SelectItem value="lights">Lights</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="logistics">Logistics</SelectItem>
            <SelectItem value="management">Management</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dni">DNI</Label>
          <Input
            id="dni"
            type="text"
            value={formData.dni}
            onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="residencia">Residencia</Label>
          <Input
            id="residencia"
            type="text"
            value={formData.residencia}
            onChange={(e) => setFormData({ ...formData, residencia: e.target.value })}
          />
        </div>
      </div>

      {preventAutoLogin && (
        <div className="space-y-3 border rounded-md p-3">
          <div className="space-y-2">
            <Label htmlFor="flexResourceId">Flex Resource ID (optional)</Label>
            <Input
              id="flexResourceId"
              type="text"
              placeholder="4b0d98e0-e700-11ea-97d0-2a0a4490a7fb"
              value={formData.flexResourceId}
              onChange={(e) => setFormData({ ...formData, flexResourceId: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flexUrl">Flex Contact URL (paste then Extract)</Label>
            <div className="flex gap-2">
              <Input
                id="flexUrl"
                type="text"
                placeholder="https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#contact/UUID/phone"
                value={formData.flexUrl}
                onChange={(e) => setFormData({ ...formData, flexUrl: e.target.value })}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const uuidRe = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;
                  const m = (formData.flexUrl || '').match(uuidRe)?.[0];
                  if (m) setFormData({ ...formData, flexResourceId: m });
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
                    const uuidRe = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;
                    const m = (clip || '').match(uuidRe)?.[0];
                    setFormData({ ...formData, flexUrl: clip, flexResourceId: m || formData.flexResourceId });
                  } catch (_) {
                    // ignore
                  }
                }}
              >
                Paste URL
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={isFetchingFlex || !(formData.flexResourceId || formData.flexUrl)}
                onClick={async () => {
                  try {
                    setIsFetchingFlex(true);
                    const { data, error } = await supabase.functions.invoke('fetch-flex-contact-info', {
                      body: formData.flexResourceId
                        ? { contact_id: formData.flexResourceId }
                        : { url: formData.flexUrl }
                    });
                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);
                    const m = data?.mapped || {};
                    setFormData((prev) => ({
                      ...prev,
                      firstName: m.firstName || prev.firstName,
                      lastName: m.lastName || prev.lastName,
                      email: m.email || prev.email,
                      phone: m.phone || prev.phone,
                      residencia: m.residencia || prev.residencia,
                      dni: m.dni || prev.dni,
                      department: m.department || prev.department,
                      flexResourceId: data?.contact_id || prev.flexResourceId,
                    }));
                    toast({ title: 'Fetched from Flex', description: 'Fields have been autofilled.' });
                  } catch (e: any) {
                    toast({ title: 'Flex fetch failed', description: e?.message || 'Unknown error', variant: 'destructive' });
                  } finally {
                    setIsFetchingFlex(false);
                  }
                }}
              >
                {isFetchingFlex ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching…
                  </>
                ) : (
                  'Fetch from Flex'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Example: https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#contact/4b0d98e0-e700-11ea-97d0-2a0a4490a7fb/phone
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Checkbox id="sendOnboarding" checked={sendOnboarding} onCheckedChange={(v) => setSendOnboarding(!!v)} />
            <Label htmlFor="sendOnboarding">Enviar email de bienvenida (onboarding)</Label>
          </div>
        </div>
      )}

      <div className="flex flex-col space-y-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            preventAutoLogin ? 'Create User' : 'Create Account'
          )}
        </Button>

        {onBack && (
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Button>
        )}
      </div>
    </form>
  );
};
