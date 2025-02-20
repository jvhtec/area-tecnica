
import { useState } from "react";
import { Button } from "./ui/button";
import { Upload, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export const CompanyLogoUploader = () => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload('sector-pro-logo.png', file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      toast({
        title: "Success",
        description: "Company logo has been uploaded",
      });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Error",
        description: "Could not upload logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        id="company-logo-upload"
        accept="image/*"
        className="hidden"
        onChange={handleLogoUpload}
        disabled={isUploading}
      />
      <Button
        asChild
        variant="outline"
        disabled={isUploading}
      >
        <label htmlFor="company-logo-upload" className="cursor-pointer">
          {isUploading ? (
            "Uploading..."
          ) : (
            <>
              <ImageIcon className="h-4 w-4 mr-2" />
              Upload Company Logo
            </>
          )}
        </label>
      </Button>
    </div>
  );
};
