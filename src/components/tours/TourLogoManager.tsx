
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
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const fetchExistingLogo = async () => {
    try {
      console.log("Fetching logo for tour:", tourId);
      
      const { data, error } = await supabase
        .from('tour_logos')
        .select('file_path')
        .eq('tour_id', tourId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching logo:', error);
        setErrorDetails(`Failed to fetch logo: ${error.message}`);
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
        } catch (e: any) {
          console.error('Error getting logo public URL:', e);
          setErrorDetails(`Failed to get logo URL: ${e.message}`);
        }
      }
    } catch (error: any) {
      console.error('Unexpected error in fetchExistingLogo:', error);
      setErrorDetails(`Unexpected error: ${error.message}`);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setErrorDetails(null);
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
      console.log("Uploading logo for tour:", tourId);
      
      const fileExt = file.name.split('.').pop();
      const filePath = `${tourId}.${fileExt}`;

      // First, delete any existing logo
      const { data: existingLogo, error: fetchError } = await supabase
        .from('tour_logos')
        .select('file_path')
        .eq('tour_id', tourId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching existing logo:', fetchError);
        throw new Error(`Error fetching existing logo: ${fetchError.message}`);
      }

      if (existingLogo?.file_path) {
        const { error: removeError } = await supabase.storage
          .from('tour-logos')
          .remove([existingLogo.file_path]);
          
        if (removeError) {
          console.error('Error removing existing logo:', removeError);
          // Continue with upload even if delete fails
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('tour-logos')
        .upload(filePath, file, {
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Error uploading logo: ${uploadError.message}`);
      }

      // Get auth user for the uploaded_by field
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Update or insert logo record
      const { error: dbError } = await supabase
        .from('tour_logos')
        .upsert({
          tour_id: tourId,
          file_path: filePath,
          file_name: file.name,
          content_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Error saving logo information: ${dbError.message}`);
      }

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
      const errorMessage = error.message || "Could not upload logo";
      setErrorDetails(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    setErrorDetails(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('tour_logos')
        .select('file_path')
        .eq('tour_id', tourId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching logo:', fetchError);
        throw new Error(`Error fetching logo: ${fetchError.message}`);
      }

      if (data?.file_path) {
        const { error: storageError } = await supabase.storage
          .from('tour-logos')
          .remove([data.file_path]);

        if (storageError) {
          console.error('Error removing from storage:', storageError);
          throw new Error(`Error removing logo: ${storageError.message}`);
        }

        const { error: dbError } = await supabase
          .from('tour_logos')
          .delete()
          .eq('tour_id', tourId);

        if (dbError) {
          console.error('Error deleting from database:', dbError);
          throw new Error(`Error deleting logo record: ${dbError.message}`);
        }

        setLogoUrl(null);

        toast({
          title: "Success",
          description: "Tour logo has been removed",
        });
      }
    } catch (error: any) {
      console.error('Error deleting logo:', error);
      const errorMessage = error.message || "Could not delete logo";
      setErrorDetails(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (tourId) {
      fetchExistingLogo();
    }
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
      
      {errorDetails && (
        <div className="text-sm text-red-500 mt-1">
          Error: {errorDetails}
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
