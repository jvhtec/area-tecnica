import { useState, useEffect, useCallback, useContext, createContext, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { TokenManager } from "@/lib/token-manager";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { getDashboardPath } from "@/utils/roleBasedRouting";
import { UserRole } from "@/types/user";

interface AuthContextType {
  session: Session | null;
  user: any | null;
  userRole: string | null;
  userDepartment: string | null;
  hasSoundVisionAccess: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isProfileLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (userData: SignUpData) => Promise<void>;
  createUserAsAdmin: (userData: Omit<SignUpData, 'password'> & { role?: string }) => Promise<{ id: string; email: string } | null>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
  setUserRole: (role: string | null) => void;
  setUserDepartment: (department: string | null) => void;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  clearCache: () => void;
  getCacheStatus: () => { hasCache: boolean; cacheAge: number; isValid: boolean };
}

interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  nickname?: string;
  lastName: string;
  phone?: string;
  department?: string;
  dni?: string;
  residencia?: string;
}

interface CachedProfile {
  role: string | null;
  department: string | null;
  soundVisionAccess?: boolean;
  userId: string;
  timestamp: number;
}

interface ProfileData {
  role: string | null;
  department: string | null;
  soundvision_access?: boolean | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_CACHE_KEY = 'supabase_user_profile';
const PROFILE_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export const useOptimizedAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useOptimizedAuth must be used within an OptimizedAuthProvider");
  }
  return context;
};

