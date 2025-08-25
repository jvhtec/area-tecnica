
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Image, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface TourLogoManagerProps {
  tourId: string;
}

export const TourLogoManager = ({ tourId }: TourLogoManagerProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const fetchExistingLogo = useCallback(async () => {
    try {
      console.log("Fetching logo for tour:", tourId);
      
      if (!tourId) {
        console.log("No tour ID provided");
        return;
      }
      
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
          const { data: signedUrlData } = await supabase
            .storage
            .from('tour-logos')
            .createSignedUrl(data.file_path, 60 * 60); // 1 hour expiry
            
          if (signedUrlData?.signedUrl) {
            console.log("Found existing tour logo (signed):", signedUrlData.signedUrl);
            setLogoUrl(signedUrlData.signedUrl);
          } else {
            // Fallback to public URL
            const { data: publicUrlData } = supabase
              .storage
              .from('tour-logos')
              .getPublicUrl(data.file_path);
              
            if (publicUrlData?.publicUrl) {
              console.log("Found existing tour logo (public):", publicUrlData.publicUrl);
              setLogoUrl(publicUrlData.publicUrl);
            }
          }
        } catch (e: any) {
          console.error('Error getting logo public URL:', e);
          setErrorDetails(`Failed to get logo URL: ${e.message}`);
        }
      } else {
        console.log("No logo found for tour", tourId);
        setLogoUrl(null);
      }
    } catch (error: any) {
      console.error('Unexpected error in fetchExistingLogo:', error);
      setErrorDetails(`Unexpected error: ${error.message}`);
    }
  }, [tourId]);

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

    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to upload logos",
        variant: "destructive",
      });
      return;
    }
    
    const userId = user.id;

    setIsUploading(true);
    try {
      console.log("Uploading logo for tour:", tourId);
      console.log("Authenticated user:", userId);
      
      // Check auth status before proceeding
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("Authentication error: " + (sessionError?.message || "Session not found"));
      }
      
      const fileExt = file.name.split('.').pop();
      const filePath = `${tourId}.${fileExt}`;

      console.log("Checking for existing logo in database");
      // First, check if there's an existing logo
      const { data: existingLogo, error: fetchError } = await supabase
        .from('tour_logos')
        .select('file_path')
        .eq('tour_id', tourId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching existing logo:', fetchError);
        throw new Error(`Error fetching existing logo: ${fetchError.message}`);
      }

      // If there's an existing logo, remove it from storage
      if (existingLogo?.file_path) {
        console.log("Removing existing logo from storage:", existingLogo.file_path);
        const { error: removeError } = await supabase.storage
          .from('tour-logos')
          .remove([existingLogo.file_path]);
          
        if (removeError) {
          console.error('Error removing existing logo:', removeError);
          // Log but continue with upload even if delete fails
        }
      }

      // Upload new logo
      console.log("Uploading new logo to storage:", filePath);
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

      // Insert or update the database record
      console.log("Updating tour_logos table");
      const { error: dbError } = await supabase
        .from('tour_logos')
        .upsert({
          tour_id: tourId,
          file_path: filePath,
          file_name: file.name,
          content_type: file.type,
          file_size: file.size,
          uploaded_by: userId,
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Error saving logo information: ${dbError.message}`);
      }

      // Get signed URL for uploaded logo
      const { data: signedUrlData } = await supabase
        .storage
        .from('tour-logos')
        .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

      const logoUrl = signedUrlData?.signedUrl || supabase
        .storage
        .from('tour-logos')
        .getPublicUrl(filePath).data.publicUrl;

      console.log("Uploaded new tour logo, URL:", logoUrl);
      setLogoUrl(logoUrl);

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
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to delete logos",
        variant: "destructive",
      });
      return;
    }
    
    const userId = user.id;
    
    try {
      console.log("Deleting logo as user:", userId);
      
      // Check auth status before proceeding
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("Authentication error: " + (sessionError?.message || "Session not found"));
      }
      
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
        console.log("Removing logo from storage:", data.file_path);
        const { error: storageError } = await supabase.storage
          .from('tour-logos')
          .remove([data.file_path]);

        if (storageError) {
          console.error('Error removing from storage:', storageError);
          throw new Error(`Error removing logo: ${storageError.message}`);
        }

        console.log("Deleting logo record from database");
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
      } else {
        console.log("No logo found to delete");
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
  }, [tourId, fetchExistingLogo]); 

  return (
    <div className="space-y-4">
      {logoUrl ? (
        <div className="relative w-36 h-36">
          <img
            src={logoUrl}
            alt="Tour logo"
            className="w-full h-full object-contain"
            onError={(e) => {
              console.error('Image failed to load:', logoUrl);
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAgMTRIMTRWMTZIMTBWMTRaIiBmaWxsPSJjdXJyZW50Q29sb3IiLz48cGF0aCBkPSJNMTIgMUMxNC4yMDkxIDEgMTYgMi43OTA4NiAxNiA1QzE2IDcuMjA5MTQgMTQuMjA5MSA5IDEyIDlDOS43OTA4NiA5IDggNy4yMDkxNCA4IDVDOCAyLjc5MDg2IDkuNzkwODYgMSAxMiAxWiIgZmlsbD0iY3VycmVudENvbG9yIi8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xIDEzQzEgMTAuNzkwOSAyLjc5MDg2IDkgNSA5SDE5QzIxLjIwOTEgOSAyMyAxMC43OTA5IDIzIDEzVjE5QzIzIDIwLjEwNDYgMjIuMTA0NiAyMSAyMSAyMUgzQzEuODk1NDMgMjEgMSAyMC4xMDQ2IDEgMTlWMTNaTTE5IDExSDVDMy44OTU0MyAxMSAzIDExLjg5NTQgMyAxM0MzIDE1LjIwOTEgNC43OTA5MSAxNyA3IDE3SDE3QzE5LjIwOTEgMTcgMjEgMTUuMjA5MSAyMSAxM0MyMSAxMS44OTU0IDIwLjEwNDYgMTEgMTkgMTFaIiBmaWxsPSJjdXJyZW50Q29sb3IiLz48L3N2Zz4=';
            }}
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
