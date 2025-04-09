
import { WorkHoursManagement } from "@/components/management/WorkHoursManagement";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function WorkHoursManagementPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log("No session found, redirecting to auth");
          navigate("/auth");
          return;
        }
        
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        
        if (profileError) {
          console.error("Error fetching profile:", profileError);
          throw profileError;
        }
        
        setUserRole(profile.role);
        
        if (!profile || !["admin", "management"].includes(profile.role)) {
          console.log("Unauthorized access attempt");
          navigate("/dashboard");
          return;
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error in access check:", error);
        navigate("/dashboard");
      }
    };
    
    checkAccess();
  }, [navigate]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-6">Work Hours Management</h1>
      <WorkHoursManagement />
    </div>
  );
}
