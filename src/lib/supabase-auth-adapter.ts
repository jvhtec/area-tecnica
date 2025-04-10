
import { supabase } from "@/lib/supabase";
import { User, AuthChangeEvent } from "@supabase/supabase-js";

// Define the Session type from Supabase
export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at?: number; // Make expires_at optional to match Supabase's type
  user: User;
}

// Define the RealtimeChannel types needed
export interface RealtimeChannel {
  on: (event: string, callback: (payload: any) => void) => RealtimeChannel;
  subscribe: (callback?: (status: string, err?: Error) => void) => RealtimeChannel;
  unsubscribe: () => Promise<void>;
}

export interface RealtimeChannelOptions {
  config?: {
    broadcast?: {
      self?: boolean;
    };
    presence?: {
      key?: string;
    };
  };
}

// Create an adapter for Supabase Auth methods
const supabaseAuthAdapter = {
  // Session methods
  async getSession(): Promise<{ data: { session: Session | null }, error: Error | null }> {
    const response = await supabase.auth.getSession();
    return {
      data: { session: response.data.session as Session | null },
      error: response.error
    };
  },
  
  async getUser(): Promise<{ data: { user: User | null }, error: Error | null }> {
    const response = await supabase.auth.getUser();
    return {
      data: { user: response.data.user },
      error: response.error
    };
  },
  
  async refreshSession(refresh_token?: string): Promise<{ data: { session: Session | null }, error: Error | null }> {
    const options = refresh_token ? { refresh_token } : undefined;
    const response = await supabase.auth.refreshSession(options);
    return {
      data: { session: response.data.session as Session | null },
      error: response.error
    };
  },
  
  // Authentication methods
  async signInWithPassword(credentials: { email: string, password: string }): Promise<{ data: { user: User | null, session: Session | null }, error: Error | null }> {
    const response = await supabase.auth.signInWithPassword(credentials);
    return {
      data: { 
        user: response.data.user,
        session: response.data.session as Session | null
      },
      error: response.error
    };
  },
  
  async signUp(credentials: { email: string, password: string, options?: any }): Promise<{ data: { user: User | null, session: Session | null }, error: Error | null }> {
    const response = await supabase.auth.signUp(credentials);
    return {
      data: { 
        user: response.data.user,
        session: response.data.session as Session | null
      },
      error: response.error
    };
  },
  
  async signOut(): Promise<{ error: Error | null }> {
    return await supabase.auth.signOut();
  },
  
  async updateUser(attributes: any): Promise<{ data: { user: User | null }, error: Error | null }> {
    return await supabase.auth.updateUser(attributes);
  },
  
  // Listeners
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): { data: { subscription: { unsubscribe: () => void } } } {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session as Session | null);
    });
    return { data };
  }
};

export default supabaseAuthAdapter;
