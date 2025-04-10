
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

// Define the Session type from Supabase
export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
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
    return await supabase.auth.getSession();
  },
  
  async getUser(): Promise<{ data: { user: User | null }, error: Error | null }> {
    return await supabase.auth.getUser();
  },
  
  async refreshSession(refresh_token?: string): Promise<{ data: { session: Session | null }, error: Error | null }> {
    if (refresh_token) {
      return await supabase.auth.refreshSession({ refresh_token });
    }
    return await supabase.auth.refreshSession();
  },
  
  // Authentication methods
  async signInWithPassword(credentials: { email: string, password: string }): Promise<{ data: { user: User | null, session: Session | null }, error: Error | null }> {
    return await supabase.auth.signInWithPassword(credentials);
  },
  
  async signUp(credentials: { email: string, password: string, options?: any }): Promise<{ data: { user: User | null, session: Session | null }, error: Error | null }> {
    return await supabase.auth.signUp(credentials);
  },
  
  async signOut(): Promise<{ error: Error | null }> {
    return await supabase.auth.signOut();
  },
  
  async updateUser(attributes: any): Promise<{ data: { user: User | null }, error: Error | null }> {
    return await supabase.auth.updateUser(attributes);
  },
  
  // Listeners
  onAuthStateChange(callback: (event: string, session: Session | null) => void): { data: { subscription: { unsubscribe: () => void } } } {
    const { data } = supabase.auth.onAuthStateChange(callback);
    return { data };
  }
};

export default supabaseAuthAdapter;
