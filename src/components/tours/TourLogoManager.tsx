
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Image, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TourLogoManagerProps {
  tourId: string;
}

export const TourLogoManager = ({ tourId }: TourLogoManagerProps) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const fetchExistingLogo = async () => {
    const { data, error } = await supabase
      .from('tour_logos')
      .select('file_path')
      .eq('tour_id', tourId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching logo:', error);
      return;
    }

    if (data?.file_path) {
      try {
        const { data: publicUrlData } = supabase
          .storage
          .from('tour-logos')
          .getPublicUrl(data.file_path);
          
        if (publicUrlData?.publicUrl) {
          console.log("Found existing tour logo:", publicUrlData.publicUrl);
          setLogoUrl(publicUrlData.publicUrl);
        }
      } catch (e) {
        console.error('Error getting logo public URL:', e);
      }
    }
  };

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
      const fileExt = file.name.split('.').pop();
      const filePath = `${tourId}.${fileExt}`;

      // First, delete any existing logo
      const { data: existingLogo } = await supabase
        .from('tour_logos')
        .select('file_path')
        .eq('tour_id', tourId)
        .maybeSingle();

      if (existingLogo?.file_path) {
        await supabase.storage
          .from('tour-logos')
          .remove([existingLogo.file_path]);
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('tour-logos')
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Update or insert logo record
      const { error: dbError } = await supabase
        .from('tour_logos')
        .upsert({
          tour_id: tourId,
          file_path: filePath,
          file_name: file.name,
          content_type: file.type,
          file_size: file.size,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (dbError) throw dbError;

      // Get public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('tour-logos')
        .getPublicUrl(filePath);

      console.log("Uploaded new tour logo, public URL:", publicUrl);
      setLogoUrl(publicUrl);

      toast({
        title: "Success",
        description: "Tour logo has been updated",
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

  const handleDeleteLogo = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('tour_logos')
        .select('file_path')
        .eq('tour_id', tourId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data?.file_path) {
        await supabase.storage
          .from('tour-logos')
          .remove([data.file_path]);

        await supabase
          .from('tour_logos')
          .delete()
          .eq('tour_id', tourId);

        setLogoUrl(null);

        toast({
          title: "Success",
          description: "Tour logo has been removed",
        });
      }
    } catch (error: any) {
      console.error('Error deleting logo:', error);
      toast({
        title: "Error",
        description: "Could not delete logo",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchExistingLogo();
  }, [tourId]); 

  return (
    <div className="space-y-4">
      {logoUrl ? (
        <div className="relative w-36 h-36">
          <img
            src={logoUrl}
            alt="Tour logo"
            className="w-full h-full object-contain"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleDeleteLogo}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="w-36 h-36 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
          <Image className="h-12 w-12 text-gray-400" />
        </div>
      )}
      
      <div>
        <input
          type="file"
          id="logo-upload"
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
          <label htmlFor="logo-upload" className="cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload Logo"}
          </label>
        </Button>
      </div>
    </div>
  );
};
