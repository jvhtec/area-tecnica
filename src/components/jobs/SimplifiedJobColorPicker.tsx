import { Label } from "@/components/ui/label";

interface SimplifiedJobColorPickerProps {
  color: string;
  onChange: (value: string) => void;
}

export const SimplifiedJobColorPicker = ({ color, onChange }: SimplifiedJobColorPickerProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="color">Color</Label>
      <input
        type="color"
        id="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 p-1 rounded border border-input"
      />
    </div>
  );
};