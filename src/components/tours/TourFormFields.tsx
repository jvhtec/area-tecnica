
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SimplifiedJobColorPicker } from "@/components/jobs/SimplifiedJobColorPicker";
import { TourDepartmentSelector } from "./TourDepartmentSelector";
import { Department } from "@/types/department";
import { InvoicingCompany } from "@/types/job";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TourFormFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  description: string;
  setDescription: (description: string) => void;
  color: string;
  setColor: (color: string) => void;
  departments: Department[];
  availableDepartments: Department[];
  currentDepartment: Department;
  onDepartmentChange: (dept: Department, checked: boolean) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  invoicingCompany: InvoicingCompany | null;
  setInvoicingCompany: (company: InvoicingCompany | null) => void;
}

export const TourFormFields = ({
  title,
  setTitle,
  description,
  setDescription,
  color,
  setColor,
  departments,
  availableDepartments,
  currentDepartment,
  onDepartmentChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  invoicingCompany,
  setInvoicingCompany,
}: TourFormFieldsProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        💡 Tour dates (shows, rehearsals, travel days) can be added after creation from the tour management dialog.
      </p>

      <div className="space-y-2">
        <Label>Invoicing Company</Label>
        <Select
          value={invoicingCompany || "none"}
          onValueChange={(value) => setInvoicingCompany(value === "none" ? null : value as InvoicingCompany)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select invoicing company (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="Production Sector">Production Sector</SelectItem>
            <SelectItem value="Sharecable">Sharecable</SelectItem>
            <SelectItem value="MFO">MFO</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          If set, all tour date jobs will inherit this invoicing company
        </p>
      </div>

      <TourDepartmentSelector
        departments={departments}
        availableDepartments={availableDepartments}
        currentDepartment={currentDepartment}
        onDepartmentChange={onDepartmentChange}
      />

      <SimplifiedJobColorPicker color={color} onChange={setColor} />
    </div>
  );
};