export const OptimizedAuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshSubscriptions, invalidateQueries } = useSubscriptionContext();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [soundVisionAccessFlag, setSoundVisionAccessFlag] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idleTime, setIdleTime] = useState(0);
  const tokenManager = TokenManager.getInstance();

  // Cache profile data in localStorage
  const getCachedProfile = useCallback((userId: string): CachedProfile | null => {
    try {
      const cached = localStorage.getItem(PROFILE_CACHE_KEY);
      if (cached) {
        const profile = JSON.parse(cached) as CachedProfile;
        const isExpired = Date.now() - profile.timestamp > PROFILE_CACHE_DURATION;
        if (!isExpired && profile.userId === userId) {
          console.log('✅ Using cached profile data');
          return profile;
        }
      }
    } catch (error) {
      console.error('Error reading profile cache:', error);
    }
    return null;
  }, []);

  const setCachedProfile = useCallback((userId: string, role: string | null, department: string | null, soundVisionAccess: boolean) => {
    try {
      const profile: CachedProfile = {
        role,
        department,
        soundVisionAccess,
        userId,
        timestamp: Date.now()
      };
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
      console.log('✅ Profile cached successfully');
    } catch (error) {
      console.error('Error caching profile:', error);
    }
  }, []);

  const clearProfileCache = useCallback(() => {
    try {
      localStorage.removeItem(PROFILE_CACHE_KEY);
      console.log('✅ Profile cache cleared');
    } catch (error) {
      console.error('Error clearing profile cache:', error);
    }
    setSoundVisionAccessFlag(false);
  }, []);

  const fetchUserProfile = useCallback(async (userId: string, useCache = true): Promise<ProfileData | null> => {
    try {
      // Try cache first if enabled
      if (useCache) {
        const cached = getCachedProfile(userId);
        if (cached) {
          setUserRole(cached.role);
          setUserDepartment(cached.department);
          setSoundVisionAccessFlag(Boolean(cached.soundVisionAccess));
          return {
            role: cached.role,
            department: cached.department,
            soundvision_access: Boolean(cached.soundVisionAccess)
          };
        }
      }

      console.log('🔄 Fetching fresh profile data...');
      setIsProfileLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('role, department, soundvision_access')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }

      if (data) {
        const soundVisionAccess = Boolean(data.soundvision_access);
        setUserRole(data.role);
        setUserDepartment(data.department);
        setSoundVisionAccessFlag(soundVisionAccess);
        setCachedProfile(userId, data.role, data.department, soundVisionAccess);
        return { ...data, soundvision_access: soundVisionAccess };
      } else {
        setSoundVisionAccessFlag(false);
      }
      return data ?? null;
    } catch (error) {
      console.error("Exception in fetchUserProfile:", error);
      return null;
    } finally {
      setIsProfileLoading(false);
    }
  }, [getCachedProfile, setCachedProfile]);

  const getSessionOnce = useCallback(async () => {
    if (isInitialized) return session;
    
    try {
      const currentSession = await tokenManager.getCachedSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      // Parallelize profile fetch with session setup
      if (currentSession?.user?.id) {
        // Start profile fetch immediately without awaiting
        fetchUserProfile(currentSession.user.id, true).catch(error => {
          console.error('Background profile fetch failed:', error);
        });
      }
      
      setIsInitialized(true);
      return currentSession;
    } catch (error) {
      console.error("Error getting session:", error);
      setIsInitialized(true);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session, isInitialized, tokenManager, fetchUserProfile]);

  const refreshSession = useCallback(async (): Promise<Session | null> => {
    try {
      console.log("Starting session refresh");
      setIdleTime(0);
      
      const { session: refreshedSession, error } = await tokenManager.refreshToken();
      
      if (error) {
        console.error("Session refresh error:", error);
        
        if (error.message && error.message.includes('expired')) {
          setSession(null);
          setUser(null);
          setUserRole(null);
          setUserDepartment(null);
          clearProfileCache();
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
        setSession(refreshedSession);
        setUser(refreshedSession.user);
        
        if (!user || user.id !== refreshedSession.user.id) {
          // Parallelize profile fetch and other operations
          fetchUserProfile(refreshedSession.user.id, true).catch(error => {
            console.error('Profile refresh failed:', error);
          });
        }
        
        refreshSubscriptions();
        invalidateQueries();
        
        return refreshedSession;
      }
      
      console.log("No session returned from refresh");
      return null;
    } catch (error) {
      console.error("Exception in refreshSession:", error);
      return null;
    }
  }, [fetchUserProfile, navigate, user, tokenManager, toast, refreshSubscriptions, invalidateQueries, clearProfileCache]);

  // Rest of the implementation similar to original useAuth but with optimizations
  useEffect(() => {
    if (!isInitialized) {
      getSessionOnce();
    }
  }, [getSessionOnce, isInitialized]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log("Auth state changed:", event);
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user?.id) {
          // Background profile fetch without blocking UI
          fetchUserProfile(newSession.user.id, true).catch(error => {
            console.error('Auth state profile fetch failed:', error);
          });
        } else {
          setUserRole(null);
          setUserDepartment(null);
          clearProfileCache();
        }
        
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserProfile, clearProfileCache]);

  useEffect(() => {
    const idleInterval = setInterval(() => {
      setIdleTime((prevIdleTime) => prevIdleTime + 1);
    }, 60000);

    return () => clearInterval(idleInterval);
  }, []);

  useEffect(() => {
    if (idleTime >= 15) {
      refreshSession();
      setIdleTime(0);
    }
  }, [idleTime, refreshSession]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (session?.user?.id) {
        console.log("Periodic session refresh");
        await refreshSession();
      }
    }, 4 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshSession, session]);

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
        const profile = await fetchUserProfile(data.user.id, false); // Fresh fetch on login
        let roleForNavigation = null;
        
        if (profile) {
          roleForNavigation = profile.role;
        }
        
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        
        const dashboardPath = getDashboardPath(roleForNavigation);
        navigate(dashboardPath);
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
      
      const { data, error } = await supabase.auth.signUp({
        email: userData.email.toLowerCase(),
        password: userData.password,
        options: {
          data: {
            first_name: userData.firstName,
            nickname: userData.nickname,
            last_name: userData.lastName,
            phone: userData.phone,
            department: userData.department,
            dni: userData.dni,
            residencia: userData.residencia,
          },
        },
      });

      if (error) {
        const msg = /signups not allowed/i.test(error.message)
          ? 'Signups are disabled. Please ask an admin to create your account.'
          : error.message;
        setError(msg);
        toast({
          title: "Signup failed",
          description: msg,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        // Wait a moment for the profile to be created by the trigger
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const profile = await fetchUserProfile(data.user.id, false); // Fresh fetch on signup
        let roleForNavigation = null;
        
        if (profile) {
          roleForNavigation = profile.role;
        }
        
        toast({
          title: "Welcome!",
          description: "Your account has been created successfully.",
        });
        
        const dashboardPath = getDashboardPath(roleForNavigation);
        navigate(dashboardPath);
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

  // Admin/management-only create user via Edge Function (service role)
  const createUserAsAdmin = async (userData: Omit<SignUpData, 'password'> & { role?: string } & { flex_resource_id?: string }) => {
    try {
      setIsLoading(true);
      setError(null);
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: userData.email.toLowerCase(),
          firstName: userData.firstName,
          nickname: userData.nickname,
          lastName: userData.lastName,
          phone: userData.phone,
          department: userData.department,
          dni: userData.dni,
          residencia: userData.residencia,
          role: (userData as any).role,
          flex_resource_id: (userData as any).flex_resource_id,
        }
      });
      if (error) {
        const msg = error.message || 'Failed to create user';
        setError(msg);
        toast({ title: 'Create user failed', description: msg, variant: 'destructive' });
        return null;
      }
      toast({ title: 'User created', description: `${data?.email || userData.email} has been created.` });
      return data as { id: string; email: string };
    } catch (e: any) {
      const msg = e?.message || 'Failed to create user';
      setError(msg);
      toast({ title: 'Create user failed', description: msg, variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      
      await tokenManager.signOut();
      clearProfileCache();
      
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

  const requestPasswordReset = async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email: email.toLowerCase() }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to send password reset email');
      }

      toast({
        title: "Password Reset Email Sent",
        description: "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error: any) {
      const errorMessage = error.message || "Failed to send password reset email";
      setError(errorMessage);
      toast({
        title: "Password Reset Failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (newPassword: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated.",
      });

      // Navigate to dashboard after successful password reset
      const dashboardPath = getDashboardPath(userRole as UserRole);
      navigate(dashboardPath);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to update password";
      setError(errorMessage);
      toast({
        title: "Password Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
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

  const normalizedDepartment = userDepartment?.toLowerCase();
  const hasSoundVisionAccess =
    Boolean(soundVisionAccessFlag) ||
    userRole === 'admin' ||
    userRole === 'management' ||
    (userRole === 'house_tech' && normalizedDepartment === 'sound');

  const value = {
    session,
    user,
    userRole,
    userDepartment,
    hasSoundVisionAccess,
    isLoading,
    isInitialized,
    isProfileLoading,
    error,
    login,
    signUp,
    createUserAsAdmin,
    logout,
    refreshSession,
    setUserRole,
    setUserDepartment,
    requestPasswordReset,
    resetPassword,
    clearCache: () => {
      tokenManager.clearCache();
      clearProfileCache();
    },
    getCacheStatus: tokenManager.getCacheStatus.bind(tokenManager)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
