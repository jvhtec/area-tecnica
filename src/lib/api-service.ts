
import { supabase } from "@/lib/supabase";

// Singleton API Service class
export class ApiService {
  private static instance: ApiService;
  private token: string | null = null;
  
  private constructor() {}
  
  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }
  
  async getToken(): Promise<string> {
    if (this.token) return this.token;
    
    try {
      // Fetch token from secure source
      const { data, error } = await supabase.functions.invoke('get-secret', {
        body: { secretName: 'X_AUTH_TOKEN' }
      });
      
      if (error) throw new Error('Failed to get auth token');
      
      this.token = data.X_AUTH_TOKEN;
      return this.token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      throw error;
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
  
  async post<T>(url: string, data: any): Promise<T> {
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
  
  async put<T>(url: string, data: any): Promise<T> {
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
