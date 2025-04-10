
import { useState, useEffect, useCallback, useContext, createContext, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import supabaseAuthAdapter, { Session } from "@/lib/supabase-auth-adapter";
import { TokenManager } from "@/lib/token-manager";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";

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
  const { refreshSubscriptions, invalidateQueries } = useSubscriptionContext();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokenManager = TokenManager.getInstance();

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

  const refreshSession = useCallback(async (): Promise<Session | null> => {
    try {
      console.log("Starting session refresh");
      
      const { session: refreshedSession, error } = await tokenManager.refreshToken();
      
      if (error) {
        console.error("Session refresh error:", error);
        
        if (error.message && error.message.includes('expired')) {
          setSession(null);
          setUser(null);
          setUserRole(null);
          setUserDepartment(null);
          navigate('/auth');
          toast({
            title: "Session expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive",
          });
        }
        return null;
      }
      
      if (refreshedSession) {
        console.log("Session refreshed successfully");
        // Convert the session to our own Session type before setting state
        setSession(refreshedSession as unknown as Session);
        setUser(refreshedSession.user);
        
        if (!user || user.id !== refreshedSession.user.id) {
          const profile = await fetchUserProfile(refreshedSession.user.id);
          if (profile) {
            setUserRole(profile.role);
            setUserDepartment(profile.department);
          }
        }
        
        refreshSubscriptions();
        invalidateQueries();
        
        return refreshedSession as unknown as Session;
      }
      
      console.log("No session returned from refresh");
      return null;
    } catch (error) {
      console.error("Exception in refreshSession:", error);
      return null;
    }
  }, [fetchUserProfile, navigate, user, tokenManager, toast, refreshSubscriptions, invalidateQueries]);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabaseAuthAdapter.signInWithPassword({
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

  const signUp = async (userData: SignUpData) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabaseAuthAdapter.signUp({
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

  const logout = async () => {
    try {
      setIsLoading(true);
      
      await tokenManager.signOut();
      
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
      navigate('/auth');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    
    const refreshTime = tokenManager.calculateRefreshTime(session);
    console.log(`Scheduling token refresh in ${Math.round(refreshTime/1000)} seconds`);
    
    const refreshTimer = setTimeout(() => {
      console.log("Executing scheduled token refresh");
      refreshSession();
    }, refreshTime);
    
    return () => clearTimeout(refreshTimer);
  }, [session, refreshSession, tokenManager]);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    
    const setupSession = async () => {
      try {
        setIsLoading(true);
        
        const initialSession = await tokenManager.getSession();
        
        if (initialSession) {
          // Convert to our Session type
          setSession(initialSession as unknown as Session);
          setUser(initialSession.user);
          
          const profile = await fetchUserProfile(initialSession.user.id);
          if (profile) {
            setUserRole(profile.role);
            setUserDepartment(profile.department);
          }
        }
        
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
          async (event, authStateSession) => {
            console.log("Auth state changed:", event);
            
            if (authStateSession) {
              // Convert to our Session type
              setSession(authStateSession as unknown as Session);
              setUser(authStateSession.user);
              
              const profile = await fetchUserProfile(authStateSession.user.id);
              if (profile) {
                setUserRole(profile.role);
                setUserDepartment(profile.department);
              }
              
              refreshSubscriptions();
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
  }, [navigate, fetchUserProfile, tokenManager, refreshSubscriptions]);

  useEffect(() => {
    const handleOnline = () => {
      refreshSession();
      toast({
        title: "Connection restored",
        description: "You are back online",
        variant: "default",
      });
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (session && tokenManager.checkTokenExpiration(session, 10 * 60 * 1000)) {
          refreshSession();
        }
      }
    };
    
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshSession, session, toast, tokenManager]);

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
