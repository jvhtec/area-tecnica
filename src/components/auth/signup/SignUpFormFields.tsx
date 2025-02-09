import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Department } from "@/types/department";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface SignUpFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  department: Department;
  dni: string;
  residencia: string;
}

interface SignUpFormFieldsProps {
  onSubmit: (data: SignUpFormData) => void;
  error: string | null;
  isLoading: boolean;
}

export const SignUpFormFields = ({ onSubmit, error, isLoading }: SignUpFormFieldsProps) => {
  const [formData, setFormData] = useState<SignUpFormData>({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    department: "sound",
    dni: "",
    residencia: "",
  });

  const handleChange = (field: keyof SignUpFormData, value: string | Department) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => handleChange("password", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="firstName">First Name</Label>
        <Input
          id="firstName"
          type="text"
          value={formData.firstName}
          onChange={(e) => handleChange("firstName", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lastName">Last Name</Label>
        <Input
          id="lastName"
          type="text"
          value={formData.lastName}
          onChange={(e) => handleChange("lastName", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">Department</Label>
        <Select
          value={formData.department}
          onValueChange={(value) => handleChange("department", value as Department)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sound">Sound</SelectItem>
            <SelectItem value="lights">Lights</SelectItem>
            <SelectItem value="video">Video</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dni">DNI/NIE</Label>
        <Input
          id="dni"
          type="text"
          value={formData.dni}
          onChange={(e) => handleChange("dni", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="residencia">Residencia</Label>
        <Input
          id="residencia"
          type="text"
          value={formData.residencia}
          onChange={(e) => handleChange("residencia", e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          'Sign Up'
        )}
      </Button>
    </form>
  );
};