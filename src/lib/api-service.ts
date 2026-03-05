import { supabase } from "@/lib/supabase";
import { onFlexTokenInvalidate } from "@/utils/flexTokenCache";

// Singleton API Service class
export class ApiService {
  private static instance: ApiService;
  private token: string | null = null;
  private tokenVersion = 0;
  private pendingTokenPromise: Promise<string> | null = null;
  
  private constructor() {}
  
  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
      onFlexTokenInvalidate(() => {
        ApiService.instance.token = null;
        ApiService.instance.tokenVersion += 1;
        ApiService.instance.pendingTokenPromise = null;
      });
    }
    return ApiService.instance;
  }
  
  async getToken(): Promise<string> {
    if (this.token) return this.token;
    
    // Deduplicate in-flight requests
    if (this.pendingTokenPromise) return this.pendingTokenPromise;
    
    const requestVersion = this.tokenVersion;
    const localPromise = (async () => {
      const { data, error } = await supabase.functions.invoke('get-secret', {
        body: { secretName: 'X_AUTH_TOKEN' }
      });
      
      if (error) throw new Error('Failed to get auth token');
      
      const token = (data as { X_AUTH_TOKEN?: string } | null)?.X_AUTH_TOKEN;
      if (!token) throw new Error('Missing X_AUTH_TOKEN in response');
      
      // Only cache if version hasn't changed (no invalidation during fetch)
      if (requestVersion === this.tokenVersion) {
        this.token = token;
      }
      
      return token;
    })();
    
    this.pendingTokenPromise = localPromise;
    
    try {
      return await localPromise;
    } finally {
      // Only clear if our promise is still the current one
      if (this.pendingTokenPromise === localPromise) {
        this.pendingTokenPromise = null;
      }
    }
  }
  
  async get<T>(url: string): Promise<T> {
    try {
      const token = await this.getToken();
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
          'apikey': token,
        },
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error(`GET request failed for ${url}:`, error);
      throw error;
    }
  }
  
  async post<T>(url: string, data: unknown): Promise<T> {
    try {
      const token = await this.getToken();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
          'apikey': token,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error(`POST request failed for ${url}:`, error);
      throw error;
    }
  }
  
  async put<T>(url: string, data: unknown): Promise<T> {
    try {
      const token = await this.getToken();
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
          'apikey': token,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error(`PUT request failed for ${url}:`, error);
      throw error;
    }
  }
  
  async delete<T>(url: string): Promise<T> {
    try {
      const token = await this.getToken();
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
          'apikey': token,
        },
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error(`DELETE request failed for ${url}:`, error);
      throw error;
    }
  }
}
