
import { useState, useEffect, useCallback, useContext, createContext, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  user: any | null;
  userRole: string | null;
  userDepartment: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (userData: SignUpData) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
}

interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  department?: string;
  dni?: string;
  residencia?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Fetch user profile with proper error handling
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Exception in fetchUserProfile:", error);
      return null;
    }
  }, []);

  // Session refresh logic with proper error handling
  const refreshSession = useCallback(async (): Promise<Session | null> => {
    try {
      setLastActivity(Date.now());
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error("Session refresh error:", error);
        // Handle expired session
        if (error.message.includes('expired')) {
          setSession(null);
          setUser(null);
          setUserRole(null);
          setUserDepartment(null);
          navigate('/auth');
        }
        return null;
      }
      
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        
        // Only fetch profile if user changed
        if (!user || user.id !== data.session.user.id) {
          const profile = await fetchUserProfile(data.session.user.id);
          if (profile) {
            setUserRole(profile.role);
            setUserDepartment(profile.department);
          }
        }
        
        return data.session;
      }
      
      return null;
    } catch (error) {
      console.error("Exception in refreshSession:", error);
      return null;
    }
  }, [fetchUserProfile, navigate, user]);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (error) {
        setError(error.message);
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        const profile = await fetchUserProfile(data.user.id);
        if (profile) {
          setUserRole(profile.role);
          setUserDepartment(profile.department);
        }
        
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        
        navigate("/dashboard");
      }
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up function
  const signUp = async (userData: SignUpData) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signUp({
        email: userData.email.toLowerCase(),
        password: userData.password,
        options: {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            phone: userData.phone,
            department: userData.department,
            dni: userData.dni,
            residencia: userData.residencia,
          },
        },
      });

      if (error) {
        setError(error.message);
        toast({
          title: "Signup failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        toast({
          title: "Welcome!",
          description: "Your account has been created successfully.",
        });
        
        navigate("/dashboard");
      }
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setIsLoading(true);
      
      await supabase.auth.signOut();
      
      // Clear all state
      setSession(null);
      setUser(null);
      setUserRole(null);
      setUserDepartment(null);
      
      toast({
        title: "Success",
        description: "You have been logged out successfully",
      });
      
      navigate('/auth');
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
      // Still navigate to auth page even if there's an error
      navigate('/auth');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial session setup and auth state subscription
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    
    const setupSession = async () => {
      try {
        setIsLoading(true);
        
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          
          const profile = await fetchUserProfile(initialSession.user.id);
          if (profile) {
            setUserRole(profile.role);
            setUserDepartment(profile.department);
          }
        }
        
        // Set up the auth state change listener
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
          async (event, authStateSession) => {
            console.log("Auth state changed:", event);
            
            if (authStateSession) {
              setSession(authStateSession);
              setUser(authStateSession.user);
              
              const profile = await fetchUserProfile(authStateSession.user.id);
              if (profile) {
                setUserRole(profile.role);
                setUserDepartment(profile.department);
              }
            } else {
              setSession(null);
              setUser(null);
              setUserRole(null);
              setUserDepartment(null);
              
              if (event === 'SIGNED_OUT') {
                navigate('/auth');
              }
            }
          }
        );
        
        subscription = authSubscription;
      } catch (error: any) {
        console.error("Error in session setup:", error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    setupSession();
    
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [navigate, fetchUserProfile]);

  // Token refresh logic
  useEffect(() => {
    if (!session) return;
    
    // Calculate time until token expiration
    const expiresAt = session.expires_at ? session.expires_at * 1000 : Date.now() + 4 * 60 * 1000;
    const timeUntilExpiry = expiresAt - Date.now();
    const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 60 * 1000); // Refresh 5 minutes before expiry
    
    const refreshTimer = setTimeout(() => {
      refreshSession();
    }, refreshTime);
    
    return () => clearTimeout(refreshTimer);
  }, [session, refreshSession]);

  // Activity monitoring - refresh token after inactivity
  useEffect(() => {
    const INACTIVITY_THRESHOLD = 15 * 60 * 1000; // 15 minutes
    
    const activityHandler = () => {
      const now = Date.now();
      if (now - lastActivity > INACTIVITY_THRESHOLD) {
        refreshSession();
      }
      setLastActivity(now);
    };
    
    // Add event listeners for user activity
    window.addEventListener('mousemove', activityHandler);
    window.addEventListener('keydown', activityHandler);
    window.addEventListener('click', activityHandler);
    window.addEventListener('touchstart', activityHandler);
    
    return () => {
      window.removeEventListener('mousemove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
      window.removeEventListener('click', activityHandler);
      window.removeEventListener('touchstart', activityHandler);
    };
  }, [lastActivity, refreshSession]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      refreshSession();
      toast({
        title: "Connection restored",
        description: "You are back online",
        variant: "default",
      });
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [refreshSession, toast]);

  const value = {
    session,
    user,
    userRole,
    userDepartment,
    isLoading,
    error,
    login,
    signUp,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
